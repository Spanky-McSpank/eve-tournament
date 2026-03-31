import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tournamentId } = await params
  const supabase = createSupabaseServerClient()

  // Get character IDs that have placed bets in this tournament
  const { data: bets } = await supabase
    .from("bets")
    .select("bettor_character_id")
    .eq("tournament_id", tournamentId)

  if (!bets || bets.length === 0) {
    return NextResponse.json({ records: [] })
  }

  const characterIds = [...new Set(bets.map((b) => b.bettor_character_id as number))]

  // Fetch their bettor_records
  const { data: records, error } = await supabase
    .from("bettor_records")
    .select("*")
    .in("character_id", characterIds)
    .order("bets_won", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Sort by win rate DESC (secondary: total bets DESC)
  const sorted = (records ?? []).sort((a, b) => {
    const aRate = a.total_bets > 0 ? a.bets_won / a.total_bets : 0
    const bRate = b.total_bets > 0 ? b.bets_won / b.total_bets : 0
    if (bRate !== aRate) return bRate - aRate
    return (b.total_bets as number) - (a.total_bets as number)
  })

  return NextResponse.json({ records: sorted })
}
