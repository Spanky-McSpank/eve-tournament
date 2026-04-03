import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"
import { isAdminRequest, getSessionCharacter } from "@/lib/auth"

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const session = getSessionCharacter(request)

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
    targetValue,
    resolutionCondition,
    yesProb,
    locksAtRound,
    locksAt,
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

  const yesProbNum = typeof yesProb === "number"
    ? Math.max(0.01, Math.min(0.99, yesProb))
    : 0.5

  const supabase = createSupabaseServerClient()

  const { data: prop, error } = await supabase
    .from("prop_bets")
    .insert({
      tournament_id: String(tournamentId),
      created_by_character_id: session?.character_id ?? 0,
      created_by_name: session?.character_name ?? "Admin",
      title: String(title),
      description: description ? String(description) : null,
      category: String(category),
      target_character_id: targetCharacterId ? Number(targetCharacterId) : null,
      target_character_name: targetCharacterName ? String(targetCharacterName) : null,
      target_value: targetValue ? String(targetValue) : null,
      resolution_condition: resolutionCondition ? String(resolutionCondition) : null,
      yes_prob: yesProbNum,
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by_name: session?.character_name ?? "Admin",
      locks_at_round: locksAtRound ? Number(locksAtRound) : null,
      locks_at: locksAt ? String(locksAt) : null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ prop })
}
