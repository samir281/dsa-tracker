# DSA Tracker (multi-user)

Vite + React + Supabase.
- Home page (no login): motivation quote that changes every 2 hours (India time) and a public leaderboard for today / the last 3 days.
- Login and Sign up buttons at the top.
- After login: a private tracker. Each user sees only their own problems and solutions.
- Leaderboard shows only a display name and Easy / Medium / Hard counts. Points: Easy 1, Medium 2, Hard 3.

## One-time Supabase setup
1. Create a free project at https://supabase.com.
2. SQL Editor > New query > paste all of `supabase.sql` > Run. (Run it again after updating the app, it is safe to repeat.)
3. Authentication > Sign In / Providers > Email: turn OFF "Confirm email" (otherwise every sign up sends a mail, and Supabase's free mail limit is a few per hour). Leave "Allow new users to sign up" ON so friends can join.
4. Project Settings > API: copy the Project URL and the anon (or publishable) key.

## Deploy on Netlify (git, not drag and drop)
1. Push this folder to a GitHub repo.
2. Netlify > Add new site > Import from Git. Build command `npm run build`, publish directory `dist` (already in netlify.toml).
3. Site configuration > Environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Deploy. After changing variables, trigger a new deploy.

## Short ID login and account settings
- Sign up asks for a name, a short ID, an email and a password. Short ID: 3 to 20 characters, a-z 0-9 . - _ (not case sensitive), must be unique.
- Login accepts either the short ID or the email (anything with "@" is treated as an email).
- The short ID lookup never reveals an email. The server checks the password itself, and allows 8 tries per 10 minutes per short ID.
- Accounts made before short IDs existed are asked for a short ID once after their next login.
- My tracker > Account: change short ID, email or password.
- Email change: with "Confirm email" OFF it applies at once. With it ON, Supabase mails a confirmation link and the old email keeps working until it is opened.
- Needs the latest `supabase.sql` (adds `profiles`, `login_attempts`, `short_id_available`, `login_email`).
- My tracker > Profile tab holds Account (short ID, email, password) and Links (GitHub, LinkedIn). Each link has its own "Show on the public leaderboard" switch; only https links to github.com or linkedin.com are accepted.

## First login
Sign up with a name, short ID, email and password. To load the problems from the earlier tracker, open "My tracker" > Import backup > choose `samir-starter-problems.json`.

## Run locally
cp .env.example .env   (fill in the two values)
npm install
npm run dev

## Known limits
- The leaderboard counts a problem on its "Solved on" date (never later than the day it was logged, India time). Deleting a problem removes it from the count. Nothing stops someone from logging made-up problems, so use it with friends you trust.
- Display names are public and can repeat.
- Password reset is not built in. Use Authentication > Users in Supabase.
