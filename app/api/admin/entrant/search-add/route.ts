import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"
import {
  searchCharacterByName,
  getCharacterPublicInfo,
  getCharacterPortrait,
  getKillboardStats,
} from "@/lib/esi"
import { isAdminRequest } from "@/lib/auth"
import { fillEmptyBracketSlot } from "@/lib/bracket"

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
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Admin access required — log in with an admin character" }, { status: 403 })

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
  if (tournament.status === "complete") {
    return NextResponse.json({ error: "Tournament is already complete" }, { status: 409 })
  }

  // Manual add (characterId provided directly, skip ESI name search)
  const isManual = body.manual === true && body.characterId !== undefined
  let characterId: number

  if (isManual) {
    characterId = Number(body.characterId)
    if (!characterId || isNaN(characterId)) {
      return NextResponse.json({ error: "characterId must be a valid number for manual add" }, { status: 400 })
    }
  } else {
    // Search ESI by name
    const searchResult = await searchCharacterByName(characterName.trim())
    if (!searchResult) {
      return NextResponse.json({ error: `Character "${characterName}" not found on ESI` }, { status: 404 })
    }
    characterId = searchResult.character_id
  }

  const [publicInfo, portrait, stats] = await Promise.all([
    getCharacterPublicInfo(characterId).catch(() => null),
    getCharacterPortrait(characterId).catch(() => ({ px64x64: null, px128x128: null, px256x256: null, px512x512: null })),
    getKillboardStats(characterId),
  ])

  const corpName = publicInfo ? await fetchCorpName(publicInfo.corporation_id) : null
  const resolvedName = publicInfo?.name ?? characterName.trim()
  const totalISK = stats.isk_destroyed_30d + stats.isk_lost_30d
  const efficiency = totalISK > 0 ? stats.isk_destroyed_30d / totalISK : 0

  const { data: entrant, error: insertError } = await supabase
    .from("entrants")
    .insert({
      tournament_id: tournamentId,
      character_id: characterId,
      character_name: resolvedName,
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

  // If tournament is active, try to fill an empty bracket slot
  let bracketSlot: { filled: boolean; bracketId?: string } = { filled: false }
  if (tournament.status === "active" && entrant) {
    bracketSlot = await fillEmptyBracketSlot(tournamentId, entrant.id as string).catch(() => ({ filled: false }))
    if (!bracketSlot.filled) {
      // Entrant added but no empty slot — warn caller
      return NextResponse.json({ entrant, warning: "No empty bracket slot available — pilot added to roster but not placed in bracket. Remove an entrant or use Force Advance." })
    }
  }

  return NextResponse.json({ entrant, ...(bracketSlot.bracketId ? { bracketId: bracketSlot.bracketId } : {}) })
}
