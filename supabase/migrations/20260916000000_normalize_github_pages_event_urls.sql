update public.projects
set external_url = 'https://acmchapter-psu.github.io/acm-webforge-2026/',
    registration_url = 'https://acmchapter-psu.github.io/acm-webforge-2026/team-formation.html',
    updated_at = now()
where slug = 'ai-programming-jam-2026';

update public.projects
set external_url = 'https://acmchapter-psu.github.io/ACM-CTF-3.0./',
    registration_url = 'https://acmchapter-psu.github.io/ACM-CTF-3.0./register.html',
    updated_at = now()
where slug = 'ctf-3-0';