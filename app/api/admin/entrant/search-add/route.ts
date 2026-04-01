import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"
import {
  searchCharacterByName,
  getCharacterPublicInfo,
  getCharacterPortrait,
  getKillboardStats,
} from "@/lib/esi"

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

export async function POST(request: NextRequest) {
  if (!getAdmin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: Record<string, unknown>
  try { body = (await request.json()) as Record<string, unknown> }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const { characterName, tournamentId } = body
  if (!characterName || typeof characterName !== "string") {
    return NextResponse.json({ error: "characterName is required" }, { status: 400 })
  }
  if (!tournamentId || typeof tournamentId !== "string") {
    return NextResponse.json({ error: "tournamentId is required" }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()

  // Validate tournament
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, status, entrant_count")
    .eq("id", tournamentId)
    .single()

  if (!tournament) return NextResponse.json({ error: "Tournament not found" }, { status: 404 })
  if (tournament.status !== "registration") {
    return NextResponse.json({ error: "Tournament is not open for registration" }, { status: 409 })
  }

  // Search ESI
  const searchResult = await searchCharacterByName(characterName.trim())
  if (!searchResult) {
    return NextResponse.json({ error: `Character "${characterName}" not found` }, { status: 404 })
  }

  const [publicInfo, portrait, stats] = await Promise.all([
    getCharacterPublicInfo(searchResult.character_id),
    getCharacterPortrait(searchResult.character_id),
    getKillboardStats(searchResult.character_id),
  ])

  const corpName = await fetchCorpName(publicInfo.corporation_id)
  const totalISK = stats.isk_destroyed_30d + stats.isk_lost_30d
  const efficiency = totalISK > 0 ? stats.isk_destroyed_30d / totalISK : 0

  const { data: entrant, error: insertError } = await supabase
    .from("entrants")
    .insert({
      tournament_id: tournamentId,
      character_id: searchResult.character_id,
      character_name: searchResult.character_name,
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
      return NextResponse.json({ error: "Character is already registered in this tournament" }, { status: 409 })
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ entrant })
}
