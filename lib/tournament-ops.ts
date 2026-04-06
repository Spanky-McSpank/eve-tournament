// ── Schema migrations — run in Supabase SQL Editor ───────────────────────────
//
// ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS scheduled_start TIMESTAMPTZ;
// ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS minutes_per_match INT DEFAULT 15;
// ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS current_round INT DEFAULT 1;
// ALTER TABLE tournaments ALTER COLUMN entrant_count DROP CONSTRAINT tournaments_entrant_count_check;
// ALTER TABLE tournaments ADD CONSTRAINT tournaments_entrant_count_check
//   CHECK (entrant_count IN (4,6,8,10,12,16,24,32,48,64));
// ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS discord_webhook_url TEXT;
//
// ALTER TABLE entrants ADD COLUMN IF NOT EXISTS checked_in BOOLEAN DEFAULT FALSE;
// ALTER TABLE entrants ADD COLUMN IF NOT EXISTS eliminated_round INT;
// ALTER TABLE entrants ADD COLUMN IF NOT EXISTS final_placement INT;
//
// ALTER TABLE brackets ADD COLUMN IF NOT EXISTS match_status TEXT DEFAULT 'pending';
//   -- values: 'pending' | 'checkin' | 'live' | 'complete'
//
// For the entrant_count constraint update, run carefully:
// ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS tournaments_entrant_count_check;
// ALTER TABLE tournaments ADD CONSTRAINT tournaments_entrant_count_check
//   CHECK (entrant_count IN (4,6,8,10,12,16,24,32,48,64));
//
// ─────────────────────────────────────────────────────────────────────────────

export {}
