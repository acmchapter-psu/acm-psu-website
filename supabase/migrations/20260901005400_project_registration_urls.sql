alter table public.projects
  add column if not exists registration_url text;

update public.projects
set registration_url = 'http://acmchapter-psu.github.io/acm-webforge-2026/team-formation.html',
    updated_at = now()
where slug = 'ai-programming-jam-2026';
