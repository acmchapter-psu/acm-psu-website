-- ===========================================================================
-- Public directory: read current positions without the caller's permissions.
--
-- public_member_directory runs as its owner, but it read positions through
-- current_positions, which is security_invoker. A nested invoker view checks
-- the CALLER's privileges and RLS even from inside an owner-run view, so:
--
--   * signed-out visitors (anon) have no SELECT on position_history and got
--     "permission denied" — the whole view failed, and with it every public
--     record built on it: public_position_history,
--     public_verified_contributions and public_event_participation. The
--     homepage's faculty advisors and upcoming events stopped loading.
--   * signed-in members only pass position_history_select_self, so the
--     directory showed each member their OWN role and no one else's.
--
-- The positions are now read directly from the tables, as the view's owner.
-- That exposes nothing new: the view already publishes the role title, rank
-- and level of people whose profiles are public, and its WHERE clause — the
-- view's authorization — is unchanged. Output columns are identical, so
-- CREATE OR REPLACE keeps the grants and the dependent views.
-- ===========================================================================

create or replace view public.public_member_directory
with (security_invoker = false) as
select
    u.id as user_id,
    coalesce(nullif(p.display_name, ''), u.full_name) as name,
    coalesce(m.status, 'active'::membership_status) as status,
    m.member_no,
    m.chapter_year,
    m.started_on,
    p.bio,
    case when u.university_role = 'student' then p.academic_year else null end as academic_year,
    p.interests,
    p.linkedin_url,
    p.github_url,
    p.website_url,
    p.extra_links,
    p.avatar_path,
    case when u.university_role = 'student' then u.major else null end as major,
    cp.title as current_position,
    cp.rank as position_rank,
    cp.category as position_category,
    trim(both '-' from regexp_replace(lower(u.full_name), '[^a-z0-9]+', '-', 'g')) as person_slug,
    u.university_role,
    ip.academic_title,
    ip.department,
    coalesce(ip.courses_taught, '{}'::text[]) as courses_taught,
    coalesce(ip.expertise, '{}'::text[]) as expertise,
    coalesce(ip.research_interests, '{}'::text[]) as research_interests,
    ip.office_location,
    ip.office_hours,
    ip.faculty_page_url
from public.app_users u
join public.member_profiles p on p.user_id = u.id
left join public.memberships m on m.user_id = u.id
left join public.instructor_profiles ip on ip.user_id = u.id
left join (
    -- The open position, read as the view owner rather than the caller.
    select ph.user_id, ph.title_snapshot as title, pos.rank, pos.category
      from public.position_history ph
      left join public.positions pos on pos.id = ph.position_id
     where ph.ended_on is null
) cp on cp.user_id = u.id
where p.visibility = 'public'
  and u.account_state = 'active'
  and u.deleted_at is null
  and (
        (u.university_role = 'student'
         and m.status = any (array['active'::membership_status, 'alumni'::membership_status]))
     or (u.university_role = any (array['instructor', 'staff'])
         and cp.user_id is not null)
  );

-- Guard: the directory and everything built on it must be readable signed out,
-- and must never expose applicant or private-note data.
do $$
begin
    if strpos(pg_get_viewdef('public.public_member_directory'::regclass), 'current_positions') > 0 then
        raise exception 'public_member_directory still reads the invoker view';
    end if;
    if not has_table_privilege('anon', 'public.public_member_directory', 'select') then
        raise exception 'anon cannot read public_member_directory';
    end if;
end;
$$;
