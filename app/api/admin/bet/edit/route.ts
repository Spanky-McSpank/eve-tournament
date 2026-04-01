import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"
import { calculateAcceptorStake } from "@/lib/odds"

interface EveSession {
  character_id: number
  expires_at: number
}

function getAdmin(request: NextRequest): boolean {
  const raw = request.cookies.get("eve_session")?.value
  if (!raw) return false
  try {
    const session = JSON.parse(raw) as EveSession
    if (Date.now() > session.expires_at) return false
    const ids = (process.env.ADMIN_CHARACTER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean)
    return ids.includes(String(session.character_id))
  } catch { return false }
}

export async function POST(request: NextRequest) {
  if (!getAdmin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: Record<string, unknown>
  try { body = (await request.json()) as Record<string, unknown> }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const { proposalId, newIskAmount } = body
  if (!proposalId || newIskAmount === undefined) {
    return NextResponse.json({ error: "proposalId and newIskAmount are required" }, { status: 400 })
  }
  const iskNum = Number(newIskAmount)
  if (!Number.isInteger(iskNum) || iskNum < 10_000_000) {
    return NextResponse.json({ error: "Minimum bet is 10,000,000 ISK" }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()

  const { data: proposal } = await supabase
    .from("bet_proposals")
    .select("id, status, implied_prob")
    .eq("id", String(proposalId))
    .single()

  if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 })
  if ((proposal.status as string) !== "open") {
    return NextResponse.json({ error: "Can only edit open proposals" }, { status: 409 })
  }

  const acceptorStake = calculateAcceptorStake(iskNum, proposal.implied_prob as number)

  const { data: updated, error } = await supabase
    .from("bet_proposals")
    .update({ isk_amount: iskNum })
    .eq("id", String(proposalId))
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ proposal: updated, acceptorStake })
}
