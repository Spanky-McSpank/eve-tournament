import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"
import { isAdminRequest } from "@/lib/auth"

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: Record<string, unknown>
  try { body = (await request.json()) as Record<string, unknown> }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const { betMatchId, winner, reason } = body
  if (!betMatchId) return NextResponse.json({ error: "betMatchId is required" }, { status: 400 })
  if (winner !== "proposer" && winner !== "acceptor") {
    return NextResponse.json({ error: "winner must be 'proposer' or 'acceptor'" }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()

  // Fetch match with proposal info
  const { data: match } = await supabase
    .from("bet_matches")
    .select("id, outcome, tournament_id, proposal_id, proposer_character_id, proposer_name, acceptor_character_id, acceptor_name, proposer_stake, acceptor_stake")
    .eq("id", String(betMatchId))
    .single()

  if (!match) return NextResponse.json({ error: "Bet match not found" }, { status: 404 })
  if ((match.outcome as string) !== "pending") {
    return NextResponse.json({ error: "Match is not pending" }, { status: 409 })
  }

  const winnerId = winner === "proposer" ? match.proposer_character_id : match.acceptor_character_id
  const winnerName = winner === "proposer" ? match.proposer_name : match.acceptor_name
  const loserId = winner === "proposer" ? match.acceptor_character_id : match.proposer_character_id
  const winnerStake = winner === "proposer" ? (match.proposer_stake as number) : (match.acceptor_stake as number)
  const loserStake = winner === "proposer" ? (match.acceptor_stake as number) : (match.proposer_stake as number)
  const payout = winnerStake + loserStake

  // Update bet_match outcome
  await supabase
    .from("bet_matches")
    .update({
      outcome: winner === "proposer" ? "proposer_wins" : "acceptor_wins",
      settled_note: reason ? String(reason) : "Force-settled by admin",
    })
    .eq("id", String(betMatchId))

  // Update proposal status
  await supabase
    .from("bet_proposals")
    .update({ status: "settled" })
    .eq("id", String(match.proposal_id))

  // Update bettor_records for winner (upsert)
  const { data: winnerRecord } = await supabase
    .from("bettor_records")
    .select("id, total_isk_won, total_isk_lost, bets_won, bets_lost")
    .eq("tournament_id", String(match.tournament_id))
    .eq("character_id", winnerId as number)
    .single()

  if (winnerRecord) {
    await supabase
      .from("bettor_records")
      .update({
        total_isk_won: ((winnerRecord.total_isk_won as number) ?? 0) + payout,
        bets_won: ((winnerRecord.bets_won as number) ?? 0) + 1,
      })
      .eq("id", winnerRecord.id as string)
  } else {
    await supabase
      .from("bettor_records")
      .insert({
        tournament_id: match.tournament_id,
        character_id: winnerId,
        character_name: winnerName,
        total_isk_won: payout,
        total_isk_lost: 0,
        bets_won: 1,
        bets_lost: 0,
      })
  }

  // Update bettor_records for loser (upsert)
  const { data: loserRecord } = await supabase
    .from("bettor_records")
    .select("id, total_isk_won, total_isk_lost, bets_won, bets_lost")
    .eq("tournament_id", String(match.tournament_id))
    .eq("character_id", loserId as number)
    .single()

  const loserName = winner === "proposer" ? match.acceptor_name : match.proposer_name

  if (loserRecord) {
    await supabase
      .from("bettor_records")
      .update({
        total_isk_lost: ((loserRecord.total_isk_lost as number) ?? 0) + loserStake,
        bets_lost: ((loserRecord.bets_lost as number) ?? 0) + 1,
      })
      .eq("id", loserRecord.id as string)
  } else {
    await supabase
      .from("bettor_records")
      .insert({
        tournament_id: match.tournament_id,
        character_id: loserId,
        character_name: loserName,
        total_isk_won: 0,
        total_isk_lost: loserStake,
        bets_won: 0,
        bets_lost: 1,
      })
  }

  return NextResponse.json({ success: true, winnerId, payout })
}
