import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"
import { calcPropAcceptorStake } from "@/lib/props"

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
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tournamentId } = await params
  const session = parseSession(request)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: Record<string, unknown>
  try { body = (await request.json()) as Record<string, unknown> }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const { proposalId } = body
  if (!proposalId) {
    return NextResponse.json({ error: "proposalId is required" }, { status: 400 })
  }
  if (!UUID_RE.test(String(proposalId))) {
    return NextResponse.json({ error: "Invalid proposalId UUID" }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()

  // Fetch proposal
  const { data: proposal } = await supabase
    .from("prop_proposals")
    .select("id, prop_id, proposer_character_id, proposer_name, proposition, isk_amount, implied_prob, status")
    .eq("id", String(proposalId))
    .single()

  if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 })
  if ((proposal.status as string) !== "open") {
    return NextResponse.json({ error: "Proposal is not open" }, { status: 409 })
  }
  if ((proposal.proposer_character_id as number) === session.character_id) {
    return NextResponse.json({ error: "Cannot accept your own proposal" }, { status: 409 })
  }

  // Fetch prop to verify it's still approved
  const { data: prop } = await supabase
    .from("prop_bets")
    .select("id, status, yes_prob")
    .eq("id", proposal.prop_id as string)
    .single()

  if (!prop) return NextResponse.json({ error: "Prop not found" }, { status: 404 })
  if (prop.status !== "approved") {
    return NextResponse.json({ error: "This prop is no longer open for betting" }, { status: 409 })
  }

  const acceptorIsk = calcPropAcceptorStake(
    proposal.isk_amount as number,
    proposal.implied_prob as number
  )

  // Insert prop_match
  const { data: match, error: matchError } = await supabase
    .from("prop_matches")
    .insert({
      proposal_id: String(proposalId),
      prop_id: proposal.prop_id as string,
      tournament_id: tournamentId,
      acceptor_character_id: session.character_id,
      acceptor_name: session.character_name,
      acceptor_isk_amount: acceptorIsk,
      outcome: "pending",
      is_proxy: false,
    })
    .select()
    .single()

  if (matchError) return NextResponse.json({ error: matchError.message }, { status: 500 })

  // Update proposal status to matched
  await supabase
    .from("prop_proposals")
    .update({ status: "matched" })
    .eq("id", String(proposalId))

  return NextResponse.json({ match })
}
