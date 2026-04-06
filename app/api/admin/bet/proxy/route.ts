import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"
import { calculateOdds, calculateAcceptorStake } from "@/lib/odds"
import { isAdminRequest } from "@/lib/auth"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Admin access required — log in with an admin character" }, { status: 403 })

  let body: Record<string, unknown>
  try { body = (await request.json()) as Record<string, unknown> }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const { action, characterName, characterId, proposalId, bracketId, predictedWinnerId, iskAmount } = body

  if (!action || !characterName || !characterId) {
    return NextResponse.json({ error: "action, characterName, and characterId are required" }, { status: 400 })
  }
  const charId = Number(characterId)
  const charName = String(characterName)
  const supabase = createSupabaseServerClient()

  if (action === "propose") {
    if (!bracketId || !predictedWinnerId || iskAmount === undefined) {
      return NextResponse.json({ error: "bracketId, predictedWinnerId, and iskAmount required for propose" }, { status: 400 })
    }
    if (!UUID_RE.test(String(bracketId)) || !UUID_RE.test(String(predictedWinnerId))) {
      return NextResponse.json({ error: "Invalid UUID" }, { status: 400 })
    }
    const iskNum = Number(iskAmount)
    if (!Number.isInteger(iskNum) || iskNum < 10_000_000) {
      return NextResponse.json({ error: "Minimum bet is 10,000,000 ISK" }, { status: 400 })
    }

    const { data: bracket } = await supabase
      .from("brackets")
      .select("id, tournament_id, winner_id, entrant1_id, entrant2_id, locked")
      .eq("id", String(bracketId))
      .single()

    if (!bracket) return NextResponse.json({ error: "Match not found" }, { status: 404 })
    if (bracket.winner_id !== null) return NextResponse.json({ error: "Match is already complete" }, { status: 409 })
    if (!bracket.entrant1_id || !bracket.entrant2_id) {
      return NextResponse.json({ error: "Match participants not yet determined" }, { status: 409 })
    }
    if (bracket.entrant1_id !== String(predictedWinnerId) && bracket.entrant2_id !== String(predictedWinnerId)) {
      return NextResponse.json({ error: "predictedWinnerId is not a participant in this match" }, { status: 400 })
    }

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

    const { data: existing } = await supabase
      .from("bet_proposals")
      .select("id")
      .eq("bracket_id", String(bracketId))
      .eq("proposer_character_id", charId)
      .in("status", ["open", "matched"])
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: "Character already has an active proposal on this match" }, { status: 409 })
    }

    const { data: proposal, error: insertError } = await supabase
      .from("bet_proposals")
      .insert({
        tournament_id: bracket.tournament_id,
        bracket_id: String(bracketId),
        proposer_character_id: charId,
        proposer_name: charName,
        predicted_winner_id: String(predictedWinnerId),
        isk_amount: iskNum,
        implied_prob: impliedProb,
        status: "open",
        is_proxy: true,
      })
      .select()
      .single()

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
    return NextResponse.json({ proposal, acceptorStake })
  }

  if (action === "accept") {
    if (!proposalId || !UUID_RE.test(String(proposalId))) {
      return NextResponse.json({ error: "Valid proposalId required for accept" }, { status: 400 })
    }

    const { data: proposal } = await supabase
      .from("bet_proposals")
      .select("*")
      .eq("id", String(proposalId))
      .single()

    if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 })
    if ((proposal.status as string) !== "open") {
      return NextResponse.json({ error: "Proposal is no longer open" }, { status: 409 })
    }
    if ((proposal.proposer_character_id as number) === charId) {
      return NextResponse.json({ error: "Character cannot accept their own proposal" }, { status: 409 })
    }

    const { data: bracket } = await supabase
      .from("brackets")
      .select("id, winner_id, entrant1_id, entrant2_id")
      .eq("id", proposal.bracket_id as string)
      .single()

    if (!bracket || bracket.winner_id !== null) {
      return NextResponse.json({ error: "Match is no longer open" }, { status: 409 })
    }

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

    const { data: betMatch, error: matchError } = await supabase
      .from("bet_matches")
      .insert({
        proposal_id: String(proposalId),
        tournament_id: proposal.tournament_id,
        bracket_id: proposal.bracket_id,
        acceptor_character_id: charId,
        acceptor_name: charName,
        acceptor_winner_id: acceptorWinnerId,
        acceptor_isk_amount: acceptorStake,
        outcome: "pending",
        is_proxy: true,
      })
      .select()
      .single()

    if (matchError) return NextResponse.json({ error: matchError.message }, { status: 500 })

    await supabase
      .from("bet_proposals")
      .update({ status: "matched", locked_at: new Date().toISOString() })
      .eq("id", String(proposalId))

    return NextResponse.json({ match: betMatch, acceptorStake })
  }

  return NextResponse.json({ error: "action must be 'propose' or 'accept'" }, { status: 400 })
}
