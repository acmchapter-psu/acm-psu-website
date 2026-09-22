-- ===========================================================================
-- SEC-02 — an application stays the application it was submitted as.
--
-- event_position_applications has a member UPDATE policy so someone can cancel
-- their own pending request, and `authenticated` holds UPDATE on every column.
-- Between those two facts a member could PATCH their own pending row onto ANY
-- other opening: the eligibility, opening/closing date, capacity and project
-- checks all live on INSERT and in register_event_position_application(), and
-- none of them run again on UPDATE. The same PATCH could write admin_note,
-- decided_by and decided_at, so a request could arrive in the admin queue
-- already looking decided.
--
-- Audit evidence (rolled back): a member moved a legitimate CTF 3.0 request
-- onto a closed WebForge opening and onto an opening belonging to an archived,
-- internal event; both updates reported 1 row.
--
-- The row identity and the decision fields are therefore frozen for anyone who
-- is not a club admin. What a member may still do is unchanged:
--   * cancel a pending request (status -> cancelled, the UPDATE policy's job)
--   * re-register through register_event_position_application(), which reuses
--     the row and CLEARS admin_note/decided_by/decided_at — clearing stays
--     allowed, only setting them does not.
-- ===========================================================================

create or replace function public.guard_event_position_application_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
    if public.is_club_admin() then
        return new;
    end if;

    -- Which opening, and whose request, are decided at submission time.
    if new.event_position_id is distinct from old.event_position_id then
        raise exception
            'An application cannot be moved to a different opening. '
            'Cancel this one and register for the other.'
            using errcode = '42501';
    end if;

    if new.user_id is distinct from old.user_id then
        raise exception 'An application cannot be reassigned to another member.'
            using errcode = '42501';
    end if;

    -- Decision fields belong to the admin who decides. Setting them is refused;
    -- clearing them is what re-registering does.
    if new.admin_note is distinct from old.admin_note and new.admin_note is not null then
        raise exception 'Only an ACM admin can write the decision note on an application.'
            using errcode = '42501';
    end if;

    if new.decided_by is distinct from old.decided_by and new.decided_by is not null then
        raise exception 'Only an ACM admin can record who decided an application.'
            using errcode = '42501';
    end if;

    if new.decided_at is distinct from old.decided_at and new.decided_at is not null then
        raise exception 'Only an ACM admin can record when an application was decided.'
            using errcode = '42501';
    end if;

    return new;
end;
$$;

drop trigger if exists event_position_applications_guard on public.event_position_applications;
create trigger event_position_applications_guard
    before update on public.event_position_applications
    for each row execute function public.guard_event_position_application_columns();

comment on function public.guard_event_position_application_columns() is
    'Freezes an application''s opening, owner and decision fields against '
    'anyone but a club admin. See SEC-02 in the September 2026 audit.';
