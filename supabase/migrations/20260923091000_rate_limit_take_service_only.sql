-- ===========================================================================
-- SEC-03 — the rate limiter is not a public endpoint.
--
-- rate_limit_take() takes the bucket, the window and the ceiling from its
-- caller, and EXECUTE was held by PUBLIC. Over PostgREST that let anyone with
-- the publishable key spend another caller's budget: sixty calls a minute to
-- `assistant:global` keeps the public ACM guide switched off for every
-- visitor, and each call also inserts a row into rate_limit_hits.
--
-- Audit evidence: an anonymous POST to /rest/v1/rpc/rate_limit_take returned
-- true, then false on the next call for the same bucket. (A throwaway bucket
-- was used; the real assistant bucket was left alone.)
--
-- Only server-side code has any reason to call it: the assistant already uses
-- the service role, and club-records-sheet-sync is changed in the same commit
-- to take its applicant throttle on a service-role client rather than the
-- caller's. Edge Functions holding the service-role key bypass this grant.
-- ===========================================================================

revoke execute on function public.rate_limit_take(text, integer, integer) from public;
revoke execute on function public.rate_limit_take(text, integer, integer) from anon;
revoke execute on function public.rate_limit_take(text, integer, integer) from authenticated;

grant execute on function public.rate_limit_take(text, integer, integer) to service_role;

comment on function public.rate_limit_take(text, integer, integer) is
    'Server-side rate limiter. EXECUTE is service_role only: the arguments name '
    'the bucket and the ceiling, so a browser caller could exhaust anyone''s '
    'budget. See SEC-03 in the September 2026 audit.';
