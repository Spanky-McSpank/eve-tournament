import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"
import { isAdminRequest } from "@/lib/auth"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const supabase = createSupabaseServerClient()

  const [
    { data: proposals },
    { data: matches },
    { data: settlements },
  ] = await Promise.all([
    supabase
      .from("bet_proposals")
      .select("id, status, isk_amount, implied_prob, proposer_name, proposer_character_id, predicted_winner_id, bracket_id, is_proxy, void_reason, created_at")
      .eq("tournament_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("bet_matches")
      .select("id, outcome, proposer_name, acceptor_name, proposer_character_id, acceptor_character_id, proposer_stake, acceptor_stake, acceptor_winner_id, proposal_id, settled_note, created_at")
      .eq("tournament_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("settlements")
      .select("id, from_character_name, to_character_name, isk_amount, is_paid, round, created_at")
      .eq("tournament_id", id)
      .order("round", { ascending: true }),
  ])

  const allProposals = proposals ?? []
  const allMatches = matches ?? []

  // Enrich proposals with bracket round/match_number and entrant names
  const bracketIds = [...new Set(allProposals.map((p) => p.bracket_id as string).filter(Boolean))]
  const entrantIds = [...new Set([
    ...allProposals.map((p) => p.predicted_winner_id as string),
    ...allMatches.map((m) => m.acceptor_winner_id as string),
  ].filter(Boolean))]

  const [{ data: brackets }, { data: entrantRows }] = await Promise.all([
    bracketIds.length > 0
      ? supabase.from("brackets").select("id, round, match_number").in("id", bracketIds)
      : Promise.resolve({ data: [] as Array<{ id: string; round: number; match_number: number }> }),
    entrantIds.length > 0
      ? supabase.from("entrants").select("id, character_name, portrait_url").in("id", entrantIds)
      : Promise.resolve({ data: [] as Array<{ id: string; character_name: string; portrait_url: string | null }> }),
  ])

  const bracketMap = Object.fromEntries((brackets ?? []).map((b) => [b.id, b]))
  const entrantMap = Object.fromEntries((entrantRows ?? []).map((e) => [e.id, e]))

  const enrichedProposals = allProposals.map((p) => ({
    ...p,
    bracket_round: (bracketMap[p.bracket_id as string] as { round?: number } | undefined)?.round ?? null,
    bracket_match_number: (bracketMap[p.bracket_id as string] as { match_number?: number } | undefined)?.match_number ?? null,
    predicted_winner_name: (entrantMap[p.predicted_winner_id as string] as { character_name?: string } | undefined)?.character_name ?? null,
    predicted_winner_portrait: (entrantMap[p.predicted_winner_id as string] as { portrait_url?: string | null } | undefined)?.portrait_url ?? null,
  }))

  const enrichedMatches = allMatches.map((m) => ({
    ...m,
    acceptor_winner_name: (entrantMap[m.acceptor_winner_id as string] as { character_name?: string } | undefined)?.character_name ?? null,
  }))

  const totalProposals = allProposals.length
  const matched = allProposals.filter((p) => p.status === "matched" || p.status === "settled").length
  const open = allProposals.filter((p) => p.status === "open").length
  const voided = allProposals.filter((p) => p.status === "void").length
  const pendingResolution = allMatches.filter((m) => m.outcome === "pending").length
  const totalIskInPlay = allMatches
    .filter((m) => m.outcome === "pending")
    .reduce((sum, m) => sum + ((m.proposer_stake as number) ?? 0) + ((m.acceptor_stake as number) ?? 0), 0)

  return NextResponse.json({
    summary: {
      totalProposals,
      matched,
      open,
      voided,
      pendingResolution,
      totalIskInPlay,
    },
    proposals: enrichedProposals,
    matches: enrichedMatches,
    settlements: settlements ?? [],
  })
}
