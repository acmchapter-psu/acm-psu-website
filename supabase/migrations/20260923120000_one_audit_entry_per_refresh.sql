-- ===========================================================================
-- A full club-records refresh is one decision, not eleven.
--
-- club-records-sheet-sync calls record_university_export() inside its
-- per-worksheet loop, and that function writes both a ledger row and an audit
-- entry. So one press of "refresh" wrote about eleven audit entries, all
-- carrying the same reason. Of the 143 entries in the log today, 114 are
-- these; the 29 that are actually decisions — role grants, membership
-- changes, application approvals — sit behind six pages of them.
--
-- The export detail is not lost by fixing this: university_exports already
-- holds one row per dataset, and the admin's University Records page reads
-- it. That is the ledger. The audit log should record that a refresh was run
-- and by whom, which is one entry.
--
-- record_university_export() is unchanged, because records-export uses it for
-- a genuine single-dataset export, where one entry is exactly right.
-- ===========================================================================

create or replace function public.record_club_records_refresh(
    datasets jsonb,
    format text,
    destination text default null,
    reason text default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
    item        jsonb;
    total_rows  integer := 0;
    sheet_count integer := 0;
    names       text[] := '{}';
begin
    if not public.is_club_admin() then
        raise exception 'Only a club admin may generate university records.'
            using errcode = '42501';
    end if;

    if jsonb_typeof(datasets) <> 'array' then
        raise exception 'datasets must be an array of {dataset, row_count} objects.'
            using errcode = '22023';
    end if;

    -- The ledger keeps its per-dataset detail; this is the same set of rows
    -- record_university_export() would have written, one call instead of ten.
    for item in select * from jsonb_array_elements(datasets)
    loop
        insert into public.university_exports
            (dataset, format, row_count, destination, generated_by)
        values (
            item ->> 'dataset',
            format,
            coalesce((item ->> 'row_count')::integer, 0),
            destination,
            auth.uid()
        );

        total_rows  := total_rows + coalesce((item ->> 'row_count')::integer, 0);
        sheet_count := sheet_count + 1;
        names       := names || (item ->> 'dataset');
    end loop;

    if sheet_count = 0 then
        return;
    end if;

    -- One entry for the refresh itself.
    perform public.write_audit(
        action       => 'export.refreshed',
        category     => 'exports',
        entity_type  => 'university_export',
        entity_id    => 'club_records',
        entity_label => 'Club records (' || upper(format) || ')',
        decision     => 'exported',
        summary      => sheet_count::text || ' worksheet'
                        || case when sheet_count = 1 then '' else 's' end
                        || ' refreshed, ' || total_rows::text || ' records in total',
        reason       => reason,
        metadata     => jsonb_build_object(
                          'worksheets', to_jsonb(names),
                          'sheet_count', sheet_count,
                          'rows', total_rows,
                          'destination', destination)
    );
end;
$$;

comment on function public.record_club_records_refresh(jsonb, text, text, text) is
    'Records a whole club-records refresh: one ledger row per worksheet, one '
    'audit entry for the refresh. Replaces the per-worksheet audit entries '
    'that made the audit log 80% export noise.';

revoke execute on function public.record_club_records_refresh(jsonb, text, text, text) from public;
grant execute on function public.record_club_records_refresh(jsonb, text, text, text) to authenticated;
