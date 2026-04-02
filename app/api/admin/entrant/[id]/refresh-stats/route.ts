import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"
import { getKillboardStats } from "@/lib/esi"
import { isAdminRequest } from "@/lib/auth"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params

  const supabase = createSupabaseServerClient()
  const { data: entrant } = await supabase
    .from("entrants").select("id, character_id").eq("id", id).single()
  if (!entrant) return NextResponse.json({ error: "Entrant not found" }, { status: 404 })

  const stats = await getKillboardStats(entrant.character_id as number)
  const total = stats.isk_destroyed_30d + stats.isk_lost_30d
  const efficiency = total > 0 ? stats.isk_destroyed_30d / total : 0

  const { data: updated, error } = await supabase
    .from("entrants")
    .update({
      kills_30d: stats.kills_30d,
      losses_30d: stats.losses_30d,
      isk_destroyed_30d: stats.isk_destroyed_30d,
      isk_lost_30d: stats.isk_lost_30d,
      efficiency,
    })
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entrant: updated })
}
