import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"
import { isAdminRequest, getSessionCharacter } from "@/lib/auth"
import { resolveAllPropMatches } from "@/lib/props"
import { sendDiscordPropResolved } from "@/lib/discord"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: propId } = await params
  const session = getSessionCharacter(request)

  let body: Record<string, unknown>
  try { body = (await request.json()) as Record<string, unknown> }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const { resolution, note } = body

  if (!resolution || !note) {
    return NextResponse.json({ error: "resolution and note are required" }, { status: 400 })
  }
  if (resolution !== "yes" && resolution !== "no") {
    return NextResponse.json({ error: "resolution must be 'yes' or 'no'" }, { status: 400 })
  }
  if (String(note).trim().length < 5) {
    return NextResponse.json({ error: "note must be at least 5 characters" }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()

  // Fetch prop
  const { data: prop } = await supabase
    .from("prop_bets")
    .select("*")
    .eq("id", propId)
    .single()

  if (!prop) return NextResponse.json({ error: "Prop not found" }, { status: 404 })

  const resolvedStatus = resolution === "yes" ? "resolved_yes" : "resolved_no"

  const { data: updated, error } = await supabase
    .from("prop_bets")
    .update({
      status: resolvedStatus,
      resolved_at: new Date().toISOString(),
      resolved_by_name: session?.character_name ?? "Admin",
      resolution_note: String(note).trim(),
    })
    .eq("id", propId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await resolveAllPropMatches(supabase, propId, resolvedStatus)

  // Try to send Discord notification — ignore failures
  try {
    // Fetch tournament name
    const { data: tournament } = await supabase
      .from("tournaments")
      .select("name")
      .eq("id", prop.tournament_id as string)
      .single()

    // Calculate total ISK at stake from matches
    const { data: matches } = await supabase
      .from("prop_matches")
      .select("acceptor_isk_amount")
      .eq("prop_id", propId)

    const { data: proposals } = await supabase
      .from("prop_proposals")
      .select("isk_amount")
      .eq("prop_id", propId)

    const totalIsk =
      (matches ?? []).reduce((s, m) => s + (m.acceptor_isk_amount as number), 0) +
      (proposals ?? []).reduce((s, p) => s + (p.isk_amount as number), 0)

    await sendDiscordPropResolved({
      tournamentName: tournament?.name ?? "Unknown Tournament",
      propTitle: prop.title as string,
      resolution: resolution === "yes" ? "YES" : "NO",
      note: String(note).trim(),
      iskAtStake: totalIsk,
    })
  } catch {
    // Non-critical — ignore
  }

  return NextResponse.json({ prop: updated })
}
