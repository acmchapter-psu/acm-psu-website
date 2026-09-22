-- Signed-in sessions end, the way they do in any real application.
--
-- Supabase refresh tokens never expire on the free plan, so a browser that
-- signed in once could keep renewing its access token forever. This migration
-- makes the server enforce two limits:
--
--   * 14 days after the person signed in, however active they are;
--   * 3 days after the session was last used (a browser renews its access
--     token about once an hour while the site is open).
--
-- Two mechanisms, because either alone leaves a gap:
--
--   1. enforce_session_lifetime() runs before every API request and rejects an
--      expired session immediately with 401, even though its access token
--      would otherwise stay valid for up to an hour.
--   2. An hourly job deletes expired sessions from auth.sessions. That cascades
--      to their refresh tokens, so the browser can no longer renew and Edge
--      Functions (which ask the Auth server) refuse it too.
--
-- The browser mirrors these limits in platform/lib/supabase.ts so an expired
-- sign-in is dropped before a page even loads. Keep the numbers in step.

create or replace function public.session_is_current(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from auth.sessions s
        where s.id = p_session_id
          and (s.not_after is null or s.not_after > now())
          and s.created_at > now() - interval '14 days'
          and greatest(
                s.created_at,
                s.updated_at,
                s.refreshed_at at time zone 'UTC'
              ) > now() - interval '3 days'
    );
$$;

revoke all on function public.session_is_current(uuid) from public, anon, authenticated;

-- PostgREST calls this as the requesting role before running each request.
create or replace function public.enforce_session_lifetime()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_session_id uuid;
begin
    begin
        v_session_id := nullif(
            current_setting('request.jwt.claims', true)::jsonb ->> 'session_id', ''
        )::uuid;
    exception when others then
        v_session_id := null;
    end;

    -- Anonymous visitors and the service role carry no session.
    if v_session_id is null then
        return;
    end if;

    if not public.session_is_current(v_session_id) then
        raise sqlstate 'PGRST' using
            message = json_build_object(
                'code', 'PGRST301',
                'message', 'Your session expired. Please sign in again.',
                'hint', 'session_expired'
            )::text,
            detail = json_build_object('status', 401, 'headers', json_build_object())::text;
    end if;
end;
$$;

revoke all on function public.enforce_session_lifetime() from public;
grant execute on function public.enforce_session_lifetime() to anon, authenticated, service_role;

alter role authenticator set pgrst.db_pre_request = 'public.enforce_session_lifetime';
notify pgrst, 'reload config';

-- Hourly clean-up of sessions past either limit.
create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.purge_expired_sessions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_deleted integer;
begin
    delete from auth.sessions s
    where not public.session_is_current(s.id);
    get diagnostics v_deleted = row_count;
    return v_deleted;
end;
$$;

revoke all on function public.purge_expired_sessions() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'purge-expired-sessions';
select cron.schedule(
    'purge-expired-sessions',
    '17 * * * *',
    $$select public.purge_expired_sessions()$$
);
