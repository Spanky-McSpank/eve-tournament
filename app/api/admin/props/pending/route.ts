import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"
import { isAdminRequest } from "@/lib/auth"

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const tournamentId = searchParams.get("tournamentId")

  const supabase = createSupabaseServerClient()

  let query = supabase
    .from("prop_bets")
    .select("*")
    .eq("status", "pending_approval")
    .order("created_at", { ascending: false })

  if (tournamentId) {
    query = query.eq("tournament_id", tournamentId)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ props: data ?? [] })
}
