import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"

interface EveSession {
  character_id: number
  expires_at: number
}

function getAdmin(request: NextRequest): boolean {
  const raw = request.cookies.get("eve_session")?.value
  if (!raw) return false
  try {
    const session = JSON.parse(raw) as EveSession
    if (Date.now() > session.expires_at) return false
    const ids = (process.env.ADMIN_CHARACTER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean)
    return ids.includes(String(session.character_id))
  } catch { return false }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; settlementId: string }> }
) {
  if (!getAdmin(request)) return NextResponse.json({ error: "Admin access required — log in with an admin character" }, { status: 403 })
  const { id: tournamentId, settlementId } = await params
  const supabase = createSupabaseServerClient()

  const { data: settlement } = await supabase
    .from("settlements")
    .select("id, tournament_id, is_paid")
    .eq("id", settlementId)
    .eq("tournament_id", tournamentId)
    .single()

  if (!settlement) return NextResponse.json({ error: "Settlement not found" }, { status: 404 })
  if (settlement.is_paid) return NextResponse.json({ error: "Already marked as paid" }, { status: 409 })

  const { data: updated, error } = await supabase
    .from("settlements")
    .update({ is_paid: true, paid_at: new Date().toISOString() })
    .eq("id", settlementId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settlement: updated })
}
