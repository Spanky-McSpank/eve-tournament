import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"

interface EveSession {
  character_id: number
  character_name: string
  expires_at: number
}

function parseSession(request: NextRequest): EveSession | null {
  const raw = request.cookies.get("eve_session")?.value
  if (!raw) return null
  try {
    const s = JSON.parse(raw) as EveSession
    return Date.now() > s.expires_at ? null : s
  } catch { return null }
}

export async function POST(request: NextRequest) {
  const session = parseSession(request)

  let body: Record<string, unknown>
  try { body = (await request.json()) as Record<string, unknown> }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const {
    tournamentId,
    title,
    description,
    category,
    targetCharacterId,
    targetCharacterName,
    resolutionCondition,
    submitterName,
  } = body

  if (!tournamentId || !title || !category) {
    return NextResponse.json({ error: "tournamentId, title, and category are required" }, { status: 400 })
  }

  const validCategories = [
    "tournament_winner", "reaches_final", "reaches_semifinal",
    "reaches_top4", "round1_elimination", "match_duration",
    "isk_destroyed", "custom",
  ]
  if (!validCategories.includes(String(category))) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 })
  }

  const characterId = session?.character_id ?? 0
  const characterName = session?.character_name ?? (submitterName ? String(submitterName) : "Anonymous")

  const supabase = createSupabaseServerClient()

  const { data: prop, error } = await supabase
    .from("prop_bets")
    .insert({
      tournament_id: String(tournamentId),
      created_by_character_id: characterId,
      created_by_name: characterName,
      title: String(title),
      description: description ? String(description) : null,
      category: String(category),
      target_character_id: targetCharacterId ? Number(targetCharacterId) : null,
      target_character_name: targetCharacterName ? String(targetCharacterName) : null,
      resolution_condition: resolutionCondition ? String(resolutionCondition) : null,
      yes_prob: 0.5,
      status: "pending_approval",
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ prop })
}
