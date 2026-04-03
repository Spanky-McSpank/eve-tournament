// NOTE: Run in Supabase SQL Editor before using third-place match features:
// ALTER TABLE brackets ADD COLUMN IF NOT EXISTS is_third_place BOOLEAN DEFAULT FALSE;

import { createSupabaseServerClient } from './supabase'
import { calculateOdds, MatchOdds } from './odds'

// ── Types ──────────────────────────────────────────────────────────────────

export type Entrant = {
  id: string
  tournament_id: string
  character_id: number
  character_name: string
  corporation_name: string | null
  alliance_name: string | null
  portrait_url: string | null
  kills_30d: number
  losses_30d: number
  isk_destroyed_30d: number
  isk_lost_30d: number
  efficiency: number
  seed: number | null
  registered_at: string
}

export type Bracket = {
  id: string
  tournament_id: string
  round: number
  match_number: number
  entrant1_id: string | null
  entrant2_id: string | null
  winner_id: string | null
  is_bye: boolean
  is_third_place: boolean
  locked: boolean
  killmail_id: number | null
  killmail_url: string | null
  scheduled_time: string | null
  completed_at: string | null
}

export type BracketWithEntrants = Omit<Bracket, 'entrant1_id' | 'entrant2_id' | 'winner_id'> & {
  entrant1: Entrant | null
  entrant2: Entrant | null
  winner: Entrant | null
  odds?: MatchOdds
}

// ── Helpers ────────────────────────────────────────────────────────────────

function computeEfficiency(e: Entrant): number {
  const total = e.isk_destroyed_30d + e.isk_lost_30d
  return total === 0 ? 0.5 : e.isk_destroyed_30d / total
}

function nextPowerOf2(n: number): number {
  let p = 1
  while (p < n) p *= 2
  return p
}

// ── generateBracket ────────────────────────────────────────────────────────

export async function generateBracket(
  tournamentId: string,
  entrants: Entrant[]
): Promise<void> {
  if (entrants.length < 2) throw new Error('At least 2 entrants required')

  const supabase = createSupabaseServerClient()
  const entrantCount = entrants.length

  const sorted = [...entrants].sort(
    (a, b) => computeEfficiency(b) - computeEfficiency(a)
  )

  const bracketSize = nextPowerOf2(entrantCount)
  const totalRounds = Math.ceil(Math.log2(entrantCount))
  const byes = bracketSize - entrantCount
  const matchesInR1 = bracketSize / 2

  type BracketInsert = {
    tournament_id: string
    round: number
    match_number: number
    entrant1_id: string | null
    entrant2_id: string | null
    winner_id: string | null
    is_bye: boolean
    is_third_place?: boolean
    completed_at: string | null
  }

  const allMatches: BracketInsert[] = []

  for (let k = 1; k <= byes; k++) {
    const e = sorted[k - 1]
    allMatches.push({
      tournament_id: tournamentId,
      round: 1,
      match_number: k,
      entrant1_id: e.id,
      entrant2_id: null,
      winner_id: e.id,
      is_bye: true,
      completed_at: new Date().toISOString(),
    })
  }

  const nonByeMatchCount = matchesInR1 - byes
  for (let k = 1; k <= nonByeMatchCount; k++) {
    const topIdx = byes + k - 1
    const botIdx = entrantCount - k
    allMatches.push({
      tournament_id: tournamentId,
      round: 1,
      match_number: byes + k,
      entrant1_id: sorted[topIdx].id,
      entrant2_id: sorted[botIdx].id,
      winner_id: null,
      is_bye: false,
      completed_at: null,
    })
  }

  for (let r = 2; r <= totalRounds; r++) {
    const matchesInRound = bracketSize / Math.pow(2, r)
    for (let m = 1; m <= matchesInRound; m++) {
      allMatches.push({
        tournament_id: tournamentId,
        round: r,
        match_number: m,
        entrant1_id: null,
        entrant2_id: null,
        winner_id: null,
        is_bye: false,
        completed_at: null,
      })
    }
  }

  // Third place match — same round as the final, match_number 0
  if (entrantCount >= 4) {
    allMatches.push({
      tournament_id: tournamentId,
      round: totalRounds,
      match_number: 0,
      entrant1_id: null,
      entrant2_id: null,
      winner_id: null,
      is_bye: false,
      is_third_place: true,
      completed_at: null,
    })
  }

  const { error: bracketError } = await supabase.from('brackets').insert(allMatches)
  if (bracketError) throw new Error('Failed to insert brackets: ' + bracketError.message)

  const { error: tournamentError } = await supabase
    .from('tournaments')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', tournamentId)
  if (tournamentError) throw new Error('Failed to update tournament: ' + tournamentError.message)

  await Promise.all(
    sorted.map((e, idx) =>
      supabase.from('entrants').update({ seed: idx + 1 }).eq('id', e.id)
    )
  )
}

// ── advanceWinner ──────────────────────────────────────────────────────────

export async function advanceWinner(
  bracketId: string,
  winnerId: string,
  killmailUrl?: string
): Promise<void> {
  const supabase = createSupabaseServerClient()

  const { data: bracket, error: fetchError } = await supabase
    .from('brackets')
    .select('*')
    .eq('id', bracketId)
    .single()

  if (fetchError || !bracket) throw new Error('Bracket not found')

  const isThirdPlace = (bracket.is_third_place as boolean) ?? false

  const updateData: Record<string, unknown> = {
    winner_id: winnerId,
    completed_at: new Date().toISOString(),
  }
  if (killmailUrl) {
    const km = killmailUrl.match(/zkillboard\.com\/kill\/(\d+)/)
    if (km) {
      updateData.killmail_id = parseInt(km[1], 10)
      updateData.killmail_url = killmailUrl
    }
  }

  const { error: updateError } = await supabase
    .from('brackets')
    .update(updateData)
    .eq('id', bracketId)
  if (updateError) throw new Error('Failed to update bracket: ' + updateError.message)

  // Find totalRounds for this tournament (excluding third-place match doesn't inflate max)
  const { data: maxRoundRow } = await supabase
    .from('brackets')
    .select('round')
    .eq('tournament_id', bracket.tournament_id as string)
    .order('round', { ascending: false })
    .limit(1)
    .single()
  const totalRounds = (maxRoundRow?.round as number) ?? (bracket.round as number)

  // Advance winner to next round (skip for third-place match — no next round)
  if (!isThirdPlace) {
    const nextRound = (bracket.round as number) + 1
    const nextMatchNumber = Math.ceil((bracket.match_number as number) / 2)
    const isOdd = (bracket.match_number as number) % 2 !== 0

    const { data: nextBracket } = await supabase
      .from('brackets')
      .select('id')
      .eq('tournament_id', bracket.tournament_id)
      .eq('round', nextRound)
      .eq('match_number', nextMatchNumber)
      .eq('is_third_place', false)
      .single()

    if (nextBracket) {
      const slotUpdate = isOdd ? { entrant1_id: winnerId } : { entrant2_id: winnerId }
      await supabase.from('brackets').update(slotUpdate).eq('id', nextBracket.id)
    }

    // If semifinal: advance LOSER to third place match
    if ((bracket.round as number) === totalRounds - 1 && totalRounds >= 3) {
      const loserId =
        (bracket.entrant1_id as string) === winnerId
          ? (bracket.entrant2_id as string)
          : (bracket.entrant1_id as string)

      if (loserId) {
        const { data: thirdPlaceBracket } = await supabase
          .from('brackets')
          .select('id, entrant1_id, entrant2_id')
          .eq('tournament_id', bracket.tournament_id as string)
          .eq('is_third_place', true)
          .single()

        if (thirdPlaceBracket) {
          const slot = thirdPlaceBracket.entrant1_id === null ? 'entrant1_id' : 'entrant2_id'
          await supabase.from('brackets').update({ [slot]: loserId }).eq('id', thirdPlaceBracket.id as string)
        }
      }
    }
  }

  await resolveMatchBets(bracketId, winnerId)

  // Check if all matches in this round are complete
  const { data: roundBrackets } = await supabase
    .from('brackets')
    .select('id, winner_id')
    .eq('tournament_id', bracket.tournament_id)
    .eq('round', bracket.round)

  const allComplete = roundBrackets?.every((b) => b.winner_id !== null) ?? false

  if (allComplete) {
    await generateRoundSettlement(
      bracket.tournament_id as string,
      bracket.round as number
    )
    // Tournament complete when the final round (which includes final + third place) all have winners
    if ((bracket.round as number) === totalRounds) {
      await supabase
        .from('tournaments')
        .update({ status: 'complete', updated_at: new Date().toISOString() })
        .eq('id', bracket.tournament_id)
    }
  }
}

// ── resolveMatchBets ───────────────────────────────────────────────────────

export async function resolveMatchBets(bracketId: string, winnerId: string): Promise<void> {
  const supabase = createSupabaseServerClient()

  // Fetch pending bet_matches for this bracket
  const { data: betMatches } = await supabase
    .from('bet_matches')
    .select('id, proposal_id, acceptor_character_id, acceptor_name, acceptor_isk_amount')
    .eq('bracket_id', bracketId)
    .eq('outcome', 'pending')

  if (betMatches && betMatches.length > 0) {
    // Batch-fetch proposals
    const proposalIds = betMatches.map((bm) => bm.proposal_id as string)
    const { data: proposals } = await supabase
      .from('bet_proposals')
      .select('id, proposer_character_id, proposer_name, predicted_winner_id, isk_amount')
      .in('id', proposalIds)

    const proposalMap = new Map(
      (proposals ?? []).map((p) => [p.id as string, p])
    )

    // Resolve each bet_match
    for (const bm of betMatches) {
      const proposal = proposalMap.get(bm.proposal_id as string)
      if (!proposal) continue
      const outcome =
        (proposal.predicted_winner_id as string) === winnerId
          ? 'proposer_won'
          : 'acceptor_won'
      await supabase
        .from('bet_matches')
        .update({ outcome, resolved_at: new Date().toISOString() })
        .eq('id', bm.id)
    }

    // Accumulate bettor_records updates
    type BettorAccum = {
      character_name: string
      total: number
      won: number
      lost: number
      wagered: number
      isk_won: number
      isk_lost: number
    }
    const bettorMap = new Map<number, BettorAccum>()

    function accum(
      charId: number,
      charName: string,
      won: boolean,
      wagered: number,
      winAmount: number
    ) {
      const ex = bettorMap.get(charId)
      if (ex) {
        ex.total += 1
        ex.wagered += wagered
        if (won) { ex.won += 1; ex.isk_won += winAmount }
        else { ex.lost += 1; ex.isk_lost += wagered }
      } else {
        bettorMap.set(charId, {
          character_name: charName,
          total: 1,
          won: won ? 1 : 0,
          lost: won ? 0 : 1,
          wagered,
          isk_won: won ? winAmount : 0,
          isk_lost: won ? 0 : wagered,
        })
      }
    }

    for (const bm of betMatches) {
      const proposal = proposalMap.get(bm.proposal_id as string)
      if (!proposal) continue
      const proposerWon = (proposal.predicted_winner_id as string) === winnerId
      const proposerStake = proposal.isk_amount as number
      const acceptorStake = bm.acceptor_isk_amount as number
      accum(
        proposal.proposer_character_id as number,
        proposal.proposer_name as string,
        proposerWon,
        proposerStake,
        acceptorStake
      )
      accum(
        bm.acceptor_character_id as number,
        bm.acceptor_name as string,
        !proposerWon,
        acceptorStake,
        proposerStake
      )
    }

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
        total_bets: ((ex?.total_bets as number) ?? 0) + stats.total,
        bets_won: ((ex?.bets_won as number) ?? 0) + stats.won,
        bets_lost: ((ex?.bets_lost as number) ?? 0) + stats.lost,
        total_isk_wagered: ((ex?.total_isk_wagered as number) ?? 0) + stats.wagered,
        total_isk_won: ((ex?.total_isk_won as number) ?? 0) + stats.isk_won,
        total_isk_lost: ((ex?.total_isk_lost as number) ?? 0) + stats.isk_lost,
        updated_at: new Date().toISOString(),
      }
    })

    if (upserts.length > 0) {
      await supabase
        .from('bettor_records')
        .upsert(upserts, { onConflict: 'character_id' })
    }
  }

  // Void open proposals that never got matched
  await supabase
    .from('bet_proposals')
    .update({ status: 'void', void_reason: 'Match concluded with no taker' })
    .eq('bracket_id', bracketId)
    .eq('status', 'open')
}

// ── generateRoundSettlement ────────────────────────────────────────────────

export async function generateRoundSettlement(
  tournamentId: string,
  round: number
): Promise<void> {
  const supabase = createSupabaseServerClient()

  // Idempotency: skip if already generated
  const { data: existing } = await supabase
    .from('settlements')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('round', round)
    .limit(1)

  if (existing && existing.length > 0) return

  // Get bracket IDs for this round
  const { data: brackets } = await supabase
    .from('brackets')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('round', round)

  const bracketIds = (brackets ?? []).map((b) => b.id as string)
  if (bracketIds.length === 0) return

  // Get resolved bet_matches for these brackets
  const { data: betMatches } = await supabase
    .from('bet_matches')
    .select('id, proposal_id, acceptor_character_id, acceptor_name, acceptor_isk_amount, outcome')
    .in('bracket_id', bracketIds)
    .in('outcome', ['proposer_won', 'acceptor_won'])

  if (!betMatches || betMatches.length === 0) return

  const proposalIds = betMatches.map((bm) => bm.proposal_id as string)
  const { data: proposals } = await supabase
    .from('bet_proposals')
    .select('id, proposer_character_id, proposer_name, isk_amount')
    .in('id', proposalIds)

  const proposalMap = new Map(
    (proposals ?? []).map((p) => [p.id as string, p])
  )

  // Build gross debt ledger
  type Debt = {
    fromId: number
    fromName: string
    toId: number
    toName: string
    amount: number
  }
  const debtMap = new Map<string, Debt>()

  function addDebt(
    fromId: number,
    fromName: string,
    toId: number,
    toName: string,
    amount: number
  ) {
    const key = `${fromId}_${toId}`
    const ex = debtMap.get(key)
    if (ex) {
      ex.amount += amount
    } else {
      debtMap.set(key, { fromId, fromName, toId, toName, amount })
    }
  }

  for (const bm of betMatches) {
    const proposal = proposalMap.get(bm.proposal_id as string)
    if (!proposal) continue
    if (bm.outcome === 'proposer_won') {
      addDebt(
        bm.acceptor_character_id as number,
        bm.acceptor_name as string,
        proposal.proposer_character_id as number,
        proposal.proposer_name as string,
        bm.acceptor_isk_amount as number
      )
    } else {
      addDebt(
        proposal.proposer_character_id as number,
        proposal.proposer_name as string,
        bm.acceptor_character_id as number,
        bm.acceptor_name as string,
        proposal.isk_amount as number
      )
    }
  }

  // Net out bilateral debts
  const processed = new Set<string>()
  const netDebts: Debt[] = []

  for (const [key, debt] of debtMap.entries()) {
    if (processed.has(key)) continue
    const reverseKey = `${debt.toId}_${debt.fromId}`
    processed.add(key)
    processed.add(reverseKey)

    const reverse = debtMap.get(reverseKey)
    if (reverse) {
      const net = debt.amount - reverse.amount
      if (net > 0) {
        netDebts.push({ fromId: debt.fromId, fromName: debt.fromName, toId: debt.toId, toName: debt.toName, amount: net })
      } else if (net < 0) {
        netDebts.push({ fromId: reverse.fromId, fromName: reverse.fromName, toId: reverse.toId, toName: reverse.toName, amount: -net })
      }
    } else {
      netDebts.push(debt)
    }
  }

  if (netDebts.length === 0) return

  await supabase.from('settlements').insert(
    netDebts.map((d) => ({
      tournament_id: tournamentId,
      round,
      from_character_id: d.fromId,
      from_character_name: d.fromName,
      to_character_id: d.toId,
      to_character_name: d.toName,
      isk_amount: d.amount,
    }))
  )
}

// ── getTournamentBracket ───────────────────────────────────────────────────

export async function getTournamentBracket(
  tournamentId: string
): Promise<BracketWithEntrants[]> {
  const supabase = createSupabaseServerClient()

  const [{ data: brackets }, { data: entrants }] = await Promise.all([
    supabase
      .from('brackets')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('round', { ascending: true })
      .order('match_number', { ascending: true }),
    supabase.from('entrants').select('*').eq('tournament_id', tournamentId),
  ])

  const entrantMap = new Map<string, Entrant>(
    (entrants ?? []).map((e) => [e.id as string, e as Entrant])
  )

  return (brackets ?? []).map((bracket) => {
    const entrant1 = bracket.entrant1_id
      ? (entrantMap.get(bracket.entrant1_id as string) ?? null)
      : null
    const entrant2 = bracket.entrant2_id
      ? (entrantMap.get(bracket.entrant2_id as string) ?? null)
      : null
    const winner = bracket.winner_id
      ? (entrantMap.get(bracket.winner_id as string) ?? null)
      : null

    const result: BracketWithEntrants = {
      id: bracket.id as string,
      tournament_id: bracket.tournament_id as string,
      round: bracket.round as number,
      match_number: bracket.match_number as number,
      is_bye: bracket.is_bye as boolean,
      is_third_place: (bracket.is_third_place as boolean) ?? false,
      locked: (bracket.locked as boolean) ?? false,
      killmail_id: bracket.killmail_id as number | null,
      killmail_url: bracket.killmail_url as string | null,
      scheduled_time: bracket.scheduled_time as string | null,
      completed_at: bracket.completed_at as string | null,
      entrant1,
      entrant2,
      winner,
    }

    if (!bracket.winner_id && entrant1 && entrant2) {
      result.odds = calculateOdds(entrant1, entrant2)
    }

    return result
  })
}
