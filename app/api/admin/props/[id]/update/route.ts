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

  const supabase = createSupabaseServerClient()

  // Fetch current prop
  const { data: prop } = await supabase
    .from("prop_bets")
    .select("id, status")
    .eq("id", propId)
    .single()

  if (!prop) return NextResponse.json({ error: "Prop not found" }, { status: 404 })

  const status = prop.status as string
  if (status === "resolved_yes" || status === "resolved_no" || status === "void") {
    return NextResponse.json({ error: "Cannot update a resolved or voided prop" }, { status: 409 })
  }

  const { title, description, yesProb, locksAtRound, locksAt, status: newStatus } = body

  const updateData: Record<string, unknown> = {}
  if (title !== undefined) updateData.title = String(title)
  if (description !== undefined) updateData.description = description ? String(description) : null
  if (yesProb !== undefined) updateData.yes_prob = Math.max(0.01, Math.min(0.99, Number(yesProb)))
  if (locksAtRound !== undefined) updateData.locks_at_round = locksAtRound ? Number(locksAtRound) : null
  if (locksAt !== undefined) updateData.locks_at = locksAt ? String(locksAt) : null
  if (newStatus !== undefined) {
    const validStatuses = ["pending_approval", "approved", "locked"]
    if (!validStatuses.includes(String(newStatus))) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }
    updateData.status = String(newStatus)
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  const { data: updated, error } = await supabase
    .from("prop_bets")
    .update(updateData)
    .eq("id", propId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ prop: updated })
}
