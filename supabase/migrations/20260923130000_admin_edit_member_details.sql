-- ===========================================================================
-- An admin can correct a member's details.
--
-- app_users.student_id, major and full_name are administrative fields:
-- guard_app_users_columns() refuses them to the account holder and exempts
-- club admins, and app_users_update_admin already grants the write. So the
-- database has always allowed this. There was simply no way to do it — the
-- admin's member dialog lists Student ID, Major and Academic year as plain
-- text, and the only actions are granting a position, changing membership
-- status and disabling sign-in.
--
-- The result: nobody could record a student ID at all. approve_application()
-- copies one from the application it approves, but an account created any
-- other way — the founding committee, anyone seeded before the portal existed
-- — never had one, and all five accounts today are in that position.
--
-- This is the RPC the page calls. It follows the pattern the rest of the
-- admin surface uses rather than letting the browser write the table
-- directly: the role is re-checked here, the values are validated here, and
-- one audit entry names what changed. audit_context() silences the row
-- trigger so the change is recorded once, richly, instead of twice.
--
-- Email is deliberately NOT editable. app_users.email mirrors auth.users; a
-- change here would not move the address sign-in uses, and the two would
-- disagree silently. Changing an address is an auth operation, not a profile
-- edit. university_role is left out for the same kind of reason: it decides
-- whether an account is presented as faculty, and belongs with the admin
-- tooling that grants positions.
-- ===========================================================================

-- One student ID belongs to one person. No row carries one yet, so nothing
-- has to be reconciled first; the index simply stops the first duplicate.
create unique index if not exists app_users_student_id_key
    on public.app_users (student_id)
 where student_id is not null;

comment on index public.app_users_student_id_key is
    'A student ID identifies one person. Partial, because most accounts have '
    'none and null is not a claim about anybody.';

create or replace function public.admin_update_member_details(
    target_user uuid,
    new_full_name text default null,
    new_student_id text default null,
    new_major text default null,
    new_academic_year text default null,
    reason text default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
    before_row  record;
    clean_name  text := nullif(btrim(coalesce(new_full_name, '')), '');
    clean_id    text := nullif(btrim(coalesce(new_student_id, '')), '');
    clean_major text := nullif(btrim(coalesce(new_major, '')), '');
    clean_year  text := nullif(btrim(coalesce(new_academic_year, '')), '');
    changed     text[] := '{}';
begin
    if not public.is_club_admin() then
        raise exception 'Only a club admin may edit member details.'
            using errcode = '42501';
    end if;

    select * into before_row from public.app_users where id = target_user for update;
    if not found then
        raise exception 'Account not found.';
    end if;

    if clean_name is null then
        raise exception 'A member needs a name.' using errcode = '22023';
    end if;

    -- Same shape the table's CHECK enforces, said in words an admin can act on.
    if clean_id is not null and clean_id !~ '^[0-9]{6,12}$' then
        raise exception 'A student ID is 6 to 12 digits, with nothing else in it.'
            using errcode = '22023';
    end if;

    if clean_id is not null and exists (
        select 1 from public.app_users
         where student_id = clean_id and id <> target_user
    ) then
        raise exception 'That student ID is already recorded against another member.'
            using errcode = '23505';
    end if;

    if char_length(clean_name) > 120 then
        raise exception 'That name is too long.' using errcode = '22023';
    end if;
    if clean_major is not null and char_length(clean_major) > 120 then
        raise exception 'That major is too long.' using errcode = '22023';
    end if;
    if clean_year is not null and char_length(clean_year) > 40 then
        raise exception 'That academic year is too long.' using errcode = '22023';
    end if;

    -- Say what actually moved, so the audit entry is specific.
    if clean_name  is distinct from before_row.full_name  then changed := changed || 'name'::text; end if;
    if clean_id    is distinct from before_row.student_id then changed := changed || 'student ID'::text; end if;
    if clean_major is distinct from before_row.major      then changed := changed || 'major'::text; end if;
    if clean_year  is distinct from (select academic_year from public.member_profiles where user_id = target_user)
        then changed := changed || 'academic year'::text; end if;

    if array_length(changed, 1) is null then
        return;
    end if;

    perform public.audit_context(reason, null, 'updated', true, target_user);

    update public.app_users
       set full_name  = clean_name,
           student_id = clean_id,
           major      = clean_major
     where id = target_user;

    -- The academic year lives on the member's own profile row, which exists
    -- for every account the sign-up trigger created; insert covers the rest.
    insert into public.member_profiles (user_id, academic_year)
    values (target_user, clean_year)
    on conflict (user_id) do update set academic_year = excluded.academic_year;

    perform public.write_audit(
        action         => 'account.details_updated',
        category       => 'membership',
        entity_type    => 'account',
        entity_id      => target_user::text,
        entity_label   => clean_name,
        decision       => 'updated',
        summary        => array_to_string(changed, ', ') || ' updated',
        reason         => reason,
        member_visible => true,
        before_state   => jsonb_build_object(
                            'full_name', before_row.full_name,
                            'student_id', before_row.student_id,
                            'major', before_row.major),
        after_state    => jsonb_build_object(
                            'full_name', clean_name,
                            'student_id', clean_id,
                            'major', clean_major),
        changed_fields => changed,
        related_member => target_user
    );
end;
$$;

comment on function public.admin_update_member_details(uuid, text, text, text, text, text) is
    'Club-admin edit of a member''s name, student ID, major and academic year. '
    'Email and university_role are deliberately not editable here.';

revoke execute on function public.admin_update_member_details(uuid, text, text, text, text, text) from public;
grant execute on function public.admin_update_member_details(uuid, text, text, text, text, text) to authenticated;
