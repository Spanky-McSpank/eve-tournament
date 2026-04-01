import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"

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

  const { proposalId, reason } = body
  if (!proposalId) return NextResponse.json({ error: "proposalId is required" }, { status: 400 })

  const supabase = createSupabaseServerClient()

  const { data: proposal } = await supabase
    .from("bet_proposals")
    .select("id, status")
    .eq("id", String(proposalId))
    .single()

  if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 })
  if ((proposal.status as string) === "void") {
    return NextResponse.json({ error: "Already voided" }, { status: 409 })
  }

  // If matched, also void the bet_match
  if ((proposal.status as string) === "matched") {
    await supabase
      .from("bet_matches")
      .update({ outcome: "void" })
      .eq("proposal_id", String(proposalId))
      .eq("outcome", "pending")
  }

  await supabase
    .from("bet_proposals")
    .update({
      status: "void",
      void_reason: reason ? String(reason) : "Voided by admin",
    })
    .eq("id", String(proposalId))

  return NextResponse.json({ success: true })
}
