import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"
import { calculateAcceptorStake } from "@/lib/odds"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tournamentId } = await params
  const supabase = createSupabaseServerClient()

  // Find current round: lowest round with incomplete matches that have both entrants
  const { data: brackets } = await supabase
    .from("brackets")
    .select("id, round, match_number, entrant1_id, entrant2_id, winner_id")
    .eq("tournament_id", tournamentId)
    .eq("is_bye", false)

  const openBrackets = (brackets ?? []).filter(
    (b) => !b.winner_id && b.entrant1_id && b.entrant2_id
  )

  if (openBrackets.length === 0) {
    return NextResponse.json({ proposals: [] })
  }

  const currentRound = Math.min(...openBrackets.map((b) => b.round as number))
  const currentBracketIds = openBrackets
    .filter((b) => b.round === currentRound)
    .map((b) => b.id as string)

  // Build bracket label map
  const bracketLabelMap = new Map(
    openBrackets
      .filter((b) => b.round === currentRound)
      .map((b) => [b.id as string, `R${b.round as number} M${b.match_number as number}`])
  )

  // Fetch open proposals for current round brackets
  const { data: proposals, error } = await supabase
    .from("bet_proposals")
    .select("*")
    .in("bracket_id", currentBracketIds)
    .eq("status", "open")
    .order("placed_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch entrant names for predicted_winner labels
  const winnerIds = [...new Set((proposals ?? []).map((p) => p.predicted_winner_id as string))]
  const { data: entrants } = winnerIds.length > 0
    ? await supabase.from("entrants").select("id, character_name").in("id", winnerIds)
    : { data: [] }

  const entrantNameMap = new Map((entrants ?? []).map((e) => [e.id as string, e.character_name as string]))

  const enriched = (proposals ?? []).map((p) => ({
    ...p,
    acceptorStake: calculateAcceptorStake(p.isk_amount as number, p.implied_prob as number),
    proposerPortraitUrl: `https://images.evetech.net/characters/${p.proposer_character_id as number}/portrait?size=32`,
    bracketLabel: bracketLabelMap.get(p.bracket_id as string) ?? "",
    predictedWinnerName: entrantNameMap.get(p.predicted_winner_id as string) ?? "",
  }))

  return NextResponse.json({ proposals: enriched })
}
