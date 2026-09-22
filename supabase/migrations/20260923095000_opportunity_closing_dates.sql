-- ===========================================================================
-- FUN-02 — opportunity registration closes the day before the event, not
-- weeks before it.
--
-- Every WebForge opening still closed on 2026-09-07, a date left over from
-- the September schedule. Since that date is in the past, all five openings
-- dropped out of public_event_openings and register_event_position_application()
-- answered 'closed': nobody could volunteer for an event still weeks away.
-- CTF 3.0's five openings had the same problem in slower motion — they closed
-- 2026-10-12, set when the competition was 24 October, which no longer matches
-- the 14 November date set in 20260922200000_event_dates_2026.sql.
--
-- Closing date is the day before the event's first day:
--
--   WebForge 2026   workshops start 11 October  -> closes 10 October
--   CTF 3.0         competition 14 November     -> closes 13 November
--
-- projects.starts_on holds the competition day, so WebForge's first workshop
-- day is taken from the schedule rather than from the row.
--
-- The archived Term 261 Hackathon is left alone: its event is over and its
-- openings are already hidden by the event's archived status.
-- ===========================================================================

update public.event_positions ep
   set closes_on = date '2026-10-10'
  from public.projects p
 where p.id = ep.project_id
   and p.slug = 'ai-programming-jam-2026'
   and ep.closes_on is distinct from date '2026-10-10';

update public.event_positions ep
   set closes_on = date '2026-11-13'
  from public.projects p
 where p.id = ep.project_id
   and p.slug = 'ctf-3-0'
   and ep.closes_on is distinct from date '2026-11-13';

-- An opening that opens after it closes would be invisible in a different way;
-- none exists today, but the constraint below is what event_positions already
-- promises (opens_on <= closes_on), so a bad pair here would have failed loudly.
