-- ===========================================================================
-- Club team structure and team-aware opportunities.
--
-- The club is organised as four operational teams, each led by one lead:
--
--     Tech Lead           └── Tech Team Members       build & technical expertise
--     Workshop Lead       └── Workshop Team Members   teach & learning experience
--     Media Lead          └── Media Team Members      social, marketing, content
--     Events Coordinator  └── Events Team Members     operations & logistics
--
--     Member     flexible; belongs to no permanent team
--     Volunteer  limited, event-specific help
--
-- Workshop Presenter is deliberately NOT a club role. It is an opportunity on
-- a specific workshop, open to whichever membership roles an admin lists.
--
-- What this migration changes:
--
--   1. positions gains `team`, `reports_to` and `responsibilities`, and the
--      'committee' organization level becomes 'team'.
--   2. Cybersecurity Lead and Web Development Lead merge into Tech Lead.
--      Secretary and Committee Member leave the active structure.
--   3. event_positions gains a primary category, an assigned lead, an opening
--      date, requirements and responsibilities; a join table records which
--      membership roles are eligible. Category and eligibility are separate on
--      purpose — cross-team opportunities are normal.
--   4. Registration enforces eligibility and the opening date server-side.
--
-- History is never rewritten. position_history keeps its title_snapshot, and a
-- retired role that anything still references is archived, not deleted.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Catalogue columns.
-- ---------------------------------------------------------------------------
alter table public.positions
    add column if not exists team text,
    add column if not exists reports_to uuid references public.positions (id) on delete set null,
    add column if not exists responsibilities text[] not null default '{}';

alter table public.positions
    add constraint positions_team_known
        check (team is null or team in ('tech', 'media', 'workshops', 'events'));

comment on column public.positions.team is
    'The operational team a lead or team-member role belongs to. NULL for '
    'executive officers, Treasurer, Member and Volunteer.';
comment on column public.positions.reports_to is
    'The role this one reports to, e.g. Tech Team Member → Tech Lead.';
comment on column public.positions.responsibilities is
    'What the role involves, one item per entry. Shown on the catalogue and profiles.';

-- 'Committee' described a generic organising committee that no longer exists.
-- The same band (201-299) now holds specialised team membership.
update public.positions set category = 'team' where category = 'committee';

alter table public.positions
    add constraint positions_category_known
        check (category in ('executive', 'lead', 'team', 'general'));

comment on column public.positions.rank is
    'Display order. Derived from category: executive 1-99, lead 101-199, '
    'team 201-299, general 301-399. Lower sorts first; never sort by title text.';

-- ---------------------------------------------------------------------------
-- 2. The new roles. Inserted if missing, then brought to the agreed shape.
-- ---------------------------------------------------------------------------
insert into public.positions (slug, title, title_ar, category, rank) values
    ('tech-lead',            'Tech Lead',            'قائد الفريق التقني',   'lead', 130),
    ('tech-team-member',     'Tech Team Member',     'عضو الفريق التقني',    'team', 210),
    ('media-team-member',    'Media Team Member',    'عضو فريق الإعلام',     'team', 220),
    ('workshop-team-member', 'Workshop Team Member', 'عضو فريق الورش',       'team', 230),
    ('events-team-member',   'Events Team Member',   'عضو فريق الفعاليات',   'team', 240)
on conflict (slug) do nothing;

with spec(slug, category, rank, team, max_holders, description, responsibilities) as (values
    ('treasurer', 'lead', 110, null::text, 1,
     'Manages budget and reimbursements.',
     array['Budget planning', 'Reimbursements', 'Financial records']),

    ('events-coordinator', 'lead', 120, 'events', 1,
     'Leads ACM''s events team and the operational execution and logistics of ACM events.',
     array['Event planning', 'Leading Events Team Members', 'Competition-day logistics',
           'Scheduling and room coordination', 'Registration and check-in operations']),

    ('tech-lead', 'lead', 130, 'tech', 1,
     'Leads ACM''s technical team, including web development, cybersecurity, technical infrastructure, event technology, and technical projects.',
     array['Overseeing ACM websites and platforms', 'Web development', 'Cybersecurity projects',
           'CTF technical preparation', 'Technical infrastructure', 'GitHub repositories',
           'Deployment and hosting', 'Databases/backend systems', 'Technical troubleshooting',
           'Event technical systems', 'Technical demos and challenge environments',
           'Leading Tech Team Members']),

    ('media-lead', 'lead', 140, 'media', 1,
     'Leads ACM social media, marketing, event promotion, content, and digital communications.',
     array['ACM social media accounts', 'Marketing and event promotion', 'Content planning',
           'Public-facing communications', 'Leading Media Team Members']),

    ('workshop-lead', 'lead', 150, 'workshops', 1,
     'Leads ACM''s workshop team, turning knowledge into structured and effective learning experiences.',
     array['Workshop programme planning', 'Learning quality and structure',
           'Coordinating presenters with the Tech Team', 'Leading Workshop Team Members']),

    ('tech-team-member', 'team', 210, 'tech', null::integer,
     'Builds, prepares, tests, and maintains the technical components required by ACM and its events. For workshops, owns the technical side: labs, demos, challenges and technical expertise.',
     array['Web development', 'ACM website/platform development', 'Event websites', 'Cybersecurity',
           'CTF challenge development', 'CTF challenge testing', 'Lab environments', 'Technical demos',
           'GitHub repositories', 'Deployment', 'Hosting', 'Databases/backend systems',
           'Firebase/Supabase integrations', 'Technical troubleshooting',
           'Competition infrastructure', 'Technical projects']),

    ('media-team-member', 'team', 220, 'media', null,
     'Owns ACM''s public-facing social presence and marketing: social media, promotion, content, photography and digital communications.',
     array['ACM social media account management', 'Marketing', 'Event promotion',
           'Social media campaigns', 'Content planning', 'Content creation', 'Promotional materials',
           'Photography', 'Event documentation', 'Social media coverage', 'Digital communications']),

    ('workshop-team-member', 'team', 230, 'workshops', null,
     'Transforms knowledge into a structured and effective learning experience. On technical workshops, works with the Tech Team, which builds the labs and demos.',
     array['Planning workshop sessions', 'Structuring workshop content', 'Creating teaching materials',
           'Preparing slides', 'Preparing handouts', 'Creating exercises', 'Organizing the learning flow',
           'Making material appropriate for the target audience', 'Coordinating presenters',
           'Rehearsing workshop delivery', 'Managing workshop timing', 'Participant assistance',
           'Improving materials after workshops']),

    ('events-team-member', 'team', 240, 'events', null,
     'Responsible for the operational execution and logistics of ACM events.',
     array['Event planning', 'Competition-day logistics', 'Registration', 'Check-in',
           'Participant support', 'Room coordination', 'Scheduling', 'Floor support',
           'Competition operations', 'General event logistics']),

    ('member', 'general', 310, null, null,
     'Flexible club member who can participate across different teams, projects, workshops, competitions, and events.',
     array['Joining opportunities across Tech, Media, Workshops and Events',
           'Contributing to projects, workshops, competitions and events']),

    ('volunteer', 'general', 320, null, null,
     'Helps on specific events in limited, event-specific roles as configured.',
     array['Event-specific volunteering'])
)
update public.positions p
   set category         = spec.category,
       rank             = spec.rank,
       team             = spec.team,
       max_holders      = spec.max_holders,
       description      = spec.description,
       responsibilities = spec.responsibilities,
       is_active        = true,
       archived_at      = null
  from spec
 where p.slug = spec.slug;

-- Reporting lines.
update public.positions child
   set reports_to = lead.id
  from public.positions lead
 where (child.slug, lead.slug) in (
        ('tech-team-member',     'tech-lead'),
        ('media-team-member',    'media-lead'),
        ('workshop-team-member', 'workshop-lead'),
        ('events-team-member',   'events-coordinator'));

-- ---------------------------------------------------------------------------
-- 3. Merge Cybersecurity Lead and Web Development Lead into Tech Lead.
--
-- Anyone currently holding either role has that row closed and a Tech Lead row
-- opened, so their record reads "Cybersecurity Lead → Tech Lead" rather than
-- having the old title silently rewritten. Preferences (an applicant's
-- preferred role, a pending change request) are forward-looking and move to
-- Tech Lead. Decisions already taken (approved_position_id) stay as they were.
-- ---------------------------------------------------------------------------
do $$
declare
    tech uuid := (select id from public.positions where slug = 'tech-lead');
    merged uuid[] := array(select id from public.positions
                            where slug in ('cybersecurity-lead', 'web-development-lead'));
    holder record;
begin
    for holder in
        select ph.id, ph.user_id, ph.started_on
          from public.position_history ph
         where ph.position_id = any (merged)
           and ph.ended_on is null
    loop
        update public.position_history
           set ended_on = greatest(holder.started_on, current_date - 1)
         where id = holder.id;

        insert into public.position_history
            (user_id, position_id, title_snapshot, started_on, chapter_year, note)
        values
            (holder.user_id, tech, 'Tech Lead', greatest(holder.started_on, current_date),
             public.current_chapter_year(),
             'Cybersecurity Lead and Web Development Lead were merged into Tech Lead.');
    end loop;

    update public.applications
       set preferred_position_id = tech
     where preferred_position_id = any (merged);

    update public.position_change_requests
       set requested_position_id = tech
     where requested_position_id = any (merged)
       and status = 'pending';
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Retire Secretary, Cybersecurity Lead, Web Development Lead and Committee
--    Member.
--
-- A role nothing refers to is deleted outright. A role that any record still
-- points at — held once, requested, approved — is archived instead, because
-- deleting it would null those references and make the history less true.
-- Committee Member holders are not guessed into a team; an admin reassigns
-- them from Club Organization.
-- ---------------------------------------------------------------------------
do $$
declare
    retired record;
    referenced boolean;
begin
    for retired in
        select id, slug from public.positions
         where slug in ('secretary', 'cybersecurity-lead', 'web-development-lead', 'committee-member')
    loop
        referenced :=
               exists (select 1 from public.position_history where position_id = retired.id)
            or exists (select 1 from public.position_change_requests
                        where retired.id in (requested_position_id, approved_position_id))
            or exists (select 1 from public.applications
                        where retired.id in (preferred_position_id, approved_position_id));

        if referenced then
            update public.positions
               set is_active = false,
                   archived_at = coalesce(archived_at, now()),
                   max_holders = null
             where id = retired.id;
        else
            delete from public.positions where id = retired.id;
        end if;
    end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. current_positions carries the team, so the portal can tell a Tech Team
--    Member from a flexible Member without a second query.
-- ---------------------------------------------------------------------------
create or replace view public.current_positions
with (security_invoker = true) as
select
    ph.user_id,
    ph.id            as position_history_id,
    ph.position_id,
    ph.title_snapshot as title,
    ph.started_on,
    ph.chapter_year,
    p.rank,
    p.category,
    p.team,
    p.slug
from public.position_history ph
left join public.positions p on p.id = ph.position_id
where ph.ended_on is null;

-- ---------------------------------------------------------------------------
-- 6. Opportunity model.
-- ---------------------------------------------------------------------------
alter table public.event_positions
    add column if not exists category text not null default 'general',
    add column if not exists lead_position_id uuid references public.positions (id) on delete set null,
    add column if not exists opens_on date,
    add column if not exists requirements text,
    add column if not exists responsibilities text;

alter table public.event_positions
    add constraint event_positions_category_known
        check (category in ('tech', 'media', 'workshops', 'events', 'general')),
    add constraint event_positions_window_ordered
        check (opens_on is null or closes_on is null or opens_on <= closes_on);

comment on column public.event_positions.category is
    'Primary team. Visibility and eligibility come from event_position_eligible_roles, not from this.';
comment on column public.event_positions.lead_position_id is
    'The lead role accountable for this opportunity, e.g. Tech Lead.';

create table if not exists public.event_position_eligible_roles (
    event_position_id uuid not null references public.event_positions (id) on delete cascade,
    position_id       uuid not null references public.positions (id) on delete cascade,
    created_at        timestamptz not null default now(),
    primary key (event_position_id, position_id)
);

comment on table public.event_position_eligible_roles is
    'Which membership roles may register for an opportunity. No rows means '
    'every active member is eligible.';

alter table public.event_position_eligible_roles enable row level security;

create policy event_position_eligible_roles_select on public.event_position_eligible_roles
    for select to authenticated
    using (public.is_active_member() or public.is_staff());

create policy event_position_eligible_roles_write_admin on public.event_position_eligible_roles
    for all to authenticated
    using (public.is_club_admin()) with check (public.is_club_admin());

revoke all on public.event_position_eligible_roles from anon;
grant select, insert, update, delete on public.event_position_eligible_roles to authenticated;
grant select on public.event_position_eligible_roles to service_role;

-- ---------------------------------------------------------------------------
-- 7. Eligibility.
--
-- A person's membership role is their open club position. Someone with no
-- position — or one outside the team/general levels — is judged as a Member,
-- the flexible default. Executive officers, leads and staff are never locked
-- out of an opportunity: they supervise the teams that run it.
-- ---------------------------------------------------------------------------
create or replace function public.opportunity_role_for(target_user uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select coalesce(
        (select p.id
           from public.position_history ph
           join public.positions p on p.id = ph.position_id
          where ph.user_id = target_user
            and ph.ended_on is null
            and p.category in ('team', 'general')
          limit 1),
        (select id from public.positions where slug = 'member')
    );
$$;

create or replace function public.may_register_for_event_position(
    p_event_position_id uuid,
    target_user uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select
        target_user is not null
        and (
            not exists (select 1 from public.event_position_eligible_roles
                         where event_position_id = p_event_position_id)
            or exists (select 1
                         from public.position_history ph
                         join public.positions p on p.id = ph.position_id
                        where ph.user_id = target_user
                          and ph.ended_on is null
                          and p.category in ('executive', 'lead'))
            or exists (select 1 from public.admin_assignments aa
                        where aa.user_id = target_user and aa.revoked_at is null)
            or exists (select 1 from public.event_position_eligible_roles er
                        where er.event_position_id = p_event_position_id
                          and er.position_id = public.opportunity_role_for(target_user))
        );
$$;

revoke all on function public.opportunity_role_for(uuid) from public, anon;
revoke all on function public.may_register_for_event_position(uuid, uuid) from public, anon;
grant execute on function public.may_register_for_event_position(uuid, uuid) to authenticated;
-- opportunity_role_for is only an internal helper; callers read their own role
-- from current_positions.

-- ---------------------------------------------------------------------------
-- 8. The availability view grows the opportunity fields. New columns are
--    appended so CREATE OR REPLACE is valid. Still aggregates only: nothing
--    here names an applicant.
-- ---------------------------------------------------------------------------
create or replace view public.event_position_availability
with (security_invoker = false) as
select
    ep.id            as event_position_id,
    ep.project_id,
    ep.title,
    ep.description,
    ep.openings,
    ep.is_open,
    ep.closes_on,
    count(a.id) filter (where a.status = 'approved') as filled,
    greatest(ep.openings - count(a.id) filter (where a.status = 'approved'), 0) as remaining,
    count(a.id) filter (where a.status = 'pending')  as pending,
    ep.category,
    ep.lead_position_id,
    (select lp.title from public.positions lp where lp.id = ep.lead_position_id) as lead_title,
    ep.opens_on,
    ep.requirements,
    ep.responsibilities,
    coalesce((select array_agg(er.position_id order by p.rank)
                from public.event_position_eligible_roles er
                join public.positions p on p.id = er.position_id
               where er.event_position_id = ep.id), '{}') as eligible_role_ids,
    coalesce((select array_agg(p.title order by p.rank)
                from public.event_position_eligible_roles er
                join public.positions p on p.id = er.position_id
               where er.event_position_id = ep.id), '{}') as eligible_role_titles,
    public.may_register_for_event_position(ep.id, auth.uid()) as viewer_eligible
from public.event_positions ep
left join public.event_position_applications a on a.event_position_id = ep.id
where public.is_active_member() or public.is_staff()
group by ep.id;

revoke all on public.event_position_availability from anon;
grant select on public.event_position_availability to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Registration enforces the opening date and eligibility. Direct inserts
--    are held to the same rules by the policy below.
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
            select 1 from public.event_positions ep
            where ep.id = event_position_id
              and ep.is_open
              and (ep.opens_on is null or ep.opens_on <= current_date)
              and (ep.closes_on is null or ep.closes_on >= current_date)
        )
    );

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

    select ep.id, ep.title, ep.is_open, ep.opens_on, ep.closes_on, ep.project_id, ep.openings
      into pos
      from public.event_positions ep
     where ep.id = p_event_position_id
     for update;

    if not found then
        return jsonb_build_object(
            'outcome', 'closed',
            'status', coalesce(existing_app.status::text, 'none'),
            'application_id', existing_app.id
        );
    end if;

    if not pos.is_open
       or (pos.closes_on is not null and pos.closes_on < current_date) then
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
-- 10. Classify the opportunities that already exist.
--
-- Matching is by title so it applies to every event that uses these common
-- role names; nothing new is created. Anything unrecognised stays 'general'
-- with no eligibility rows, i.e. open to every active member, as before.
-- ---------------------------------------------------------------------------
with rule(pattern, category, eligible) as (values
    ('workshop presenter%',        'workshops', array['tech-team-member', 'workshop-team-member', 'member']),
    ('%challenge tester%',         'tech',      array['tech-team-member', 'member']),
    ('%technical support%',        'tech',      array['tech-team-member', 'member']),
    ('%platform support%',         'tech',      array['tech-team-member', 'member']),
    ('%floor support%',            'events',    array['events-team-member', 'member']),
    ('%registration%',             'events',    array['events-team-member', 'member']),
    ('%operations%',               'events',    array['events-team-member', 'member']),
    ('%media%',                    'media',     array['media-team-member', 'member']),
    ('%social media%',             'media',     array['media-team-member', 'member']),
    ('%workshop%',                 'workshops', array['workshop-team-member', 'member'])
),
matched as (
    select distinct on (ep.id) ep.id, rule.category, rule.eligible
      from public.event_positions ep
      join rule on lower(ep.title) like rule.pattern
     order by ep.id, (rule.pattern = 'workshop presenter%') desc,
              (rule.pattern = '%workshop%') asc
),
categorised as (
    update public.event_positions ep
       set category = matched.category,
           lead_position_id = (select id from public.positions where slug = case matched.category
                                   when 'tech'      then 'tech-lead'
                                   when 'media'     then 'media-lead'
                                   when 'workshops' then 'workshop-lead'
                                   when 'events'    then 'events-coordinator'
                               end)
      from matched
     where matched.id = ep.id
       and ep.category = 'general'
    returning ep.id, matched.eligible
)
insert into public.event_position_eligible_roles (event_position_id, position_id)
select c.id, p.id
  from categorised c
  cross join lateral unnest(c.eligible) as e(slug)
  join public.positions p on p.slug = e.slug
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 11. Assertions.
-- ---------------------------------------------------------------------------
do $$
begin
    if exists (select 1 from public.positions
                where is_active and slug in ('secretary', 'cybersecurity-lead',
                                             'web-development-lead', 'committee-member')) then
        raise exception 'A retired role is still active';
    end if;

    if (select count(*) from public.positions
         where is_active and slug in ('treasurer', 'events-coordinator', 'tech-lead', 'media-lead',
                                      'workshop-lead', 'tech-team-member', 'media-team-member',
                                      'workshop-team-member', 'events-team-member',
                                      'member', 'volunteer')) <> 11 then
        raise exception 'The team structure is incomplete';
    end if;

    if exists (select 1 from public.positions
                where category = 'team' and (team is null or reports_to is null) and is_active) then
        raise exception 'An active team role has no team or no lead';
    end if;

    if strpos(pg_get_viewdef('public.event_position_availability'::regclass), 'user_id') > 0 then
        raise exception 'event_position_availability references applicant identity';
    end if;

    if has_table_privilege('anon', 'public.event_position_availability', 'select') then
        raise exception 'anon can read event_position_availability';
    end if;
end;
$$;
