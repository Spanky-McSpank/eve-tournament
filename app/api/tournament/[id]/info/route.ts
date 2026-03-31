import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createSupabaseServerClient()
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name, status, entrant_count")
    .eq("id", id)
    .single()

  if (!tournament) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ tournament })
}
