-- ===========================================================================
-- Registration templates are named by what they collect, not by an event.
--
-- New events choose from three shapes: Individual, Team of 2, Team of 3.
-- Each template also carries a sheet_prefix, which the event editor uses to
-- suggest the worksheet name: <prefix>_<PSU term>, numbered when taken —
-- Individual_261, Team2_261, Team3_261, Team3_261_2. A worksheet still
-- belongs to exactly one event; the prefix only says what kind of list it is.
--
-- TEAM_BASIC and LEGACY_JAM26 stay for the forms already built on them
-- (hackathon261 and jam26) but are no longer offered for new events, and the
-- legacy one is described by its shape instead of by an event's name. No
-- template_key and no column list of an existing template changes, so every
-- existing form and worksheet is untouched.
-- ===========================================================================

alter table public.registration_templates
    add column if not exists sheet_prefix text;

alter table public.registration_templates
    add constraint registration_templates_sheet_prefix_shape
        check (sheet_prefix is null or sheet_prefix ~ '^[A-Za-z][A-Za-z0-9]{1,20}$');

comment on column public.registration_templates.sheet_prefix is
    'Start of the suggested worksheet name, e.g. Team3 → Team3_261.';

-- New: a pair, with full details for both members. Same column vocabulary as
-- the 3-person template, so worksheets read alike.
insert into public.registration_templates
    (template_key, label, description, headers, is_selectable, rank)
values
    ('TEAM_STRUCTURED_2', 'Team of 2', '', array[
        'Timestamp', 'Team Name',
        'Captain Name', 'Captain University ID', 'Captain University Email',
        'Captain Phone Number', 'Captain Major',
        'Member 2 Name', 'Member 2 University ID', 'Member 2 University Email', 'Member 2 Major',
        'Experience Level'], true, 20)
on conflict (template_key) do nothing;

update public.registration_templates as t
   set label         = v.label,
       description   = v.description,
       sheet_prefix  = v.sheet_prefix,
       is_selectable = v.is_selectable,
       rank          = v.rank
  from (values
    ('INDIVIDUAL', 'Individual',
     'One row per person: name, university ID, email, phone and major. For workshops, talks and solo events.',
     'Individual', true, 10),
    ('TEAM_STRUCTURED_2', 'Team of 2',
     'One row per pair, with full details for both members plus experience level.',
     'Team2', true, 20),
    ('TEAM_STRUCTURED_3', 'Team of 3',
     'One row per team, with full details for each of up to three members plus experience level.',
     'Team3', true, 30),
    ('TEAM_BASIC', 'Team, captain only (existing forms)',
     'One row per team: the captain''s details, with teammates listed by email in one cell. Kept for forms that already use it; not offered for new events.',
     'TeamCaptain', false, 800),
    ('LEGACY_JAM26', 'Individual + optional team (existing form)',
     'One row per person, with an optional team name and members. Kept for the form that already uses these columns; not offered for new events.',
     'IndividualTeam', false, 900)
  ) as v(template_key, label, description, sheet_prefix, is_selectable, rank)
 where t.template_key = v.template_key;

do $$
begin
    if (select count(*) from public.registration_templates where is_selectable) <> 3 then
        raise exception 'Expected exactly three templates for new events';
    end if;
    if exists (select 1 from public.registration_templates where sheet_prefix is null) then
        raise exception 'Every registration template needs a sheet_prefix';
    end if;
    if exists (select 1 from public.registration_templates
                where label ~* '(jam|webforge|hackathon|ctf)') then
        raise exception 'A registration template is still named after an event';
    end if;
end;
$$;
