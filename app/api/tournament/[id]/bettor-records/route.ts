import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tournamentId } = await params
  const supabase = createSupabaseServerClient()

  // Collect character IDs from proposers and acceptors in this tournament
  const [{ data: proposers }, { data: acceptors }] = await Promise.all([
    supabase
      .from("bet_proposals")
      .select("proposer_character_id")
      .eq("tournament_id", tournamentId),
    supabase
      .from("bet_matches")
      .select("acceptor_character_id")
      .eq("tournament_id", tournamentId),
  ])

  const characterIds = [
    ...new Set([
      ...(proposers ?? []).map((p) => p.proposer_character_id as number),
      ...(acceptors ?? []).map((a) => a.acceptor_character_id as number),
    ]),
  ]

  if (characterIds.length === 0) {
    return NextResponse.json({ records: [] })
  }

  const { data: records, error } = await supabase
    .from("bettor_records")
    .select("*")
    .in("character_id", characterIds)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const sorted = (records ?? []).sort((a, b) => {
    const aRate = (a.total_bets as number) > 0 ? (a.bets_won as number) / (a.total_bets as number) : 0
    const bRate = (b.total_bets as number) > 0 ? (b.bets_won as number) / (b.total_bets as number) : 0
    if (bRate !== aRate) return bRate - aRate
    return (b.total_bets as number) - (a.total_bets as number)
  })

  return NextResponse.json({ records: sorted })
}
