import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"

interface EveSession {
  character_id: number
  character_name: string
  expires_at: number
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tournamentId } = await params

  // Auth
  const raw = request.cookies.get("eve_session")?.value
  if (!raw) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  let session: EveSession
  try {
    session = JSON.parse(raw) as EveSession
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (Date.now() > session.expires_at) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 })
  }

  // Parse body
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { bracketId, predictedWinnerId, iskAmount } = body

  if (!bracketId || !predictedWinnerId || iskAmount === undefined) {
    return NextResponse.json({ error: "bracketId, predictedWinnerId, and iskAmount are required" }, { status: 400 })
  }
  if (!UUID_RE.test(String(bracketId)) || !UUID_RE.test(String(predictedWinnerId))) {
    return NextResponse.json({ error: "Invalid UUID format" }, { status: 400 })
  }
  const iskNum = Number(iskAmount)
  if (!Number.isInteger(iskNum) || iskNum <= 0) {
    return NextResponse.json({ error: "iskAmount must be a positive integer" }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()

  // Validate bracket exists, is open, and predictedWinnerId is a valid slot
  const { data: bracket } = await supabase
    .from("brackets")
    .select("id, winner_id, entrant1_id, entrant2_id")
    .eq("id", String(bracketId))
    .single()

  if (!bracket) return NextResponse.json({ error: "Match not found" }, { status: 404 })
  if (bracket.winner_id !== null) return NextResponse.json({ error: "Match is already complete" }, { status: 409 })
  if (bracket.entrant1_id !== String(predictedWinnerId) && bracket.entrant2_id !== String(predictedWinnerId)) {
    return NextResponse.json({ error: "predictedWinnerId is not a participant in this match" }, { status: 400 })
  }

  // Check for duplicate bet
  const { data: existing } = await supabase
    .from("bets")
    .select("id")
    .eq("bracket_id", String(bracketId))
    .eq("bettor_character_id", session.character_id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: "You have already bet on this match" }, { status: 409 })
  }

  // Insert bet
  const { data: bet, error: insertError } = await supabase
    .from("bets")
    .insert({
      tournament_id: tournamentId,
      bracket_id: String(bracketId),
      bettor_character_id: session.character_id,
      bettor_name: session.character_name,
      predicted_winner_id: String(predictedWinnerId),
      isk_amount: iskNum,
      outcome: "pending",
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, bet })
}
