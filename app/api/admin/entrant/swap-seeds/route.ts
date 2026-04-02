import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"
import { isAdminRequest } from "@/lib/auth"

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await request.json() as Record<string, unknown> }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const { entrantId1, entrantId2 } = body
  if (!entrantId1 || !entrantId2) {
    return NextResponse.json({ error: "entrantId1 and entrantId2 are required" }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()
  const { data: entrants } = await supabase
    .from("entrants").select("id, seed, tournament_id")
    .in("id", [String(entrantId1), String(entrantId2)])

  if (!entrants || entrants.length !== 2) {
    return NextResponse.json({ error: "One or both entrants not found" }, { status: 404 })
  }

  const [e1, e2] = entrants
  if ((e1.tournament_id as string) !== (e2.tournament_id as string)) {
    return NextResponse.json({ error: "Entrants must be in the same tournament" }, { status: 400 })
  }

  const { data: tournament } = await supabase
    .from("tournaments").select("status").eq("id", e1.tournament_id as string).single()
  if (tournament?.status !== "registration") {
    return NextResponse.json({ error: "Seed swaps only allowed during registration" }, { status: 409 })
  }

  await Promise.all([
    supabase.from("entrants").update({ seed: e2.seed, manually_seeded: true }).eq("id", e1.id as string),
    supabase.from("entrants").update({ seed: e1.seed, manually_seeded: true }).eq("id", e2.id as string),
  ])

  const { data: updated } = await supabase
    .from("entrants").select("*").in("id", [String(entrantId1), String(entrantId2)])
  return NextResponse.json({ entrants: updated })
}
