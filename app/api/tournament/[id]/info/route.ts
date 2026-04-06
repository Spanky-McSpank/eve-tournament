import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createSupabaseServerClient()

  const [{ data: tournament }, { data: activeProps }, { data: recentProps }] = await Promise.all([
    supabase
      .from("tournaments")
      .select(
        "id, name, status, entrant_count, ship_class, ship_restrictions, banned_ships, engagement_rules, system_name, system_id, fitting_restrictions, additional_rules, announcement, scheduled_start, current_round"
      )
      .eq("id", id)
      .single(),
    supabase
      .from("prop_bets")
      .select("*")
      .eq("tournament_id", id)
      .eq("status", "approved")
      .order("created_at", { ascending: false }),
    supabase
      .from("prop_bets")
      .select("*")
      .eq("tournament_id", id)
      .in("status", ["resolved_yes", "resolved_no"])
      .order("resolved_at", { ascending: false })
      .limit(3),
  ])

  if (!tournament) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({
    tournament,
    activeProps: activeProps ?? [],
    recentlyResolvedProps: recentProps ?? [],
  })
}
