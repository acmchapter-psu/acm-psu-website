-- ===========================================================================
-- SEC-05 — alumni keep their record and their reading rights, not their
-- ability to file new work.
--
-- is_active_member() counted 'alumni' alongside 'active', and that one
-- function gates two different kinds of thing:
--
--   reading   the internal archive, projects, the opportunity catalogue
--   doing     new contributions, archive submissions, opportunity
--             registrations, position change requests, file uploads
--
-- Someone who has left the club should still be able to look at what they
-- were part of; they should not still be filing new submissions or taking an
-- opening that belongs to a current member. Confirmed in the audit: an alumni
-- identity successfully inserted a new contribution and registered for an
-- opening.
--
-- So the predicate splits in two. is_active_member() now means what it says,
-- and the reading policies move to is_member_or_alumni(), which keeps exactly
-- the access alumni have today. Nothing about an alumnus's existing record,
-- verified contributions or public profile changes: those are not gated on
-- this function.
-- ===========================================================================

create or replace function public.is_member_or_alumni()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
    select exists (
        select 1 from public.memberships m
        join public.app_users u on u.id = m.user_id
        where m.user_id = auth.uid()
          and m.status in ('active', 'alumni')
          and u.account_state = 'active'
          and u.deleted_at is null
    );
$$;

comment on function public.is_member_or_alumni() is
    'Someone who is currently in the club, or who has left it on good terms. '
    'Use for reading; use is_active_member() for anything that files new work.';

grant execute on function public.is_member_or_alumni() to authenticated;

-- The narrowed predicate: current members only.
create or replace function public.is_active_member()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
    select exists (
        select 1 from public.memberships m
        join public.app_users u on u.id = m.user_id
        where m.user_id = auth.uid()
          and m.status = 'active'
          and u.account_state = 'active'
          and u.deleted_at is null
    );
$$;

comment on function public.is_active_member() is
    'A current member: membership status active. Alumni are deliberately not '
    'included — see is_member_or_alumni(). SEC-05, September 2026 audit.';

-- ---- reading keeps the alumni --------------------------------------------

drop policy if exists archive_folders_select_members on public.archive_folders;
create policy archive_folders_select_members on public.archive_folders
    for select to authenticated
    using (deleted_at is null and (public.is_member_or_alumni() or public.is_staff()));

drop policy if exists archive_items_select_members on public.archive_items;
create policy archive_items_select_members on public.archive_items
    for select to authenticated
    using (deleted_at is null and (public.is_member_or_alumni() or public.is_staff()));

drop policy if exists archive_contributors_select_members on public.archive_item_contributors;
create policy archive_contributors_select_members on public.archive_item_contributors
    for select to authenticated
    using (public.is_member_or_alumni() or public.is_staff());

drop policy if exists projects_select_members on public.projects;
create policy projects_select_members on public.projects
    for select to authenticated
    using (deleted_at is null and (public.is_member_or_alumni() or public.is_staff()));

drop policy if exists event_positions_select on public.event_positions;
create policy event_positions_select on public.event_positions
    for select to authenticated
    using (public.is_member_or_alumni() or public.is_staff());

drop policy if exists event_position_eligible_roles_select on public.event_position_eligible_roles;
create policy event_position_eligible_roles_select on public.event_position_eligible_roles
    for select to authenticated
    using (public.is_member_or_alumni() or public.is_staff());

drop policy if exists "members read the internal archive" on storage.objects;
create policy "members read the internal archive" on storage.objects
    for select to authenticated
    using (bucket_id = 'internal-archive' and (public.is_member_or_alumni() or public.is_staff()));

-- Writing (contributions, submissions, registrations, position requests and
-- the two upload policies) keeps is_active_member(), which now excludes
-- alumni. Those policies are unchanged; only the predicate beneath them is.
