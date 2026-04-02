// Run in Supabase SQL Editor:
// ALTER TABLE entrants ADD COLUMN IF NOT EXISTS manually_seeded BOOLEAN DEFAULT FALSE;

import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"
import { isAdminRequest } from "@/lib/auth"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params

  let body: Record<string, unknown>
  try { body = await request.json() as Record<string, unknown> }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const supabase = createSupabaseServerClient()
  const { data: entrant } = await supabase.from("entrants").select("*").eq("id", id).single()
  if (!entrant) return NextResponse.json({ error: "Entrant not found" }, { status: 404 })

  const update: Record<string, unknown> = {}
  if (body.character_name !== undefined) update.character_name = String(body.character_name)
  if (body.corporation_name !== undefined) update.corporation_name = body.corporation_name
  if (body.alliance_name !== undefined) update.alliance_name = body.alliance_name
  if (body.seed !== undefined) update.seed = Number(body.seed)
  if (body.manually_seeded !== undefined) update.manually_seeded = Boolean(body.manually_seeded)

  // ISK fields — recalculate efficiency if provided
  const iskFields = ["kills_30d", "losses_30d", "isk_destroyed_30d", "isk_lost_30d"]
  let recalcEff = false
  for (const f of iskFields) {
    if (body[f] !== undefined) { update[f] = Number(body[f]); recalcEff = true }
  }
  if (recalcEff) {
    const destroyed = Number(update.isk_destroyed_30d ?? entrant.isk_destroyed_30d)
    const lost = Number(update.isk_lost_30d ?? entrant.isk_lost_30d)
    const total = destroyed + lost
    update.efficiency = total > 0 ? destroyed / total : 0
  }

  if (Object.keys(update).length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 })

  const { data: updated, error } = await supabase
    .from("entrants").update(update).eq("id", id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entrant: updated })
}
