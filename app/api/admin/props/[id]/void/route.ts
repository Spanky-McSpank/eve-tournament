import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"
import { isAdminRequest } from "@/lib/auth"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: propId } = await params

  let body: Record<string, unknown>
  try { body = (await request.json()) as Record<string, unknown> }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const { reason } = body
  if (!reason || !String(reason).trim()) {
    return NextResponse.json({ error: "reason is required" }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()

  const { data: updated, error } = await supabase
    .from("prop_bets")
    .update({ status: "void", void_reason: String(reason).trim() })
    .eq("id", propId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!updated) return NextResponse.json({ error: "Prop not found" }, { status: 404 })

  // Void all open proposals
  await supabase
    .from("prop_proposals")
    .update({ status: "void", void_reason: `Prop voided: ${String(reason).trim()}` })
    .eq("prop_id", propId)
    .eq("status", "open")

  // Void all pending matches
  await supabase
    .from("prop_matches")
    .update({ outcome: "void" })
    .eq("prop_id", propId)
    .eq("outcome", "pending")

  return NextResponse.json({ prop: updated })
}
