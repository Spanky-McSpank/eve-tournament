import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"
import { isAdminRequest } from "@/lib/auth"

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Admin access required — log in with an admin character" }, { status: 403 })

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
