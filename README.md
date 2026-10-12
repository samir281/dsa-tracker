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

## First login
Sign up with a name, email and password. To load the problems from the earlier tracker, open "My tracker" > Import backup > choose `samir-starter-problems.json`.

## Run locally
cp .env.example .env   (fill in the two values)
npm install
npm run dev

## Known limits
- The leaderboard counts problems by the server time they were first logged, so editing the "Solved on" date does not change it. Deleting a problem removes it from the count. Nothing stops someone from logging made-up problems, so use it with friends you trust.
- Display names are public and can repeat.
- Password reset is not built in. Use Authentication > Users in Supabase.
