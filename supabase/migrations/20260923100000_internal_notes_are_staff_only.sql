-- ===========================================================================
-- SEC-01 — an internal note is not readable by the person it is about.
--
-- ARCHITECTURE.md says internal notes "live in columns or tables members have
-- no SELECT path to". That was true of application_notes and inquiry_notes,
-- and false of the internal_note column on applications, contributions,
-- archive_submissions and memberships: the member policies on those tables
-- are row filters, and a row filter cannot hide a column. A member selecting
-- their own row got the staff note with it. Verified in the audit: a member
-- read 'reviewer private note' off their own approved contribution, and 11 of
-- 19 contributions carry a note today.
--
-- Why not simply revoke the column:
--   * admins authenticate as the same `authenticated` role as members, so a
--     revoke takes the note away from the people who write it;
--   * a table-level SELECT grant overrides a column-level revoke, so the whole
--     grant would have to be re-issued column by column and re-maintained on
--     every future ALTER TABLE;
--   * member-facing code calls select("*") on all four tables, and the admin
--     dashboard counts with head:true — both would start failing on a
--     permission error rather than degrading.
--
-- So the note moves to where the schema already puts this kind of thing: its
-- own staff-only table. The columns stay for now (dropping them means
-- rewriting six SECURITY DEFINER functions in the same change) but they are
-- kept empty by a trigger, so there is nothing in them to read. Writers keep
-- their existing shape: approve_application(..., internal => '...') still
-- works, and the note is captured on the way through.
-- ===========================================================================

create table if not exists public.internal_notes (
    entity_type text not null check (entity_type in
        ('application', 'contribution', 'archive_submission', 'membership')),
    entity_id   uuid not null,
    note        text not null,
    updated_by  uuid references public.app_users (id),
    updated_at  timestamptz not null default now(),
    primary key (entity_type, entity_id)
);

comment on table public.internal_notes is
    'Staff deliberation about a record, kept out of the record itself so no '
    'row policy mistake can show it to the member it describes. SEC-01.';

alter table public.internal_notes enable row level security;

-- Staff read; club admins may correct. Members have no policy here at all,
-- which is the point.
drop policy if exists internal_notes_select_staff on public.internal_notes;
create policy internal_notes_select_staff on public.internal_notes
    for select to authenticated
    using (public.is_staff());

drop policy if exists internal_notes_write_admin on public.internal_notes;
create policy internal_notes_write_admin on public.internal_notes
    for all to authenticated
    using (public.is_club_admin())
    with check (public.is_club_admin());

grant select, insert, update, delete on public.internal_notes to authenticated;

-- ---- move what is already there ------------------------------------------

insert into public.internal_notes (entity_type, entity_id, note, updated_at)
select 'application', id, internal_note, coalesce(updated_at, now())
  from public.applications
 where internal_note is not null and btrim(internal_note) <> ''
on conflict (entity_type, entity_id) do nothing;

insert into public.internal_notes (entity_type, entity_id, note, updated_at)
select 'contribution', id, internal_note, coalesce(updated_at, now())
  from public.contributions
 where internal_note is not null and btrim(internal_note) <> ''
on conflict (entity_type, entity_id) do nothing;

insert into public.internal_notes (entity_type, entity_id, note, updated_at)
select 'archive_submission', id, internal_note, coalesce(updated_at, now())
  from public.archive_submissions
 where internal_note is not null and btrim(internal_note) <> ''
on conflict (entity_type, entity_id) do nothing;

-- memberships are keyed by user_id, which is their primary key.
insert into public.internal_notes (entity_type, entity_id, note, updated_at)
select 'membership', user_id, internal_note, coalesce(updated_at, now())
  from public.memberships
 where internal_note is not null and btrim(internal_note) <> ''
on conflict (entity_type, entity_id) do nothing;

-- ---- empty the readable columns ------------------------------------------
-- The column guard and the membership audit trigger would otherwise object to
-- a migration doing this as postgres rather than as a signed-in admin. This is
-- a data move, not a decision, so neither belongs in the audit log.

alter table public.applications disable trigger applications_guard;
alter table public.memberships  disable trigger memberships_audit;

update public.applications        set internal_note = null where internal_note is not null;
update public.contributions       set internal_note = null where internal_note is not null;
update public.archive_submissions set internal_note = null where internal_note is not null;
update public.memberships         set internal_note = null where internal_note is not null;

alter table public.applications enable trigger applications_guard;
alter table public.memberships  enable trigger memberships_audit;

-- ---- keep them empty from here on ----------------------------------------

create or replace function public.capture_internal_note()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
    target_id uuid;
    kind      text;
begin
    if new.internal_note is null or btrim(new.internal_note) = '' then
        -- Null means "leave the note as it is", which is what every writer
        -- means by coalesce(internal, internal_note). Nothing to capture.
        new.internal_note := null;
        return new;
    end if;

    kind := case tg_table_name
                when 'applications'        then 'application'
                when 'contributions'       then 'contribution'
                when 'archive_submissions' then 'archive_submission'
                when 'memberships'         then 'membership'
            end;

    target_id := case tg_table_name
                     when 'memberships' then new.user_id
                     else new.id
                 end;

    -- Only staff write staff notes. A member cannot reach this column through
    -- the interface, but `authenticated` holds UPDATE on it, so a crafted
    -- request would otherwise file member-authored text as a staff note.
    -- Dropping it silently keeps that request from failing in a way that
    -- tells the sender the column matters.
    if auth.uid() is null or public.is_staff() then
        insert into public.internal_notes (entity_type, entity_id, note, updated_by, updated_at)
        values (kind, target_id, new.internal_note, auth.uid(), now())
        on conflict (entity_type, entity_id)
            do update set note = excluded.note,
                          updated_by = excluded.updated_by,
                          updated_at = excluded.updated_at;
    end if;

    new.internal_note := null;
    return new;
end;
$$;

comment on function public.capture_internal_note() is
    'Moves an internal note into internal_notes and leaves the member-readable '
    'column empty. SEC-01, September 2026 audit.';

drop trigger if exists applications_capture_internal_note on public.applications;
create trigger applications_capture_internal_note
    before insert or update on public.applications
    for each row execute function public.capture_internal_note();

drop trigger if exists contributions_capture_internal_note on public.contributions;
create trigger contributions_capture_internal_note
    before insert or update on public.contributions
    for each row execute function public.capture_internal_note();

drop trigger if exists archive_submissions_capture_internal_note on public.archive_submissions;
create trigger archive_submissions_capture_internal_note
    before insert or update on public.archive_submissions
    for each row execute function public.capture_internal_note();

drop trigger if exists memberships_capture_internal_note on public.memberships;
create trigger memberships_capture_internal_note
    before insert or update on public.memberships
    for each row execute function public.capture_internal_note();

comment on column public.applications.internal_note is
    'Always null. The note lives in internal_notes; see SEC-01.';
comment on column public.contributions.internal_note is
    'Always null. The note lives in internal_notes; see SEC-01.';
comment on column public.archive_submissions.internal_note is
    'Always null. The note lives in internal_notes; see SEC-01.';
comment on column public.memberships.internal_note is
    'Always null. The note lives in internal_notes; see SEC-01.';
