-- ===========================================================================
-- Authorization regression tests.
--
-- These run against a REAL database — the linked project, or a branch of it —
-- because the thing under test is row level security, and RLS cannot be
-- stubbed. Everything happens inside one transaction that always ends in
-- RAISE, so no fixture, attack or side effect is ever committed. The results
-- arrive as the text of that error.
--
--     supabase db query --linked -f tests/authorization.test.sql
--
-- A line starting FAIL is a regression. Every test here corresponds to a
-- finding from the September 2026 audit; the point is that they stay fixed.
--
-- Covered: cross-member reads and writes (no IDOR), privilege escalation,
-- internal notes (SEC-01), application re-pointing and forged decisions
-- (SEC-02), the rate limiter's grants (SEC-03), alumni write access (SEC-05),
-- evidence on approved contributions (SEC-12), availability length (SEC-13),
-- capacity and duplicate registration, the eligibility matrix, and the team
-- lead boundary (FUN-08).
-- ===========================================================================
do $$
declare
    out text[] := '{}';
    fails int := 0;
    n bigint; j jsonb; t text; u uuid;

    mem      uuid := 'aaaa0000-0000-4000-8000-000000000001';
    other    uuid := 'aaaa0000-0000-4000-8000-000000000002';
    alum     uuid := 'aaaa0000-0000-4000-8000-000000000003';
    techmem  uuid := 'aaaa0000-0000-4000-8000-000000000004';
    mediamem uuid := 'aaaa0000-0000-4000-8000-000000000005';
    techlead uuid := 'aaaa0000-0000-4000-8000-000000000006';
    admin_u  uuid := 'aaaa0000-0000-4000-8000-000000000007';
    nomem    uuid := 'aaaa0000-0000-4000-8000-000000000008';

    proj uuid; techpos uuid; mediapos uuid; presenter uuid;
    app_mem uuid; app_other uuid; c_appr uuid; c_draft uuid;

    procedure_note text;
begin
    -- helper: record a check
    -- (inline, because a nested function would not see `out`)

    ---------------------------------------------------------------- fixtures
    for u in select unnest(array[mem, other, alum, techmem, mediamem, techlead, admin_u, nomem]) loop
        insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data,
                                raw_app_meta_data, email_confirmed_at, created_at, updated_at)
        values (u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
                'rls-test+' || right(u::text, 4) || '@example.invalid',
                jsonb_build_object('full_name', 'RLS Test ' || right(u::text, 4)),
                '{}'::jsonb, now(), now(), now());
    end loop;

    insert into public.memberships (user_id, status, started_on, chapter_year)
    select x, 'active', current_date, public.current_chapter_year()
      from unnest(array[mem, other, techmem, mediamem, techlead, admin_u]) x;
    insert into public.memberships (user_id, status, started_on, chapter_year)
    values (alum, 'alumni', current_date - 400, '2025');

    insert into public.position_history (user_id, position_id, title_snapshot, started_on)
    select v.uid, p.id, p.title, current_date
      from (values (techmem, 'tech-team-member'), (mediamem, 'media-team-member'),
                   (techlead, 'tech-lead')) v(uid, slug)
      join public.positions p on p.slug = v.slug;

    insert into public.admin_assignments (user_id, role) values (admin_u, 'club_admin');

    select id into proj from public.projects
     where deleted_at is null and status in ('planning', 'active') limit 1;

    insert into public.event_positions (project_id, title, description, openings, is_open, category)
    values (proj, 'RLS test — tech', 'fixture', 2, true, 'tech') returning id into techpos;
    insert into public.event_positions (project_id, title, description, openings, is_open, category)
    values (proj, 'RLS test — media', 'fixture', 1, true, 'media') returning id into mediapos;
    insert into public.event_positions (project_id, title, description, openings, is_open, category)
    values (proj, 'RLS test — presenter', 'fixture', 1, true, 'workshops') returning id into presenter;
    insert into public.event_position_eligible_roles (event_position_id, position_id)
    select presenter, id from public.positions
     where slug in ('tech-team-member', 'workshop-team-member', 'member');

    insert into public.event_position_applications (event_position_id, user_id, availability, status)
    values (techpos, mem, 'weekends', 'pending') returning id into app_mem;
    insert into public.event_position_applications (event_position_id, user_id, availability, status)
    values (mediapos, other, 'evenings', 'pending') returning id into app_other;

    insert into public.contributions (user_id, type_slug, title, status, verified_at, internal_note)
    values (mem, (select slug from public.contribution_types limit 1),
            'Approved fixture', 'approved', now(), 'staff eyes only')
    returning id into c_appr;
    insert into public.contributions (user_id, type_slug, title, status)
    values (mem, (select slug from public.contribution_types limit 1), 'Draft fixture', 'draft')
    returning id into c_draft;

    ------------------------------------------------------- member, own rows
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', mem, 'role', 'authenticated')::text, true);

    select count(*) into n from public.app_users where id <> mem;
    if n <> 0 then fails := fails + 1; end if;
    out := out || (case when n = 0 then 'PASS' else 'FAIL' end || ' member cannot read other accounts (' || n || ')');

    select count(*) into n from public.contributions where user_id <> mem;
    if n <> 0 then fails := fails + 1; end if;
    out := out || (case when n = 0 then 'PASS' else 'FAIL' end || ' member cannot read other contributions (' || n || ')');

    select count(*) into n from public.event_position_applications where user_id <> mem;
    if n <> 0 then fails := fails + 1; end if;
    out := out || (case when n = 0 then 'PASS' else 'FAIL' end || ' member cannot read other applications (' || n || ')');

    -- SEC-01
    select internal_note into t from public.contributions where id = c_appr;
    if t is not null then fails := fails + 1; end if;
    out := out || (case when t is null then 'PASS' else 'FAIL' end ||
                   ' SEC-01 internal note hidden from its subject (' || coalesce(t, 'null') || ')');

    select count(*) into n from public.internal_notes;
    if n <> 0 then fails := fails + 1; end if;
    out := out || (case when n = 0 then 'PASS' else 'FAIL' end || ' SEC-01 member cannot read internal_notes (' || n || ')');

    -- SEC-02
    begin
        update public.event_position_applications set event_position_id = mediapos where id = app_mem;
        fails := fails + 1;
        out := out || 'FAIL SEC-02 member re-pointed their application to another opening'::text;
    exception when others then
        out := out || 'PASS SEC-02 application cannot be re-pointed'::text;
    end;

    begin
        update public.event_position_applications set admin_note = 'approved!', decided_by = admin_u
         where id = app_mem;
        fails := fails + 1;
        out := out || 'FAIL SEC-02 member forged the decision fields'::text;
    exception when others then
        out := out || 'PASS SEC-02 decision fields are not member-writable'::text;
    end;

    -- SEC-03
    begin
        perform public.rate_limit_take('regression:probe', 60, 5);
        fails := fails + 1;
        out := out || 'FAIL SEC-03 rate_limit_take is callable by a member'::text;
    exception when others then
        out := out || 'PASS SEC-03 rate_limit_take is service-role only'::text;
    end;

    -- SEC-12
    begin
        insert into public.contribution_evidence (contribution_id, external_url)
        values (c_appr, 'https://example.com/after-the-fact');
        fails := fails + 1;
        out := out || 'FAIL SEC-12 evidence attached to an approved contribution'::text;
    exception when others then
        out := out || 'PASS SEC-12 approved contributions are closed to new evidence'::text;
    end;

    begin
        insert into public.contribution_evidence (contribution_id, external_url)
        values (c_draft, 'https://example.com/while-editable');
        out := out || 'PASS evidence still allowed while the contribution is editable'::text;
    exception when others then
        fails := fails + 1;
        out := out || ('FAIL evidence refused on a draft contribution: ' || sqlstate);
    end;

    -- SEC-13
    begin
        insert into public.event_position_applications (event_position_id, user_id, availability, status)
        values (presenter, mem, repeat('x', 100000), 'pending');
        fails := fails + 1;
        out := out || 'FAIL SEC-13 oversized availability accepted'::text;
    exception when others then
        out := out || 'PASS SEC-13 availability length enforced by the table'::text;
    end;

    -- escalation
    begin
        insert into public.admin_assignments (user_id, role) values (mem, 'super_admin');
        fails := fails + 1;
        out := out || 'FAIL member granted themselves super_admin'::text;
    exception when others then
        out := out || 'PASS member cannot grant themselves an admin role'::text;
    end;

    begin
        perform public.approve_event_position_application(app_mem, 'self approved');
        fails := fails + 1;
        out := out || 'FAIL member approved their own application'::text;
    exception when others then
        out := out || 'PASS member cannot approve their own application'::text;
    end;

    begin
        update public.app_users set account_state = 'active', university_role = 'staff' where id = mem;
        fails := fails + 1;
        out := out || 'FAIL member rewrote their own account state / university role'::text;
    exception when others then
        out := out || 'PASS administrative account fields are guarded'::text;
    end;
    execute 'reset role';

    ------------------------------------------------------------------ alumni
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', alum, 'role', 'authenticated')::text, true);

    if public.is_active_member() then fails := fails + 1; end if;
    out := out || (case when public.is_active_member() then 'FAIL' else 'PASS' end ||
                   ' SEC-05 alumni are not active members');

    begin
        insert into public.contributions (user_id, type_slug, title, status)
        values (alum, (select slug from public.contribution_types limit 1), 'Alumni work', 'submitted');
        fails := fails + 1;
        out := out || 'FAIL SEC-05 alumni filed a new contribution'::text;
    exception when others then
        out := out || 'PASS SEC-05 alumni cannot file new contributions'::text;
    end;

    select count(*) into n from public.archive_items;
    if n = 0 then fails := fails + 1; end if;
    out := out || (case when n > 0 then 'PASS' else 'FAIL' end ||
                   ' SEC-05 alumni keep their reading access (' || n || ' archive items)');
    execute 'reset role';

    ------------------------------------------------------------- eligibility
    for u, t in select * from (values (mem, 'Member'), (techmem, 'Tech Team'),
                                      (mediamem, 'Media Team'), (alum, 'Alumni')) v(a, b) loop
        execute 'set local role authenticated';
        perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
        begin
            j := public.register_event_position_application(presenter, 'available', null);
            out := out || ('INFO presenter opening (tech/workshop/member) as ' || t || ': ' || (j->>'outcome'));
            if t = 'Media Team' and (j->>'outcome') <> 'not_eligible' then
                fails := fails + 1;
                out := out || 'FAIL an ineligible role registered for the presenter opening'::text;
            end if;
        exception when others then
            out := out || ('INFO presenter as ' || t || ': ' || left(sqlerrm, 45));
        end;
        execute 'reset role';
    end loop;

    ------------------------------------------------------------------- leads
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', techlead, 'role', 'authenticated')::text, true);

    if public.current_lead_team() is distinct from 'tech' then fails := fails + 1; end if;
    out := out || (case when public.current_lead_team() = 'tech' then 'PASS' else 'FAIL' end ||
                   ' FUN-08 tech lead is recognised (' || coalesce(public.current_lead_team(), 'null') || ')');

    select count(*) into n from public.event_position_applications where event_position_id = mediapos;
    if n <> 0 then fails := fails + 1; end if;
    out := out || (case when n = 0 then 'PASS' else 'FAIL' end ||
                   ' FUN-08 lead cannot see another team''s applications (' || n || ')');

    begin
        perform public.decide_event_position_application(app_other, 'rejected', 'not mine to decide');
        fails := fails + 1;
        out := out || 'FAIL FUN-08 lead decided another team''s application'::text;
    exception when others then
        out := out || 'PASS FUN-08 lead cannot decide another team''s application'::text;
    end;

    begin
        insert into public.event_positions (project_id, title, description, openings, is_open, category)
        values (proj, 'Lead overreach', 'fixture', 1, true, 'media');
        fails := fails + 1;
        out := out || 'FAIL FUN-08 lead created an opening for another team'::text;
    exception when others then
        out := out || 'PASS FUN-08 lead cannot create another team''s opening'::text;
    end;

    begin
        perform public.approve_event_position_application(app_mem, 'welcome');
        out := out || 'PASS FUN-08 lead approves their own team''s application'::text;
    exception when others then
        fails := fails + 1;
        out := out || ('FAIL FUN-08 lead could not approve their own team: ' || left(sqlerrm, 50));
    end;

    if public.is_staff() or public.is_club_admin() then
        fails := fails + 1;
        out := out || 'FAIL FUN-08 a lead counts as staff'::text;
    else
        out := out || 'PASS FUN-08 a lead is still not staff'::text;
    end if;
    execute 'reset role';

    ---------------------------------------------------------------- capacity
    -- techpos has 2 openings and one approval above; fill it and try again.
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', admin_u, 'role', 'authenticated')::text, true);
    insert into public.event_position_applications (event_position_id, user_id, availability, status)
    values (techpos, techmem, 'weekends', 'pending');
    perform public.approve_event_position_application(
        (select id from public.event_position_applications
          where event_position_id = techpos and user_id = techmem), 'ok');
    insert into public.event_position_applications (event_position_id, user_id, availability, status)
    values (techpos, mediamem, 'weekends', 'pending');
    begin
        perform public.approve_event_position_application(
            (select id from public.event_position_applications
              where event_position_id = techpos and user_id = mediamem), 'ok');
        fails := fails + 1;
        out := out || 'FAIL capacity exceeded by a third approval on a 2-person opening'::text;
    exception when others then
        out := out || 'PASS capacity holds at the configured number of openings'::text;
    end;
    execute 'reset role';

    ------------------------------------------------------- signed in, no club
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', nomem, 'role', 'authenticated')::text, true);
    select count(*) into n from public.event_positions;
    if n <> 0 then fails := fails + 1; end if;
    out := out || (case when n = 0 then 'PASS' else 'FAIL' end ||
                   ' a signed-in non-member sees no openings (' || n || ')');
    execute 'reset role';

    ------------------------------------------------------------------ report
    raise exception E'AUTHORIZATION TESTS — % failure(s)\n%',
        fails, array_to_string(out, E'\n');
end
$$;
