# Deployment Guide

## 1. Supabase
- Create project at supabase.com (free tier)
- Go to SQL Editor, paste and run the contents of
  `supabase/migrations/001_initial_schema.sql`
- Copy from Project Settings → API:
  - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
  - anon public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - service_role key → `SUPABASE_SERVICE_ROLE_KEY`

## 2. EVE Developer App
- Go to developers.eveonline.com → Create New Application
- Connection Type: Authentication & API Access
- Scopes: `esi-killmails.read_killmails.v1`
- Callback URL: `https://your-vercel-url.vercel.app/api/auth/eve/callback`
- Copy Client ID → `EVE_CLIENT_ID`
- Copy Secret Key → `EVE_CLIENT_SECRET`

## 3. Vercel
- Import GitHub repo at vercel.com
- Set root directory to: `eve-tournament`
- Add all environment variables from `.env.local.example`
- Set `ADMIN_CHARACTER_IDS` to comma-separated EVE character IDs
  (find your character ID at zkillboard.com/search/)
- Deploy

## 4. Auto-deploy
Every push to master deploys automatically via Vercel GitHub integration.
