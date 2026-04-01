import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"
import { getCharacterPublicInfo, getCharacterPortrait, getKillboardStats } from "@/lib/esi"

interface EveSession {
  character_id: number
  character_name: string
  expires_at: number
}

async function fetchCorpName(corporationId: number): Promise<string | null> {
  try {
    const res = await fetch(`https://esi.evetech.net/latest/corporations/${corporationId}/`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    const data = await res.json() as { name?: string }
    return data.name ?? null
  } catch { return null }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tournamentId } = await params

  const raw = request.cookies.get("eve_session")?.value
  if (!raw) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let session: EveSession
  try { session = JSON.parse(raw) as EveSession }
  catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  if (Date.now() > session.expires_at) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 })
  }

  const supabase = createSupabaseServerClient()

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, status, entrant_count")
    .eq("id", tournamentId)
    .single()

  if (!tournament) return NextResponse.json({ error: "Tournament not found" }, { status: 404 })
  if (tournament.status !== "registration") {
    return NextResponse.json({ error: "Registration is closed" }, { status: 409 })
  }

  const { count: currentCount } = await supabase
    .from("entrants")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId)

  if ((currentCount ?? 0) >= (tournament.entrant_count as number)) {
    return NextResponse.json({ error: "Tournament is full" }, { status: 409 })
  }

  const [publicInfo, portrait, stats] = await Promise.all([
    getCharacterPublicInfo(session.character_id),
    getCharacterPortrait(session.character_id),
    getKillboardStats(session.character_id),
  ])

  const corpName = await fetchCorpName(publicInfo.corporation_id)
  const totalISK = stats.isk_destroyed_30d + stats.isk_lost_30d
  const efficiency = totalISK > 0 ? stats.isk_destroyed_30d / totalISK : 0

  const { data: entrant, error: insertError } = await supabase
    .from("entrants")
    .insert({
      tournament_id: tournamentId,
      character_id: session.character_id,
      character_name: session.character_name,
      corporation_name: corpName,
      portrait_url: portrait.px64x64,
      kills_30d: stats.kills_30d,
      losses_30d: stats.losses_30d,
      isk_destroyed_30d: stats.isk_destroyed_30d,
      isk_lost_30d: stats.isk_lost_30d,
      efficiency,
    })
    .select()
    .single()

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "You are already registered in this tournament" }, { status: 409 })
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ entrant })
}
