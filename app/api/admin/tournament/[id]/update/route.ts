// Run in Supabase SQL Editor:
// ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS paused BOOLEAN DEFAULT FALSE;
// ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS announcement TEXT;

import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"
import { isAdminRequest, getSessionCharacter } from "@/lib/auth"

const LEGAL_TRANSITIONS: Record<string, string[]> = {
  active: ["registration", "complete"],
  complete: ["active"],
  // registration→active is only allowed via generate endpoint
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSessionCharacter(request)
  console.log("[admin/tournament/update] session:", JSON.stringify(session), "isAdmin:", session?.isAdmin)
  if (!session?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
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

  // Tournament rules fields
  const rulesFields = [
    "ship_class", "ship_restrictions", "banned_ships", "engagement_rules",
    "system_name", "fitting_restrictions", "additional_rules", "discord_webhook_url",
  ] as const
  for (const field of rulesFields) {
    if (body[field] !== undefined) {
      update[field] = body[field] === null || body[field] === "" ? null : String(body[field])
    }
  }
  if (body.system_id !== undefined) {
    update.system_id = body.system_id === null ? null : Number(body.system_id)
  }
  if (body.scheduled_start !== undefined) {
    update.scheduled_start = body.scheduled_start === null || body.scheduled_start === "" ? null : String(body.scheduled_start)
  }
  if (body.minutes_per_match !== undefined) {
    update.minutes_per_match = body.minutes_per_match === null ? null : Number(body.minutes_per_match)
  }
  if (body.current_round !== undefined) {
    update.current_round = Number(body.current_round)
  }

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
