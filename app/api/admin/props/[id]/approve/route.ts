import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"
import { isAdminRequest, getSessionCharacter } from "@/lib/auth"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: propId } = await params
  const session = getSessionCharacter(request)

  let body: Record<string, unknown>
  try { body = (await request.json()) as Record<string, unknown> }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const { yesProb } = body

  const supabase = createSupabaseServerClient()

  const updateData: Record<string, unknown> = {
    status: "approved",
    approved_at: new Date().toISOString(),
    approved_by_name: session?.character_name ?? "Admin",
  }

  if (yesProb !== undefined) {
    updateData.yes_prob = Math.max(0.01, Math.min(0.99, Number(yesProb)))
  }

  const { data: prop, error } = await supabase
    .from("prop_bets")
    .update(updateData)
    .eq("id", propId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!prop) return NextResponse.json({ error: "Prop not found" }, { status: 404 })

  return NextResponse.json({ prop })
}
