# Bloodlust Tournaments
**EVE Online 1v1 Championship — Bloodlust Tournaments**

Live: https://eve-tournament.vercel.app

## Features
- Single-elimination bracket (16, 32, or 64 pilots)
- EVE SSO authentication via ESI
- Automatic seeding from zKillboard 30-day stats
- Real-time bracket updates via Supabase
- ISK wagering bookie board with live odds
- Win/loss record leaderboard for bettors
- zKillboard kill links on completed matches
- Admin panel for tournament management

## Tech Stack
Next.js 16 · TypeScript · Tailwind CSS · Supabase ·
Vercel · EVE ESI · zKillboard API

## Local Development

Prerequisites: Node 20+, Supabase CLI

1. Clone the repo
2. Copy `.env.local.example` to `.env.local` and fill in values
3. Run: `npm install`
4. Run: `npm run dev`
5. Open: http://localhost:3000

## Environment Variables
See `.env.local.example` for all required variables.

## EVE Developer App
Register at developers.eveonline.com
Callback URL: `{YOUR_URL}/api/auth/eve/callback`
Scopes: `publicData`, `esi-killmails.read_killmails.v1`

---
Built for capsuleers. o7
