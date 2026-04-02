// Run in Supabase SQL Editor:
// ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS paused BOOLEAN DEFAULT FALSE;
// ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS announcement TEXT;

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

const LEGAL_TRANSITIONS: Record<string, string[]> = {
  active: ["registration", "complete"],
  complete: ["active"],
  // registration→active is only allowed via generate endpoint
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!getAdmin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params

  let body: Record<string, unknown>
  try { body = await request.json() as Record<string, unknown> }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const supabase = createSupabaseServerClient()
  const { data: tournament } = await supabase.from("tournaments").select("id, status").eq("id", id).single()
  if (!tournament) return NextResponse.json({ error: "Tournament not found" }, { status: 404 })

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.name !== undefined) update.name = String(body.name).trim()
  if (body.paused !== undefined) update.paused = Boolean(body.paused)
  if (body.announcement !== undefined) update.announcement = body.announcement === null ? null : String(body.announcement)

  if (body.status !== undefined) {
    const newStatus = String(body.status)
    const currentStatus = tournament.status as string
    if (newStatus === "active" && currentStatus === "registration") {
      return NextResponse.json({ error: "Use the generate endpoint to start a tournament" }, { status: 400 })
    }
    const allowed = LEGAL_TRANSITIONS[currentStatus] ?? []
    if (!allowed.includes(newStatus)) {
      return NextResponse.json({ error: `Cannot transition from ${currentStatus} to ${newStatus}` }, { status: 400 })
    }
    update.status = newStatus
  }

  const { data: updated, error } = await supabase
    .from("tournaments").update(update).eq("id", id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tournament: updated })
}
