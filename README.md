# DSA Tracker

Vite + React. Syncs across devices through Supabase (free plan). Without the two environment variables below it still works, but saves only in the browser.

## One-time Supabase setup
1. Create a free project at https://supabase.com.
2. SQL Editor > New query > paste the contents of `supabase.sql` > Run.
3. Authentication > Sign In / Providers > Email: turn OFF "Confirm email" (so sign up works without a mail link).
4. Project Settings > API: copy the Project URL and the `anon` public key.
5. Open the deployed site, click "Create account" with your email and a password.
6. Then Authentication > Sign In / Providers: turn OFF "Allow new users to sign up" so nobody else can create an account.

## Deploy on Netlify (use git, not drag and drop)
Environment variables are baked in at build time, so the site must be built by Netlify.
1. Push this folder to a GitHub repo.
2. Netlify > Add new site > Import from Git. Build command `npm run build`, publish directory `dist` (already in netlify.toml).
3. Site configuration > Environment variables: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Deploy. Sign in on your laptop first (it uploads the problems already there), then on your phone.

## Run locally
cp .env.example .env   (fill in the two values)
npm install
npm run dev

Drag and drop of a locally built `dist` also works if you build with the two variables set in `.env`.
