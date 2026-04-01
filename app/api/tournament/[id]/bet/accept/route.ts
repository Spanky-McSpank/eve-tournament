import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"
import { calculateAcceptorStake } from "@/lib/odds"

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
  { params: _params }: { params: Promise<{ id: string }> }
) {
  const session = parseSession(request)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: Record<string, unknown>
  try { body = (await request.json()) as Record<string, unknown> }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const { proposalId } = body
  if (!proposalId || !UUID_RE.test(String(proposalId))) {
    return NextResponse.json({ error: "Valid proposalId is required" }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()

  // Fetch proposal
  const { data: proposal } = await supabase
    .from("bet_proposals")
    .select("*")
    .eq("id", String(proposalId))
    .single()

  if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 })
  if ((proposal.status as string) !== "open") {
    return NextResponse.json({ error: "Proposal is no longer open" }, { status: 409 })
  }
  if ((proposal.proposer_character_id as number) === session.character_id) {
    return NextResponse.json({ error: "Cannot accept your own proposal" }, { status: 409 })
  }

  // Validate match is still open
  const { data: bracket } = await supabase
    .from("brackets")
    .select("id, winner_id, entrant1_id, entrant2_id, locked")
    .eq("id", proposal.bracket_id as string)
    .single()

  if (!bracket) return NextResponse.json({ error: "Match not found" }, { status: 404 })
  if (bracket.winner_id !== null) return NextResponse.json({ error: "Match is already complete" }, { status: 409 })
  if (bracket.locked) return NextResponse.json({ error: "Betting is locked for this match" }, { status: 409 })

  // Ensure acceptor hasn't already accepted a bet on this bracket
  const { data: existingAccept } = await supabase
    .from("bet_matches")
    .select("id")
    .eq("bracket_id", proposal.bracket_id as string)
    .eq("acceptor_character_id", session.character_id)
    .maybeSingle()

  if (existingAccept) {
    return NextResponse.json({ error: "You have already accepted a bet on this match" }, { status: 409 })
  }

  // Determine acceptor's fighter (the opposite of proposer's pick)
  const acceptorWinnerId =
    bracket.entrant1_id === (proposal.predicted_winner_id as string)
      ? bracket.entrant2_id
      : bracket.entrant1_id

  if (!acceptorWinnerId) {
    return NextResponse.json({ error: "Match participants not yet determined" }, { status: 409 })
  }

  const acceptorStake = calculateAcceptorStake(
    proposal.isk_amount as number,
    proposal.implied_prob as number
  )

  // Insert bet_match
  const { data: betMatch, error: matchError } = await supabase
    .from("bet_matches")
    .insert({
      proposal_id: String(proposalId),
      tournament_id: proposal.tournament_id,
      bracket_id: proposal.bracket_id,
      acceptor_character_id: session.character_id,
      acceptor_name: session.character_name,
      acceptor_winner_id: acceptorWinnerId,
      acceptor_isk_amount: acceptorStake,
      outcome: "pending",
      is_proxy: false,
    })
    .select()
    .single()

  if (matchError) return NextResponse.json({ error: matchError.message }, { status: 500 })

  // Mark proposal as matched
  await supabase
    .from("bet_proposals")
    .update({ status: "matched", locked_at: new Date().toISOString() })
    .eq("id", String(proposalId))

  return NextResponse.json({ match: betMatch, acceptorStake })
}
