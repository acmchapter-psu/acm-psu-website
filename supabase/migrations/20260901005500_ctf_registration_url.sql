-- Keep the public event record aligned with the CTF 3.0 registration page.
update public.projects
set registration_url = 'https://acmchapter-psu.github.io/ACM-CTF-3.0.//register.html',
    updated_at = now()
where slug = 'ctf-3-0';
