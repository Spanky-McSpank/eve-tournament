import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"
import type { PropBet, PropProposal, PropMatch, PropWithProposals } from "@/lib/props"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tournamentId } = await params
  const supabase = createSupabaseServerClient()

  const { data: propRows, error } = await supabase
    .from("prop_bets")
    .select("*")
    .eq("tournament_id", tournamentId)
    .in("status", ["approved", "locked", "resolved_yes", "resolved_no"])
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const props = (propRows ?? []) as PropBet[]

  if (props.length === 0) return NextResponse.json({ props: [] })

  const propIds = props.map((p) => p.id)

  const [{ data: proposalRows }, { data: matchRows }] = await Promise.all([
    supabase
      .from("prop_proposals")
      .select("*")
      .in("prop_id", propIds)
      .eq("status", "open"),
    supabase
      .from("prop_matches")
      .select("*")
      .in("prop_id", propIds),
  ])

  const proposals = (proposalRows ?? []) as PropProposal[]
  const matches = (matchRows ?? []) as PropMatch[]

  const proposalsByProp = new Map<string, PropProposal[]>()
  const matchesByProp = new Map<string, PropMatch[]>()

  for (const p of proposals) {
    const arr = proposalsByProp.get(p.prop_id) ?? []
    arr.push(p)
    proposalsByProp.set(p.prop_id, arr)
  }
  for (const m of matches) {
    const arr = matchesByProp.get(m.prop_id) ?? []
    arr.push(m)
    matchesByProp.set(m.prop_id, arr)
  }

  const result: PropWithProposals[] = props.map((prop) => {
    const propProposals = proposalsByProp.get(prop.id) ?? []
    const propMatches = matchesByProp.get(prop.id) ?? []

    const yesCount = propProposals.filter((p) => p.proposition === "yes").length
    const noCount = propProposals.filter((p) => p.proposition === "no").length
    const totalIskAtStake =
      propProposals.reduce((sum, p) => sum + p.isk_amount, 0) +
      propMatches.reduce((sum, m) => sum + m.acceptor_isk_amount, 0)

    return {
      ...prop,
      proposals: propProposals,
      matches: propMatches,
      yesCount,
      noCount,
      totalIskAtStake,
    }
  })

  return NextResponse.json({ props: result })
}
