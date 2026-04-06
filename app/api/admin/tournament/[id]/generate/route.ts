import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"
import { generateBracket, type Entrant } from "@/lib/bracket"
import { isAdminRequest } from "@/lib/auth"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Admin access required — log in with an admin character" }, { status: 403 })

  const { id } = await params
  const supabase = createSupabaseServerClient()

  const { data: entrants, error } = await supabase
    .from("entrants")
    .select("*")
    .eq("tournament_id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!entrants || entrants.length < 4) {
    return NextResponse.json({ error: "At least 4 entrants required to generate bracket" }, { status: 400 })
  }

  try {
    await generateBracket(id, entrants as Entrant[])
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 })
  }
}
