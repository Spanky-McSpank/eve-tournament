import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"

export async function GET() {
  const supabase = createSupabaseServerClient()

  const { data: tournaments, error } = await supabase
    .from("tournaments")
    .select("id, name, status, entrant_count, created_at")
    .order("status", { ascending: true }) // registration first alphabetically, then active, complete
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const list = tournaments ?? []

  // Fetch entrant counts
  const { data: entrantRows } = await supabase
    .from("entrants")
    .select("tournament_id")
    .in("tournament_id", list.map((t) => t.id))

  const countMap = new Map<string, number>()
  for (const row of entrantRows ?? []) {
    const tid = row.tournament_id as string
    countMap.set(tid, (countMap.get(tid) ?? 0) + 1)
  }

  const enriched = list.map((t) => ({ ...t, currentEntrants: countMap.get(t.id) ?? 0 }))

  // Sort: registration + active first, then complete
  const sorted = [
    ...enriched.filter((t) => t.status !== "complete"),
    ...enriched.filter((t) => t.status === "complete"),
  ]

  return NextResponse.json({ tournaments: sorted })
}
