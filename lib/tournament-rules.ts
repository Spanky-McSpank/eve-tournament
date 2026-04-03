// Run in Supabase SQL Editor:
// ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS ship_class TEXT;
// ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS ship_restrictions TEXT;
// ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS banned_ships TEXT;
// ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS engagement_rules TEXT;
// ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS system_name TEXT;
// ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS system_id INTEGER;
// ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS fitting_restrictions TEXT;
// ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS additional_rules TEXT;

export interface TournamentRules {
  ship_class: string | null
  ship_restrictions: string | null
  banned_ships: string | null
  engagement_rules: string | null
  system_name: string | null
  system_id: number | null
  fitting_restrictions: string | null
  additional_rules: string | null
}

export function hasAnyRules(t: TournamentRules): boolean {
  return !!(
    t.ship_class || t.ship_restrictions || t.banned_ships ||
    t.engagement_rules || t.system_name || t.fitting_restrictions ||
    t.additional_rules
  )
}
