import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createSupabaseServerClient()

  const { data: entrants, error } = await supabase
    .from("entrants")
    .select("*")
    .eq("tournament_id", id)
    .order("seed", { ascending: true, nullsFirst: false })
    .order("registered_at", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entrants: entrants ?? [] })
}
