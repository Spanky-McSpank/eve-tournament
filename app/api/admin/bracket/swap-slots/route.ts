import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"
import { isAdminRequest } from "@/lib/auth"

// Swaps an entrant between two bracket slots.
// Body: { bracketId1, slot1 ("entrant1"|"entrant2"), bracketId2, slot2 ("entrant1"|"entrant2") }
// Neither bracket may have a winner.
export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await request.json() as Record<string, unknown> }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const { bracketId1, slot1, bracketId2, slot2 } = body
  if (!bracketId1 || !slot1 || !bracketId2 || !slot2) {
    return NextResponse.json({ error: "bracketId1, slot1, bracketId2, slot2 are required" }, { status: 400 })
  }
  if (!["entrant1", "entrant2"].includes(String(slot1)) || !["entrant1", "entrant2"].includes(String(slot2))) {
    return NextResponse.json({ error: "slot must be 'entrant1' or 'entrant2'" }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()

  const [{ data: b1 }, { data: b2 }] = await Promise.all([
    supabase.from("brackets").select("id, entrant1_id, entrant2_id, winner_id, tournament_id").eq("id", String(bracketId1)).single(),
    supabase.from("brackets").select("id, entrant1_id, entrant2_id, winner_id, tournament_id").eq("id", String(bracketId2)).single(),
  ])

  if (!b1) return NextResponse.json({ error: "Bracket 1 not found" }, { status: 404 })
  if (!b2) return NextResponse.json({ error: "Bracket 2 not found" }, { status: 404 })
  if (b1.winner_id) return NextResponse.json({ error: "Bracket 1 already has a winner" }, { status: 409 })
  if (b2.winner_id) return NextResponse.json({ error: "Bracket 2 already has a winner" }, { status: 409 })
  if ((b1.tournament_id as string) !== (b2.tournament_id as string)) {
    return NextResponse.json({ error: "Brackets must be in the same tournament" }, { status: 400 })
  }

  const field1 = `${String(slot1)}_id` as "entrant1_id" | "entrant2_id"
  const field2 = `${String(slot2)}_id` as "entrant1_id" | "entrant2_id"

  const val1 = b1[field1] as string | null
  const val2 = b2[field2] as string | null

  await Promise.all([
    supabase.from("brackets").update({ [field1]: val2 }).eq("id", b1.id as string),
    supabase.from("brackets").update({ [field2]: val1 }).eq("id", b2.id as string),
  ])

  const { data: updated1 } = await supabase.from("brackets").select("*").eq("id", b1.id as string).single()
  const { data: updated2 } = await supabase.from("brackets").select("*").eq("id", b2.id as string).single()
  return NextResponse.json({ brackets: [updated1, updated2] })
}
