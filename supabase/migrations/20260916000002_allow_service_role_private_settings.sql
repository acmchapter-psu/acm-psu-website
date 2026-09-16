-- Service-role Edge Functions need the typed private-setting accessors too.
-- The service role already bypasses table RLS; it should not receive the
-- accessor fallback merely because it has no end-user admin assignment.
create or replace function public.can_read_private_settings()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select auth.role() = 'service_role'
        or public.is_staff()
        or public.is_club_admin()
        or public.is_advisory_instructor();
$$;