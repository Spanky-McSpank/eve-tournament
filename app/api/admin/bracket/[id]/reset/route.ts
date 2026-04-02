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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!getAdmin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id: bracketId } = await params

  const supabase = createSupabaseServerClient()
  const { data: bracket } = await supabase
    .from("brackets")
    .select("*")
    .eq("id", bracketId)
    .single()

  if (!bracket) return NextResponse.json({ error: "Bracket not found" }, { status: 404 })

  const previousWinnerId = bracket.winner_id as string | null

  // Remove winner from next-round slot if they had advanced
  if (previousWinnerId) {
    const nextRound = (bracket.round as number) + 1
    const nextMatchNumber = Math.ceil((bracket.match_number as number) / 2)
    const isOdd = (bracket.match_number as number) % 2 !== 0

    const { data: nextBracket } = await supabase
      .from("brackets")
      .select("id, entrant1_id, entrant2_id, winner_id")
      .eq("tournament_id", bracket.tournament_id as string)
      .eq("round", nextRound)
      .eq("match_number", nextMatchNumber)
      .single()

    if (nextBracket && !nextBracket.winner_id) {
      const slotField = isOdd ? "entrant1_id" : "entrant2_id"
      const currentSlot = isOdd ? nextBracket.entrant1_id : nextBracket.entrant2_id
      if (currentSlot === previousWinnerId) {
        await supabase.from("brackets").update({ [slotField]: null }).eq("id", nextBracket.id as string)
      }
    }
  }

  // Re-open all bet_matches for this bracket
  await supabase
    .from("bet_matches")
    .update({ outcome: "pending", resolved_at: null })
    .eq("bracket_id", bracketId)

  // Re-open voided proposals for this bracket
  await supabase
    .from("bet_proposals")
    .update({ status: "open", void_reason: null })
    .eq("bracket_id", bracketId)
    .eq("void_reason", "Match concluded with no taker")

  // Reset the bracket to pending
  const { data: updated, error } = await supabase
    .from("brackets")
    .update({
      winner_id: null,
      completed_at: null,
      killmail_id: null,
      killmail_url: null,
      override_reason: null,
      locked: false,
    })
    .eq("id", bracketId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ bracket: updated })
}
