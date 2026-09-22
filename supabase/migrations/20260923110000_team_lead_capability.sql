-- ===========================================================================
-- FUN-08 — a Lead can actually lead their team.
--
-- ARCHITECTURE.md describes four operational teams, each reporting to one
-- lead, but holding the Tech Lead position granted nothing: authorization is
-- carried entirely by admin_assignments, and a lead has none. Measured in the
-- audit: a Tech Lead saw 0 applications for Tech openings and could not
-- approve one. Every decision went to a club admin.
--
-- What a lead gets here, and nothing more:
--
--   see      the applications for openings in their own team's category,
--            with the applicant's name, email and what they wrote
--   decide   approve or reject those applications
--   manage   create and edit openings in their own category, including the
--            eligible-role list and closing them
--
-- Deliberately NOT included:
--   * deleting an opening. An opening with applications behind it is a record
--     of who volunteered; removing it is an admin action.
--   * anything belonging to another team, or any opening whose category is
--     'general' — that is nobody's team and stays with the admins.
--   * member records, contributions, applications to join the club, the audit
--     log, settings: a lead is not staff and is_staff() is unchanged.
--
-- A lead's team is their open position_history row. The Treasurer is a lead by
-- rank with no team, so current_lead_team() returns null for them and every
-- check below fails closed.
-- ===========================================================================

create or replace function public.current_lead_team()
returns text
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
    select p.team
      from public.position_history ph
      join public.positions p on p.id = ph.position_id
      join public.app_users u on u.id = ph.user_id
     where ph.user_id = auth.uid()
       and ph.ended_on is null
       and p.category = 'lead'
       and p.team is not null
       and u.account_state = 'active'
       and u.deleted_at is null
     limit 1;
$$;

comment on function public.current_lead_team() is
    'The team this caller leads (tech/media/workshops/events), or null. '
    'Null for everyone else, including the Treasurer, who leads no team.';

grant execute on function public.current_lead_team() to authenticated;

/* Does the caller lead the team that owns this opening? */
create or replace function public.leads_event_position(p_event_position_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
    select exists (
        select 1
          from public.event_positions ep
         where ep.id = p_event_position_id
           and ep.category = public.current_lead_team()
    );
$$;

comment on function public.leads_event_position(uuid) is
    'True when the opening''s category is the caller''s own lead team. '
    'A null team (not a lead) never matches. FUN-08.';

grant execute on function public.leads_event_position(uuid) to authenticated;

-- ---- see the applications for their own openings --------------------------

drop policy if exists event_position_apps_select_lead on public.event_position_applications;
create policy event_position_apps_select_lead
    on public.event_position_applications
    for select to authenticated
    using (public.leads_event_position(event_position_id));

-- ---- manage the openings themselves ---------------------------------------
-- Insert and update only. The category is pinned to the lead's own team on
-- both sides of an update, so an opening cannot be moved into, or out of,
-- somebody else's team.

drop policy if exists event_positions_insert_lead on public.event_positions;
create policy event_positions_insert_lead
    on public.event_positions
    for insert to authenticated
    with check (category = public.current_lead_team());

drop policy if exists event_positions_update_lead on public.event_positions;
create policy event_positions_update_lead
    on public.event_positions
    for update to authenticated
    using (category = public.current_lead_team())
    with check (category = public.current_lead_team());

drop policy if exists event_position_eligible_roles_write_lead on public.event_position_eligible_roles;
create policy event_position_eligible_roles_write_lead
    on public.event_position_eligible_roles
    for all to authenticated
    using (public.leads_event_position(event_position_id))
    with check (public.leads_event_position(event_position_id));

-- ---- deciding -------------------------------------------------------------
-- Both decision functions already lock the row, re-check capacity and write
-- the audit entry. They gain one more accepted caller, and the audit entry
-- names the lead as the actor exactly as it would an admin.

create or replace function public.approve_event_position_application(request_id uuid, reason text DEFAULT NULL::text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
    req      record;
    pos      record;
    accepted integer;
begin
    select * into req from public.event_position_applications where id = request_id;
    if not found then
        raise exception 'Request not found.';
    end if;

    if not (public.is_club_admin() or public.leads_event_position(req.event_position_id)) then
        raise exception 'Only a club admin, or the lead of that team, may assign event positions.'
            using errcode = '42501';
    end if;

    select * into pos from public.event_positions where id = req.event_position_id for update;
    if not found then
        raise exception 'That event position no longer exists.';
    end if;

    select count(*) into accepted
      from public.event_position_applications
     where event_position_id = req.event_position_id
       and status = 'approved'
       and id <> request_id;

    if accepted >= pos.openings then
        raise exception 'All % opening(s) for "%" are already filled.',
            pos.openings, pos.title;
    end if;

    perform public.audit_context(reason, null, 'approved', true, req.user_id);

    update public.event_position_applications
       set status = 'approved', admin_note = reason,
           decided_by = auth.uid(), decided_at = now()
     where id = request_id;

    insert into public.participations
        (user_id, project_id, event_position_id, role_text, status, verified_at, verified_by)
    values
        (req.user_id, pos.project_id, pos.id, pos.title, 'confirmed', now(), auth.uid())
    on conflict (user_id, project_id, role_text) do update
        set event_position_id = excluded.event_position_id,
            status = 'confirmed',
            verified_at = now(),
            verified_by = auth.uid();

    perform public.write_audit(
        action          => 'event_position.approved',
        category        => 'events',
        entity_type     => 'event_position_application',
        entity_id       => request_id::text,
        entity_label    => pos.title,
        decision        => 'approved',
        summary         => 'Assigned to ' || pos.title,
        reason          => reason,
        member_visible  => true,
        before_state    => jsonb_build_object('status', req.status),
        after_state     => jsonb_build_object('status', 'approved',
                                              'role', pos.title),
        related_project => pos.project_id,
        related_member  => req.user_id,
        related_request => request_id
    );
end;
$$;

create or replace function public.decide_event_position_application(p_application_id uuid, p_status text, p_reason text DEFAULT NULL::text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
    req record;
    decision_value audit_decision;
begin
    if p_status not in ('rejected', 'cancelled') then
        raise exception 'Use approve_event_position_application to approve.'
            using errcode = '22023';
    end if;

    decision_value := case p_status
        when 'rejected' then 'rejected'::audit_decision
        else 'revoked'::audit_decision
    end;

    select a.id, a.user_id, a.status, a.event_position_id, ep.title, ep.project_id
      into req
      from public.event_position_applications a
      left join public.event_positions ep on ep.id = a.event_position_id
     where a.id = p_application_id
     for update of a;

    if not found then
        raise exception 'Request not found.';
    end if;

    if not (public.is_club_admin() or public.leads_event_position(req.event_position_id)) then
        raise exception 'Only a club admin, or the lead of that team, may decide event positions.'
            using errcode = '42501';
    end if;

    perform public.audit_context(p_reason, null, decision_value, true, req.user_id);

    update public.event_position_applications
       set status = p_status::request_status,
           admin_note = p_reason,
           decided_by = auth.uid(),
           decided_at = now(),
           updated_at = now()
     where id = p_application_id;

    update public.participations
       set status = 'withdrawn',
           updated_at = now()
     where user_id = req.user_id
       and event_position_id = req.event_position_id
       and status <> 'withdrawn';

    perform public.write_audit(
        action          => 'event_position.' || p_status,
        category        => 'events',
        entity_type     => 'event_position_application',
        entity_id       => p_application_id::text,
        entity_label    => coalesce(req.title, 'Event position'),
        decision        => decision_value,
        summary         => 'Request ' || p_status,
        reason          => p_reason,
        member_visible  => true,
        before_state    => jsonb_build_object('status', req.status),
        after_state     => jsonb_build_object('status', p_status),
        related_project => req.project_id,
        related_member  => req.user_id,
        related_request => p_application_id
    );
end;
$$;

-- ---- what the lead's page reads -------------------------------------------
-- A lead is not staff, so they have no SELECT path to app_users. Rather than
-- widen that table, this returns exactly the agreed fields for exactly the
-- applications they may already see: who applied, how to reach them, and what
-- they wrote. No student ID, major, membership record or anything else.

create or replace function public.team_lead_applications()
returns table (
    id uuid,
    event_position_id uuid,
    status text,
    availability text,
    note text,
    admin_note text,
    created_at timestamptz,
    decided_at timestamptz,
    applicant_name text,
    applicant_email text,
    position_title text,
    project_id uuid,
    project_title text,
    openings integer,
    filled bigint
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
    select a.id,
           a.event_position_id,
           a.status::text,
           a.availability,
           a.note,
           a.admin_note,
           a.created_at,
           a.decided_at,
           u.full_name,
           u.email::text,
           ep.title,
           pr.id,
           pr.title,
           ep.openings,
           (select count(*) from public.event_position_applications f
             where f.event_position_id = ep.id and f.status = 'approved')
      from public.event_position_applications a
      join public.event_positions ep on ep.id = a.event_position_id
      join public.projects pr on pr.id = ep.project_id
      join public.app_users u on u.id = a.user_id
     where public.current_lead_team() is not null
       and ep.category = public.current_lead_team()
     order by a.created_at desc;
$$;

comment on function public.team_lead_applications() is
    'The caller''s own team''s applications, with the applicant name and email '
    'agreed for leads. Returns nothing for anyone who leads no team. FUN-08.';

grant execute on function public.team_lead_applications() to authenticated;

-- ---- the SEC-02 guard has to know about leads -----------------------------
-- guard_event_position_application_columns() froze the decision fields against
-- anyone who is not a club admin, which now includes the lead the decision
-- belongs to: approve_event_position_application() writes admin_note and
-- decided_by, so a lead approving their own team's application was refused by
-- the guard. Row identity stays frozen for leads as it is for members — only
-- the decision fields open up, and only for the lead of that opening's team.

create or replace function public.guard_event_position_application_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
    if public.is_club_admin() then
        return new;
    end if;

    -- Which opening, and whose request, are decided at submission time — for
    -- leads too. Moving an application between openings is an admin action.
    if new.event_position_id is distinct from old.event_position_id then
        raise exception
            'An application cannot be moved to a different opening. '
            'Cancel this one and register for the other.'
            using errcode = '42501';
    end if;

    if new.user_id is distinct from old.user_id then
        raise exception 'An application cannot be reassigned to another member.'
            using errcode = '42501';
    end if;

    -- The lead of this opening's team decides it, so they may write what a
    -- decision records. Everyone else may only clear these, which is what
    -- re-registering does.
    if not public.leads_event_position(old.event_position_id) then
        if new.admin_note is distinct from old.admin_note and new.admin_note is not null then
            raise exception 'Only an ACM admin can write the decision note on an application.'
                using errcode = '42501';
        end if;

        if new.decided_by is distinct from old.decided_by and new.decided_by is not null then
            raise exception 'Only an ACM admin can record who decided an application.'
                using errcode = '42501';
        end if;

        if new.decided_at is distinct from old.decided_at and new.decided_at is not null then
            raise exception 'Only an ACM admin can record when an application was decided.'
                using errcode = '42501';
        end if;
    end if;

    return new;
end;
$$;
