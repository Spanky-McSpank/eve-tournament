-- TOURNAMENTS
CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'registration'
    CHECK (status IN ('registration', 'active', 'complete')),
  entrant_count INT NOT NULL CHECK (entrant_count IN (16, 32, 64)),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ENTRANTS
CREATE TABLE entrants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  character_id BIGINT NOT NULL,
  character_name TEXT NOT NULL,
  corporation_name TEXT,
  alliance_name TEXT,
  portrait_url TEXT,
  kills_30d INT DEFAULT 0,
  losses_30d INT DEFAULT 0,
  isk_destroyed_30d BIGINT DEFAULT 0,
  isk_lost_30d BIGINT DEFAULT 0,
  efficiency NUMERIC(5,4) DEFAULT 0,
  seed INT,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tournament_id, character_id)
);

-- BRACKETS (individual matches)
CREATE TABLE brackets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  round INT NOT NULL,
  match_number INT NOT NULL,
  entrant1_id UUID REFERENCES entrants(id),
  entrant2_id UUID REFERENCES entrants(id),
  winner_id UUID REFERENCES entrants(id),
  is_bye BOOLEAN DEFAULT FALSE,
  killmail_id BIGINT,
  killmail_url TEXT,
  scheduled_time TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE(tournament_id, round, match_number)
);

-- BETS
CREATE TABLE bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tournaments(id),
  bracket_id UUID REFERENCES brackets(id),
  bettor_character_id BIGINT NOT NULL,
  bettor_name TEXT NOT NULL,
  predicted_winner_id UUID REFERENCES entrants(id),
  isk_amount BIGINT NOT NULL CHECK (isk_amount > 0),
  placed_at TIMESTAMPTZ DEFAULT NOW(),
  outcome TEXT NOT NULL DEFAULT 'pending'
    CHECK (outcome IN ('pending', 'won', 'lost'))
);

-- BETTOR RECORDS
CREATE TABLE bettor_records (
  character_id BIGINT PRIMARY KEY,
  character_name TEXT NOT NULL,
  total_bets INT DEFAULT 0,
  bets_won INT DEFAULT 0,
  bets_lost INT DEFAULT 0,
  total_isk_wagered BIGINT DEFAULT 0,
  total_isk_won BIGINT DEFAULT 0,
  total_isk_lost BIGINT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE entrants ENABLE ROW LEVEL SECURITY;
ALTER TABLE brackets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bettor_records ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "Public read tournaments" ON tournaments FOR SELECT USING (true);
CREATE POLICY "Public read entrants" ON entrants FOR SELECT USING (true);
CREATE POLICY "Public read brackets" ON brackets FOR SELECT USING (true);
CREATE POLICY "Public read bets" ON bets FOR SELECT USING (true);
CREATE POLICY "Public read bettor_records" ON bettor_records FOR SELECT USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE brackets;
ALTER PUBLICATION supabase_realtime ADD TABLE bets;
