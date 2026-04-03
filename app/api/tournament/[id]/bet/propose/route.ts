// NOTE: Run this in Supabase SQL editor before using this route:
// ALTER TABLE brackets ADD COLUMN IF NOT EXISTS locked BOOLEAN DEFAULT FALSE;

import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"
import { calculateOdds, calculateAcceptorStake } from "@/lib/odds"

interface EveSession {
  character_id: number
  character_name: string
  expires_at: number
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function parseSession(request: NextRequest): EveSession | null {
  const raw = request.cookies.get("eve_session")?.value
  if (!raw) return null
  try {
    const s = JSON.parse(raw) as EveSession
    return Date.now() > s.expires_at ? null : s
  } catch { return null }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tournamentId } = await params
  const session = parseSession(request)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: Record<string, unknown>
  try { body = (await request.json()) as Record<string, unknown> }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const { bracketId, predictedWinnerId, iskAmount } = body
  if (!bracketId || !predictedWinnerId || iskAmount === undefined) {
    return NextResponse.json({ error: "bracketId, predictedWinnerId, and iskAmount are required" }, { status: 400 })
  }
  if (!UUID_RE.test(String(bracketId)) || !UUID_RE.test(String(predictedWinnerId))) {
    return NextResponse.json({ error: "Invalid UUID" }, { status: 400 })
  }
  const iskNum = Number(iskAmount)
  if (!Number.isInteger(iskNum) || iskNum < 10_000_000) {
    return NextResponse.json({ error: "Minimum bet is 10,000,000 ISK" }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()

  // Validate bracket
  const { data: bracket } = await supabase
    .from("brackets")
    .select("id, winner_id, entrant1_id, entrant2_id, locked")
    .eq("id", String(bracketId))
    .single()

  if (!bracket) return NextResponse.json({ error: "Match not found" }, { status: 404 })
  if (bracket.winner_id !== null) return NextResponse.json({ error: "Match is already complete" }, { status: 409 })
  if (bracket.locked) return NextResponse.json({ error: "Betting has been closed for this match by the administrator." }, { status: 409 })
  if (bracket.entrant1_id !== String(predictedWinnerId) && bracket.entrant2_id !== String(predictedWinnerId)) {
    return NextResponse.json({ error: "predictedWinnerId is not a participant in this match" }, { status: 400 })
  }
  if (!bracket.entrant1_id || !bracket.entrant2_id) {
    return NextResponse.json({ error: "Match participants not yet determined" }, { status: 409 })
  }

  // Fetch entrants for odds
  const { data: entrants } = await supabase
    .from("entrants")
    .select("*")
    .in("id", [bracket.entrant1_id, bracket.entrant2_id])

  const e1 = entrants?.find((e) => e.id === bracket.entrant1_id)
  const e2 = entrants?.find((e) => e.id === bracket.entrant2_id)
  if (!e1 || !e2) return NextResponse.json({ error: "Entrant data missing" }, { status: 500 })

  const odds = calculateOdds(e1, e2)
  const impliedProb =
    String(predictedWinnerId) === bracket.entrant1_id
      ? odds.entrant1.impliedProb
      : odds.entrant2.impliedProb

  const acceptorStake = calculateAcceptorStake(iskNum, impliedProb)

  // One proposal per character per match (open or matched)
  const { data: existing } = await supabase
    .from("bet_proposals")
    .select("id")
    .eq("bracket_id", String(bracketId))
    .eq("proposer_character_id", session.character_id)
    .in("status", ["open", "matched"])
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: "You already have an active proposal on this match" }, { status: 409 })
  }

  const { data: proposal, error: insertError } = await supabase
    .from("bet_proposals")
    .insert({
      tournament_id: tournamentId,
      bracket_id: String(bracketId),
      proposer_character_id: session.character_id,
      proposer_name: session.character_name,
      predicted_winner_id: String(predictedWinnerId),
      isk_amount: iskNum,
      implied_prob: impliedProb,
      status: "open",
      is_proxy: false,
    })
    .select()
    .single()

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  return NextResponse.json({ proposal, acceptorStake })
}
