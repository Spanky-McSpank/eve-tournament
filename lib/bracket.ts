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

  const nextRound = (bracket.round as number) + 1
  const nextMatchNumber = Math.ceil((bracket.match_number as number) / 2)
  const isOdd = (bracket.match_number as number) % 2 !== 0

  const { data: nextBracket } = await supabase
    .from('brackets')
    .select('id')
    .eq('tournament_id', bracket.tournament_id)
    .eq('round', nextRound)
    .eq('match_number', nextMatchNumber)
    .single()

  if (nextBracket) {
    const slotUpdate = isOdd ? { entrant1_id: winnerId } : { entrant2_id: winnerId }
    await supabase.from('brackets').update(slotUpdate).eq('id', nextBracket.id)
  }

  await resolveBets(bracketId, winnerId)

  const { data: roundBrackets } = await supabase
    .from('brackets')
    .select('id, winner_id')
    .eq('tournament_id', bracket.tournament_id)
    .eq('round', bracket.round)

  const allComplete = roundBrackets?.every((b) => b.winner_id !== null) ?? false
  if (allComplete && roundBrackets?.length === 1) {
    await supabase
      .from('tournaments')
      .update({ status: 'complete', updated_at: new Date().toISOString() })
      .eq('id', bracket.tournament_id)
  }
}

// ── resolveBets ────────────────────────────────────────────────────────────

export async function resolveBets(bracketId: string, winnerId: string): Promise<void> {
  const supabase = createSupabaseServerClient()

  const { data: bets } = await supabase
    .from('bets')
    .select('*')
    .eq('bracket_id', bracketId)
    .eq('outcome', 'pending')

  if (!bets || bets.length === 0) return

  const wonIds = bets.filter((b) => b.predicted_winner_id === winnerId).map((b) => b.id as string)
  const lostIds = bets.filter((b) => b.predicted_winner_id !== winnerId).map((b) => b.id as string)

  if (wonIds.length > 0) await supabase.from('bets').update({ outcome: 'won' }).in('id', wonIds)
  if (lostIds.length > 0) await supabase.from('bets').update({ outcome: 'lost' }).in('id', lostIds)

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

  for (const bet of bets) {
    const isWon = bet.predicted_winner_id === winnerId
    const amount = bet.isk_amount as number
    const cid = bet.bettor_character_id as number
    const existing = bettorMap.get(cid)
    if (existing) {
      existing.total += 1
      existing.wagered += amount
      if (isWon) { existing.won += 1; existing.isk_won += amount }
      else { existing.lost += 1; existing.isk_lost += amount }
    } else {
      bettorMap.set(cid, {
        character_name: bet.bettor_name as string,
        total: 1,
        won: isWon ? 1 : 0,
        lost: isWon ? 0 : 1,
        wagered: amount,
        isk_won: isWon ? amount : 0,
        isk_lost: isWon ? 0 : amount,
      })
    }
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

  await supabase.from('bettor_records').upsert(upserts, { onConflict: 'character_id' })
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
