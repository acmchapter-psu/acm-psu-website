-- ===========================================================================
-- Confirmed 2026 event dates.
--
--   WebForge 2026   workshops 11, 12 and 14 October; competition 17 October
--   CTF 3.0         workshops 8, 9 and 11 November;  competition 14 November
--   CTF 2.0         workshops 28, 29 and 30 April;   competition 2 May
--
-- starts_on is the competition day, as it already was for WebForge and CTF 3.0.
-- CTF 2.0 recorded its first workshop day instead; it now follows the same
-- rule. The public site pages carry the same dates.
-- ===========================================================================

update public.projects
   set starts_on  = date '2026-10-17',
       -- projects_dates_ordered: an old end date must not precede the new start.
       ends_on    = case when ends_on is null then null else date '2026-10-17' end,
       updated_at = now()
 where slug = 'ai-programming-jam-2026';

update public.projects
   set starts_on  = date '2026-11-14',
       -- projects_dates_ordered: an old end date must not precede the new start.
       ends_on    = case when ends_on is null then null else date '2026-11-14' end,
       updated_at = now()
 where slug = 'ctf-3-0';

update public.projects
   set starts_on  = date '2026-05-02',
       -- projects_dates_ordered: an old end date must not precede the new start.
       ends_on    = case when ends_on is null then null else date '2026-05-02' end,
       updated_at = now()
 where slug = 'ctf-2-0';

-- CTF 2.0's workshop modules were dated 20-22 April; the workshops ran 28-30
-- April, so each module day moves eight days later. Results files (dated
-- 29 August, when the report was published) are not workshop material and are
-- left alone.
update public.archive_items i
   set occurred_on = case i.occurred_on
                         when date '2026-04-20' then date '2026-04-28'
                         when date '2026-04-21' then date '2026-04-29'
                         when date '2026-04-22' then date '2026-04-30'
                     end
  from public.projects p
 where p.id = i.project_id
   and p.slug = 'ctf-2-0'
   and i.occurred_on in (date '2026-04-20', date '2026-04-21', date '2026-04-22');
