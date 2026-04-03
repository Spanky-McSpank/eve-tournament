// SQL schema (run in Supabase SQL Editor):
//
// CREATE TABLE prop_bets (
//   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
//   created_by_character_id BIGINT NOT NULL,
//   created_by_name TEXT NOT NULL,
//   title TEXT NOT NULL,
//   description TEXT,
//   category TEXT NOT NULL CHECK (category IN ('tournament_winner','reaches_final','reaches_semifinal','reaches_top4','round1_elimination','match_duration','isk_destroyed','custom')),
//   target_character_id BIGINT,
//   target_character_name TEXT,
//   target_value TEXT,
//   resolution_condition TEXT,
//   yes_prob NUMERIC(5,4) NOT NULL DEFAULT 0.5,
//   status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval','approved','locked','resolved_yes','resolved_no','void')),
//   approved_at TIMESTAMPTZ,
//   approved_by_name TEXT,
//   locks_at TIMESTAMPTZ,
//   locks_at_round INT,
//   resolved_at TIMESTAMPTZ,
//   resolved_by_name TEXT,
//   resolution_note TEXT,
//   void_reason TEXT,
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );
//
// CREATE TABLE prop_proposals (
//   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   prop_id UUID REFERENCES prop_bets(id) ON DELETE CASCADE,
//   tournament_id UUID REFERENCES tournaments(id),
//   proposer_character_id BIGINT NOT NULL,
//   proposer_name TEXT NOT NULL,
//   proposition TEXT NOT NULL CHECK (proposition IN ('yes','no')),
//   isk_amount BIGINT NOT NULL CHECK (isk_amount >= 10000000),
//   implied_prob NUMERIC(5,4) NOT NULL,
//   status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','matched','void')),
//   is_proxy BOOLEAN DEFAULT FALSE,
//   is_anonymous BOOLEAN DEFAULT FALSE,
//   void_reason TEXT,
//   placed_at TIMESTAMPTZ DEFAULT NOW()
// );
//
// CREATE TABLE prop_matches (
//   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   proposal_id UUID REFERENCES prop_proposals(id),
//   prop_id UUID REFERENCES prop_bets(id),
//   tournament_id UUID REFERENCES tournaments(id),
//   acceptor_character_id BIGINT NOT NULL,
//   acceptor_name TEXT NOT NULL,
//   acceptor_isk_amount BIGINT NOT NULL,
//   outcome TEXT NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending','proposer_won','acceptor_won','void')),
//   is_proxy BOOLEAN DEFAULT FALSE,
//   matched_at TIMESTAMPTZ DEFAULT NOW(),
//   resolved_at TIMESTAMPTZ
// );

import { createSupabaseServerClient } from './supabase'

// ── Types ──────────────────────────────────────────────────────────────────

export type PropCategory =
  | 'tournament_winner'
  | 'reaches_final'
  | 'reaches_semifinal'
  | 'reaches_top4'
  | 'round1_elimination'
  | 'match_duration'
  | 'isk_destroyed'
  | 'custom'

export type PropStatus =
  | 'pending_approval'
  | 'approved'
  | 'locked'
  | 'resolved_yes'
  | 'resolved_no'
  | 'void'

export interface PropBet {
  id: string
  tournament_id: string
  created_by_character_id: number
  created_by_name: string
  title: string
  description: string | null
  category: PropCategory
  target_character_id: number | null
  target_character_name: string | null
  target_value: string | null
  resolution_condition: string | null
  yes_prob: number
  status: PropStatus
  approved_at: string | null
  approved_by_name: string | null
  locks_at: string | null
  locks_at_round: number | null
  resolved_at: string | null
  resolved_by_name: string | null
  resolution_note: string | null
  void_reason: string | null
  created_at: string
}

export interface PropProposal {
  id: string
  prop_id: string
  tournament_id: string
  proposer_character_id: number
  proposer_name: string
  proposition: 'yes' | 'no'
  isk_amount: number
  implied_prob: number
  status: 'open' | 'matched' | 'void'
  is_proxy: boolean
  is_anonymous: boolean
  void_reason: string | null
  placed_at: string
}

export interface PropMatch {
  id: string
  proposal_id: string
  prop_id: string
  tournament_id: string
  acceptor_character_id: number
  acceptor_name: string
  acceptor_isk_amount: number
  outcome: 'pending' | 'proposer_won' | 'acceptor_won' | 'void'
  is_proxy: boolean
  matched_at: string
  resolved_at: string | null
}

export interface PropWithProposals extends PropBet {
  proposals: PropProposal[]
  matches: PropMatch[]
  yesCount: number
  noCount: number
  totalIskAtStake: number
}

// ── Odds helpers ───────────────────────────────────────────────────────────

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

function toFractional(prob: number): string {
  if (prob <= 0) return '100/1'
  if (prob >= 1) return '1/100'
  const denominator = 10
  const numerator = Math.round(((1 - prob) / prob) * denominator)
  if (numerator <= 0) return '1/100'
  const d = gcd(numerator, denominator)
  return `${numerator / d}/${denominator / d}`
}

export function calcPropOdds(yesProb: number): {
  yes: { prob: number; percentage: number; fractional: string }
  no: { prob: number; percentage: number; fractional: string }
} {
  const clampedYes = Math.max(0.01, Math.min(0.99, yesProb))
  const clampedNo = 1 - clampedYes
  return {
    yes: {
      prob: clampedYes,
      percentage: Math.round(clampedYes * 100),
      fractional: toFractional(clampedYes),
    },
    no: {
      prob: clampedNo,
      percentage: Math.round(clampedNo * 100),
      fractional: toFractional(clampedNo),
    },
  }
}

export function calcPropAcceptorStake(proposerStake: number, proposerProb: number): number {
  if (proposerProb <= 0 || proposerProb >= 1) return proposerStake
  const ratio = proposerProb / (1 - proposerProb)
  return Math.round((proposerStake * ratio) / 1000) * 1000
}

// ── Auto-resolution helpers ────────────────────────────────────────────────

export async function resolveAllPropMatches(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  propId: string,
  resolution: 'resolved_yes' | 'resolved_no'
): Promise<void> {
  // Fetch all prop_matches for this prop
  const { data: matches } = await supabase
    .from('prop_matches')
    .select('id, proposal_id, acceptor_character_id, acceptor_name, acceptor_isk_amount, outcome')
    .eq('prop_id', propId)

  if (!matches || matches.length === 0) {
    // Still void open proposals
    await supabase
      .from('prop_proposals')
      .update({ status: 'void', void_reason: 'Prop resolved' })
      .eq('prop_id', propId)
      .eq('status', 'open')
    return
  }

  // Fetch proposals to know which side the proposer was on
  const proposalIds = matches.map((m) => m.proposal_id as string)
  const { data: proposals } = await supabase
    .from('prop_proposals')
    .select('id, proposer_character_id, proposer_name, proposition, isk_amount')
    .in('id', proposalIds)

  const proposalMap = new Map(
    (proposals ?? []).map((p) => [p.id as string, p])
  )

  // Determine outcomes
  type MatchUpdate = { id: string; outcome: 'proposer_won' | 'acceptor_won' | 'void' }
  const updates: MatchUpdate[] = []

  for (const match of matches) {
    if ((match.outcome as string) !== 'pending') continue
    const proposal = proposalMap.get(match.proposal_id as string)
    if (!proposal) continue

    const proposerSide = proposal.proposition as 'yes' | 'no'
    let outcome: 'proposer_won' | 'acceptor_won'

    if (resolution === 'resolved_yes') {
      // YES came true
      outcome = proposerSide === 'yes' ? 'proposer_won' : 'acceptor_won'
    } else {
      // NO — did not happen
      outcome = proposerSide === 'no' ? 'proposer_won' : 'acceptor_won'
    }
    updates.push({ id: match.id as string, outcome })
  }

  // Update each match
  for (const u of updates) {
    await supabase
      .from('prop_matches')
      .update({ outcome: u.outcome, resolved_at: new Date().toISOString() })
      .eq('id', u.id)
  }

  // Update bettor_records
  type BettorAccum = {
    character_name: string
    won: number
    lost: number
    isk_won: number
    isk_lost: number
  }
  const bettorMap = new Map<number, BettorAccum>()

  function accumBettor(
    charId: number,
    charName: string,
    won: boolean,
    winAmount: number,
    loseAmount: number
  ) {
    const ex = bettorMap.get(charId)
    if (ex) {
      if (won) { ex.won += 1; ex.isk_won += winAmount }
      else { ex.lost += 1; ex.isk_lost += loseAmount }
    } else {
      bettorMap.set(charId, {
        character_name: charName,
        won: won ? 1 : 0,
        lost: won ? 0 : 1,
        isk_won: won ? winAmount : 0,
        isk_lost: won ? 0 : loseAmount,
      })
    }
  }

  for (const u of updates) {
    const match = matches.find((m) => m.id === u.id)
    if (!match) continue
    const proposal = proposalMap.get(match.proposal_id as string)
    if (!proposal) continue

    const proposerStake = proposal.isk_amount as number
    const acceptorStake = match.acceptor_isk_amount as number

    if (u.outcome === 'proposer_won') {
      accumBettor(proposal.proposer_character_id as number, proposal.proposer_name as string, true, acceptorStake, proposerStake)
      accumBettor(match.acceptor_character_id as number, match.acceptor_name as string, false, proposerStake, acceptorStake)
    } else {
      accumBettor(proposal.proposer_character_id as number, proposal.proposer_name as string, false, acceptorStake, proposerStake)
      accumBettor(match.acceptor_character_id as number, match.acceptor_name as string, true, proposerStake, acceptorStake)
    }
  }

  if (bettorMap.size > 0) {
    const characterIds = [...bettorMap.keys()]
    const { data: existingRecords } = await supabase
      .from('bettor_records')
      .select('*')
      .in('character_id', characterIds)

    const existingMap = new Map(
      (existingRecords ?? []).map((r) => [r.character_id as number, r])
    )

    const upserts = [...bettorMap.entries()].map(([characterId, stats]) => {
      const ex = existingMap.get(characterId)
      return {
        character_id: characterId,
        character_name: stats.character_name,
        total_bets: ((ex?.total_bets as number) ?? 0) + stats.won + stats.lost,
        bets_won: ((ex?.bets_won as number) ?? 0) + stats.won,
        bets_lost: ((ex?.bets_lost as number) ?? 0) + stats.lost,
        total_isk_wagered: ((ex?.total_isk_wagered as number) ?? 0) + stats.isk_won + stats.isk_lost,
        total_isk_won: ((ex?.total_isk_won as number) ?? 0) + stats.isk_won,
        total_isk_lost: ((ex?.total_isk_lost as number) ?? 0) + stats.isk_lost,
        updated_at: new Date().toISOString(),
      }
    })

    await supabase
      .from('bettor_records')
      .upsert(upserts, { onConflict: 'character_id' })
  }

  // Void all still-open proposals for this prop
  await supabase
    .from('prop_proposals')
    .update({ status: 'void', void_reason: 'Prop resolved' })
    .eq('prop_id', propId)
    .eq('status', 'open')
}

export async function checkAndResolveTournamentProps(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  tournamentId: string
): Promise<void> {
  // Fetch approved+locked props for this tournament (non-resolved)
  const { data: props } = await supabase
    .from('prop_bets')
    .select('*')
    .eq('tournament_id', tournamentId)
    .in('status', ['approved', 'locked'])

  if (!props || props.length === 0) return

  // Fetch tournament
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, status')
    .eq('id', tournamentId)
    .single()

  // Fetch all brackets
  const { data: brackets } = await supabase
    .from('brackets')
    .select('id, round, match_number, entrant1_id, entrant2_id, winner_id, is_third_place, is_bye')
    .eq('tournament_id', tournamentId)

  if (!brackets || brackets.length === 0) return

  const totalRounds = Math.max(...brackets.map((b) => b.round as number))

  // Fetch all entrants to map entrant_id -> character_id
  const { data: entrants } = await supabase
    .from('entrants')
    .select('id, character_id, character_name')
    .eq('tournament_id', tournamentId)

  const entrantCharMap = new Map<string, number>(
    (entrants ?? []).map((e) => [e.id as string, e.character_id as number])
  )

  for (const prop of props) {
    const category = prop.category as PropCategory
    const targetCharId = prop.target_character_id as number | null

    if (category === 'tournament_winner') {
      if (!tournament || tournament.status !== 'complete') continue
      if (!targetCharId) continue

      // Final match: highest round, is_third_place=false, match_number=1 (or > 0)
      const finalMatch = brackets
        .filter((b) => b.round === totalRounds && !(b.is_third_place as boolean) && (b.match_number as number) > 0)
        .sort((a, b) => (b.match_number as number) - (a.match_number as number))[0]

      if (!finalMatch || !finalMatch.winner_id) continue

      const championCharId = entrantCharMap.get(finalMatch.winner_id as string)
      const resolution = championCharId === targetCharId ? 'resolved_yes' : 'resolved_no'

      await supabase
        .from('prop_bets')
        .update({ status: resolution, resolved_at: new Date().toISOString(), resolved_by_name: 'system' })
        .eq('id', prop.id)
      await resolveAllPropMatches(supabase, prop.id as string, resolution)

    } else if (category === 'reaches_final') {
      if (!targetCharId) continue

      const finalMatch = brackets
        .filter((b) => b.round === totalRounds && !(b.is_third_place as boolean) && (b.match_number as number) > 0)
        .sort((a, b) => (b.match_number as number) - (a.match_number as number))[0]

      if (!finalMatch) continue
      // Both slots must be filled before we resolve
      if (!finalMatch.entrant1_id || !finalMatch.entrant2_id) continue

      const e1CharId = entrantCharMap.get(finalMatch.entrant1_id as string)
      const e2CharId = entrantCharMap.get(finalMatch.entrant2_id as string)
      const reachedFinal = e1CharId === targetCharId || e2CharId === targetCharId
      const resolution = reachedFinal ? 'resolved_yes' : 'resolved_no'

      await supabase
        .from('prop_bets')
        .update({ status: resolution, resolved_at: new Date().toISOString(), resolved_by_name: 'system' })
        .eq('id', prop.id)
      await resolveAllPropMatches(supabase, prop.id as string, resolution)

    } else if (category === 'reaches_semifinal' || category === 'reaches_top4') {
      if (!targetCharId) continue

      const semiFinalRound = totalRounds - 1
      if (semiFinalRound < 1) continue

      const semiMatches = brackets.filter(
        (b) => b.round === semiFinalRound && !(b.is_third_place as boolean)
      )

      // All semi slots must be filled
      const allFilled = semiMatches.every(
        (b) => b.entrant1_id !== null && b.entrant2_id !== null
      )
      if (!allFilled) continue

      const semiCharIds = new Set<number>()
      for (const m of semiMatches) {
        const c1 = entrantCharMap.get(m.entrant1_id as string)
        const c2 = entrantCharMap.get(m.entrant2_id as string)
        if (c1) semiCharIds.add(c1)
        if (c2) semiCharIds.add(c2)
      }

      const reachedSemi = semiCharIds.has(targetCharId)
      const resolution = reachedSemi ? 'resolved_yes' : 'resolved_no'

      await supabase
        .from('prop_bets')
        .update({ status: resolution, resolved_at: new Date().toISOString(), resolved_by_name: 'system' })
        .eq('id', prop.id)
      await resolveAllPropMatches(supabase, prop.id as string, resolution)

    } else if (category === 'round1_elimination') {
      if (!targetCharId) continue

      const round1Matches = brackets.filter(
        (b) => b.round === 1 && !(b.is_bye as boolean) && b.winner_id !== null
      )

      // Find matches where this character participated and lost
      let resolution: 'resolved_yes' | 'resolved_no' | null = null

      for (const m of round1Matches) {
        const e1CharId = entrantCharMap.get(m.entrant1_id as string)
        const e2CharId = entrantCharMap.get(m.entrant2_id as string)

        if (e1CharId === targetCharId || e2CharId === targetCharId) {
          const winnerCharId = entrantCharMap.get(m.winner_id as string)
          const wasEliminated = winnerCharId !== targetCharId
          resolution = wasEliminated ? 'resolved_yes' : 'resolved_no'
          break
        }
      }

      if (!resolution) continue

      await supabase
        .from('prop_bets')
        .update({ status: resolution, resolved_at: new Date().toISOString(), resolved_by_name: 'system' })
        .eq('id', prop.id)
      await resolveAllPropMatches(supabase, prop.id as string, resolution)
    }
    // match_duration, isk_destroyed, custom — manual resolution only
  }
}

export async function checkPropLockouts(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  tournamentId: string,
  currentRound: number
): Promise<void> {
  await supabase
    .from('prop_bets')
    .update({ status: 'locked' })
    .eq('tournament_id', tournamentId)
    .eq('status', 'approved')
    .lte('locks_at_round', currentRound)
}
