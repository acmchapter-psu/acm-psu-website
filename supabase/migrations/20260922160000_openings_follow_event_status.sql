-- ===========================================================================
-- Openings follow their event.
--
-- An event opening was treated as live whenever its own is_open flag was set,
-- so archiving or completing an event left its roles on the member board and
-- open for registration (ACM Club Hackathon — Term 261 was archived with five
-- roles still accepting requests). Openings past their closing date also
-- stayed on the member board.
--
-- The rule, enforced here and mirrored by the portal's board query:
--
--   an opening is live only while its event is 'planning' or 'active', the
--   event is not deleted, the opening is open, and its closing date (if any)
--   has not passed.
--
-- Nothing is rewritten: is_open keeps whatever an admin set, so restoring an
-- event to 'active' brings its openings back exactly as they were.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Registration refuses openings on events that are no longer running.
-- ---------------------------------------------------------------------------
create or replace function public.register_event_position_application(
    p_event_position_id uuid,
    p_availability text,
    p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    pos record;
    existing_app public.event_position_applications%rowtype;
    assignment public.participations%rowtype;
    application_id uuid;
    approved_count integer;
begin
    if auth.uid() is null then
        raise exception 'Sign in required.' using errcode = '42501';
    end if;

    if not public.is_active_member() then
        raise exception 'Only active ACM members may register for event positions.'
            using errcode = '42501';
    end if;

    select * into existing_app
      from public.event_position_applications
     where event_position_id = p_event_position_id
       and user_id = auth.uid()
     for update;

    -- A verified assignment outranks the application table. Repair first so a
    -- member who already holds the role is told exactly that, in a state the
    -- portal can render, rather than being handed a duplicate-key error.
    select * into assignment
      from public.participations
     where event_position_id = p_event_position_id
       and user_id = auth.uid()
       and status in ('registered', 'confirmed', 'completed')
     order by created_at desc
     limit 1;

    if assignment.id is not null then
        perform public.sync_application_from_participation(assignment.id);

        select id into application_id
          from public.event_position_applications
         where event_position_id = p_event_position_id
           and user_id = auth.uid();

        return jsonb_build_object(
            'outcome', 'approved',
            'status', 'approved',
            'application_id', application_id
        );
    end if;

    if existing_app.id is not null and existing_app.status = 'pending' then
        return jsonb_build_object(
            'outcome', 'pending',
            'status', 'pending',
            'application_id', existing_app.id
        );
    end if;

    if existing_app.id is not null and existing_app.status = 'approved' then
        return jsonb_build_object(
            'outcome', 'approved',
            'status', 'approved',
            'application_id', existing_app.id
        );
    end if;

    if nullif(btrim(coalesce(p_availability, '')), '') is null then
        raise exception 'Tell the organisers when you are available.'
            using errcode = '22023';
    end if;

    if char_length(p_availability) > 500 then
        raise exception 'Availability must be 500 characters or fewer.'
            using errcode = '22023';
    end if;

    if p_note is not null and char_length(p_note) > 800 then
        raise exception 'Note must be 800 characters or fewer.'
            using errcode = '22023';
    end if;

    select ep.id, ep.title, ep.is_open, ep.opens_on, ep.closes_on, ep.project_id, ep.openings,
           pr.status as project_status, pr.deleted_at as project_deleted_at
      into pos
      from public.event_positions ep
      join public.projects pr on pr.id = ep.project_id
     where ep.id = p_event_position_id
     for update of ep;

    if not found then
        return jsonb_build_object(
            'outcome', 'closed',
            'status', coalesce(existing_app.status::text, 'none'),
            'application_id', existing_app.id
        );
    end if;

    -- An opening on a completed, archived or removed event is closed, whatever
    -- its own is_open flag still says.
    if not pos.is_open
       or (pos.closes_on is not null and pos.closes_on < current_date)
       or pos.project_status not in ('planning', 'active')
       or pos.project_deleted_at is not null then
        return jsonb_build_object(
            'outcome', 'closed',
            'status', coalesce(existing_app.status::text, 'none'),
            'application_id', existing_app.id
        );
    end if;

    if pos.opens_on is not null and pos.opens_on > current_date then
        return jsonb_build_object(
            'outcome', 'not_open',
            'status', coalesce(existing_app.status::text, 'none'),
            'application_id', existing_app.id
        );
    end if;

    if not public.may_register_for_event_position(p_event_position_id, auth.uid()) then
        return jsonb_build_object(
            'outcome', 'not_eligible',
            'status', coalesce(existing_app.status::text, 'none'),
            'application_id', existing_app.id
        );
    end if;

    -- Capacity is checked with the position row locked so two members cannot
    -- both take the last opening.
    select count(*) into approved_count
      from public.event_position_applications
     where event_position_id = p_event_position_id
       and status = 'approved';

    if approved_count >= pos.openings then
        return jsonb_build_object(
            'outcome', 'full',
            'status', coalesce(existing_app.status::text, 'none'),
            'application_id', existing_app.id
        );
    end if;

    if existing_app.id is null then
        insert into public.event_position_applications (
            event_position_id, user_id, availability, note, status
        ) values (
            p_event_position_id,
            auth.uid(),
            btrim(p_availability),
            nullif(btrim(coalesce(p_note, '')), ''),
            'pending'
        )
        returning id into application_id;

        return jsonb_build_object(
            'outcome', 'created',
            'status', 'pending',
            'application_id', application_id
        );
    end if;

    -- Cancelled or rejected: reuse the row so the member/position record stays
    -- unique and the history stays on one audit trail.
    update public.event_position_applications
       set availability = btrim(p_availability),
           note = nullif(btrim(coalesce(p_note, '')), ''),
           status = 'pending',
           admin_note = null,
           decided_by = null,
           decided_at = null,
           created_at = now(),
           updated_at = now()
     where id = existing_app.id
    returning id into application_id;

    return jsonb_build_object(
        'outcome', 'reopened',
        'status', 'pending',
        'application_id', application_id
    );
end;
$$;

revoke all on function public.register_event_position_application(uuid, text, text)
    from public, anon;
grant execute on function public.register_event_position_application(uuid, text, text)
    to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Direct inserts are held to the same rule.
-- ---------------------------------------------------------------------------
drop policy if exists event_position_apps_insert_own on public.event_position_applications;
create policy event_position_apps_insert_own on public.event_position_applications
    for insert to authenticated
    with check (
        user_id = auth.uid()
        and status = 'pending'
        and public.is_active_member()
        and public.may_register_for_event_position(event_position_id, auth.uid())
        and exists (
            select 1
              from public.event_positions ep
              join public.projects pr on pr.id = ep.project_id
             where ep.id = event_position_id
               and ep.is_open
               and (ep.opens_on is null or ep.opens_on <= current_date)
               and (ep.closes_on is null or ep.closes_on >= current_date)
               and pr.status in ('planning', 'active')
               and pr.deleted_at is null
        )
    );

-- ---------------------------------------------------------------------------
-- 3. The public registry only lists openings on running events.
-- ---------------------------------------------------------------------------
create or replace view public.public_event_openings
with (security_invoker = false) as
select
    ep.id                as event_position_id,
    ep.title,
    ep.description,
    ep.openings,
    ep.closes_on,
    count(a.id) filter (where a.status = 'approved')                        as filled,
    greatest(ep.openings - count(a.id) filter (where a.status = 'approved'), 0)
                                                                           as remaining,
    pr.id                as project_id,
    pr.slug              as project_slug,
    pr.title             as project_title,
    pr.summary           as project_summary,
    pr.starts_on         as project_starts_on,
    pr.site_path         as project_site_path,
    ep.category,
    ep.opens_on,
    coalesce((select array_agg(p.title order by p.rank)
                from public.event_position_eligible_roles er
                join public.positions p on p.id = er.position_id
               where er.event_position_id = ep.id), '{}') as eligible_role_titles
from public.event_positions ep
join public.projects pr on pr.id = ep.project_id
left join public.event_position_applications a on a.event_position_id = ep.id
where pr.visibility = 'public'
  and pr.deleted_at is null
  and pr.status in ('planning', 'active')
  and ep.is_open
  and (ep.closes_on is null or ep.closes_on >= current_date)
group by ep.id, pr.id;

revoke all on public.public_event_openings from public;
grant select on public.public_event_openings to anon, authenticated;

do $$
begin
    if strpos(pg_get_viewdef('public.public_event_openings'::regclass), 'user_id') > 0 then
        raise exception 'public_event_openings references applicant identity';
    end if;
end;
$$;
