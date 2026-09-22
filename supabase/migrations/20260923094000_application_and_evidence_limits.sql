-- ===========================================================================
-- SEC-13 — the availability limit belongs on the table, not only in the RPC.
-- SEC-12 — evidence may only be attached while the contribution is editable.
--
-- register_event_position_application() rejects availability over 500
-- characters and a note over 800, and `note` has a CHECK behind it.
-- `availability` did not: a direct PostgREST insert accepted 200 KB in the
-- audit. The rule was already decided; this is the table enforcing it.
--
-- contribution_evidence's member policy is FOR ALL with a USING clause that
-- allows only draft / submitted / changes_requested, but its WITH CHECK asked
-- only "is this your contribution". So a member could attach new evidence to
-- an already approved contribution — the verified record was not closed. The
-- WITH CHECK now matches the USING clause it sits beside.
--
-- Neither constraint has a violating row today (checked against production
-- before writing: longest availability 53 characters, zero evidence rows on
-- non-editable contributions).
-- ===========================================================================

alter table public.event_position_applications
    add constraint event_position_applications_availability_length
    check (availability is null or char_length(availability) <= 500);

drop policy if exists contribution_evidence_own on public.contribution_evidence;

create policy contribution_evidence_own on public.contribution_evidence
    for all to authenticated
    using (
        exists (
            select 1 from public.contributions c
             where c.id = contribution_evidence.contribution_id
               and c.user_id = auth.uid()
               and c.status = any (array['draft'::review_status,
                                         'submitted'::review_status,
                                         'changes_requested'::review_status])
        )
    )
    with check (
        exists (
            select 1 from public.contributions c
             where c.id = contribution_evidence.contribution_id
               and c.user_id = auth.uid()
               and c.status = any (array['draft'::review_status,
                                         'submitted'::review_status,
                                         'changes_requested'::review_status])
        )
    );
