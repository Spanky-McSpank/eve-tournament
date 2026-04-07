import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"
import { isAdminRequest } from "@/lib/auth"

// Assigns or clears a specific slot (entrant1 or entrant2) in a bracket.
// Body: { slot: "entrant1" | "entrant2", entrantId: string | null }
// Bracket must not already have a winner.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Admin access required — log in with an admin character" }, { status: 403 })
  const { id: bracketId } = await params

  let body: { slot: string; entrantId: string | null }
  try { body = await request.json() as typeof body }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const { slot, entrantId } = body
  if (!["entrant1", "entrant2"].includes(slot)) {
    return NextResponse.json({ error: "slot must be 'entrant1' or 'entrant2'" }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()

  const { data: bracket } = await supabase
    .from("brackets")
    .select("id, winner_id, tournament_id")
    .eq("id", bracketId)
    .single()

  if (!bracket) return NextResponse.json({ error: "Bracket not found" }, { status: 404 })
  if (bracket.winner_id) return NextResponse.json({ error: "Cannot modify a completed bracket" }, { status: 409 })

  const field = `${slot}_id` as "entrant1_id" | "entrant2_id"
  const { data: updated, error } = await supabase
    .from("brackets")
    .update({ [field]: entrantId ?? null })
    .eq("id", bracketId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ bracket: updated })
}
