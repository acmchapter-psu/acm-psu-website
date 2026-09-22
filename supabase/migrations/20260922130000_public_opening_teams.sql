-- ===========================================================================
-- Team and eligibility on the public open-positions registry.
--
-- public_event_openings gains the opportunity's primary team, its opening
-- date and the names of the membership roles eligible for it (see
-- 20260922120000_team_structure.sql). Role names are catalogue data, not
-- applicant data: the public contract — public live projects only, aggregate
-- counts only, no applicant identity — is unchanged. Columns are appended so
-- CREATE OR REPLACE is valid.
-- ===========================================================================

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
    if not has_table_privilege('anon', 'public.public_event_openings', 'select') then
        raise exception 'anon cannot read public_event_openings';
    end if;
end;
$$;
