insert into public.app_settings (key, value, description, is_public)
values (
    'club_records_workbook_url',
    '"https://docs.google.com/spreadsheets/d/1wXP3WvqcjnDEOe_sDSGXR-Z6HKvjnufarA4r-CovVEU/edit"'::jsonb,
    'Private Google workbook mirroring club records. Read by the admin and '
    'advisor pages; deliberately not public, so it stays out of the shipped '
    'JavaScript bundles.',
    false
)
on conflict (key) do update
    set value = excluded.value,
        description = excluded.description,
        is_public = excluded.is_public;