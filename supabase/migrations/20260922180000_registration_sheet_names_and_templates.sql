-- ===========================================================================
-- Registration worksheets: capital letters, and templates that explain
-- themselves.
--
-- 1. Worksheet names may now contain capitals (Hackathon261). Google Sheets
--    treats tab names without regard to case, so uniqueness moves to
--    lower(sheet_name): two events can never claim "Hackathon261" and
--    "hackathon261". The event key stays lowercase; it is an identifier, not
--    a display name. The same rule lives in
--    supabase/functions/_shared/registration_names.ts and
--    platform/lib/registration-setup.ts.
--
-- 2. Template labels say what each template is for, and each description is a
--    one-line note the event editor shows under the choice. Template keys are
--    unchanged, so every existing form and worksheet is untouched.
-- ===========================================================================

alter table public.event_registration_forms
    drop constraint event_registration_forms_sheet_shape,
    add constraint event_registration_forms_sheet_shape
        check (sheet_name ~ '^[A-Za-z][A-Za-z0-9_-]{2,40}$');

alter table public.event_registration_forms
    drop constraint event_registration_forms_sheet_unique;
create unique index event_registration_forms_sheet_unique
    on public.event_registration_forms (lower(sheet_name));

update public.registration_templates as t
   set label = v.label,
       description = v.description
  from (values
    ('INDIVIDUAL',
     'Individual sign-up',
     'One row per person: name, university ID, email, phone and major. For workshops, talks and solo events.'),
    ('TEAM_BASIC',
     'Team sign-up — captain only',
     'One row per team. Only the captain gives full details; teammates are listed by email in one cell. The quickest team form.'),
    ('TEAM_STRUCTURED_3',
     'Team of up to 3 — every member',
     'One row per team with full details for each of up to three members, plus experience level. For competitions that need everyone''s university ID, like CTFs.'),
    ('LEGACY_JAM26',
     'WebForge 2026 — original form',
     'The exact columns the WebForge 2026 worksheet already uses: one row per person, with an optional team name and members. Kept only for that event; not offered for new ones.')
  ) as v(template_key, label, description)
 where t.template_key = v.template_key;

do $$
begin
    if exists (select 1 from public.registration_templates
                where template_key in ('INDIVIDUAL', 'TEAM_BASIC', 'TEAM_STRUCTURED_3', 'LEGACY_JAM26')
                  and label ilike '%programming jam%') then
        raise exception 'A registration template still carries its old name';
    end if;
end;
$$;
