import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tournamentId } = await params
  const supabase = createSupabaseServerClient()

  const { data: settlements, error } = await supabase
    .from("settlements")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("round", { ascending: true })
    .order("created_at", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Group by round
  const byRound: Record<number, typeof settlements> = {}
  for (const s of settlements ?? []) {
    const r = s.round as number
    if (!byRound[r]) byRound[r] = []
    byRound[r].push(s)
  }

  return NextResponse.json({ settlements: settlements ?? [], byRound })
}
