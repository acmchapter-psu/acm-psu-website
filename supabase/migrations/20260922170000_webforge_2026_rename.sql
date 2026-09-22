-- ===========================================================================
-- ACM Programming Jam 2026 is now WebForge 2026, filed under Web Development.
--
-- The event's pages moved from /projects/programming-jams/ai-programming-jam-26/
-- to /projects/web-development/webforge-2026/. The old URLs still forward (small
-- redirect pages are left in the repository), but stored paths should point at
-- the real location so nothing depends on a hop.
--
-- The slug stays 'ai-programming-jam-2026': it is an identifier that other rows
-- and the website's i18n keys refer to, not something a visitor sees.
-- ===========================================================================

update public.projects
   set title      = 'WebForge 2026',
       category   = 'web-development',
       site_path  = replace(site_path,
                            '/projects/programming-jams/ai-programming-jam-26/',
                            '/projects/web-development/webforge-2026/'),
       updated_at = now()
 where slug = 'ai-programming-jam-2026';

update public.archive_items
   set site_path = replace(site_path,
                           '/projects/programming-jams/ai-programming-jam-26/',
                           '/projects/web-development/webforge-2026/')
 where site_path like '/projects/programming-jams/ai-programming-jam-26/%';
