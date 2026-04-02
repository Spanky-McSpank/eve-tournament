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
      .select("id, outcome, proposer_name, acceptor_name, proposer_character_id, acceptor_character_id, proposer_stake, acceptor_stake, proposal_id, settled_note, created_at")
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
    proposals: allProposals,
    matches: allMatches,
    settlements: settlements ?? [],
  })
}
