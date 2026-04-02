import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"

interface EveSession { character_id: number; expires_at: number }

function getAdmin(request: NextRequest): boolean {
  const raw = request.cookies.get("eve_session")?.value
  if (!raw) return false
  try {
    const s = JSON.parse(raw) as EveSession
    if (Date.now() > s.expires_at) return false
    return (process.env.ADMIN_CHARACTER_IDS ?? "").split(",").map((x) => x.trim()).includes(String(s.character_id))
  } catch { return false }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!getAdmin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id: bracketId } = await params

  let body: Record<string, unknown>
  try { body = await request.json() as Record<string, unknown> }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const supabase = createSupabaseServerClient()
  const { data: bracket } = await supabase
    .from("brackets").select("id").eq("id", bracketId).single()
  if (!bracket) return NextResponse.json({ error: "Bracket not found" }, { status: 404 })

  // scheduledTime can be an ISO string or null to clear
  const scheduledTime = body.scheduledTime === null ? null : body.scheduledTime !== undefined ? String(body.scheduledTime) : undefined
  if (scheduledTime === undefined) {
    return NextResponse.json({ error: "scheduledTime is required (ISO string or null)" }, { status: 400 })
  }

  const { data: updated, error } = await supabase
    .from("brackets")
    .update({ scheduled_time: scheduledTime })
    .eq("id", bracketId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ bracket: updated })
}
