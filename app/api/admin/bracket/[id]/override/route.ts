import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"
import { advanceWinner } from "@/lib/bracket"
import { isAdminRequest } from "@/lib/auth"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Admin access required — log in with an admin character" }, { status: 403 })
  const { id: bracketId } = await params

  let body: Record<string, unknown>
  try { body = await request.json() as Record<string, unknown> }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const { newWinnerId, overrideReason, killmailUrl } = body
  if (!newWinnerId) return NextResponse.json({ error: "newWinnerId is required" }, { status: 400 })

  const supabase = createSupabaseServerClient()
  const { data: bracket } = await supabase
    .from("brackets")
    .select("*")
    .eq("id", bracketId)
    .single()

  if (!bracket) return NextResponse.json({ error: "Bracket not found" }, { status: 404 })

  const previousWinnerId = bracket.winner_id as string | null

  // If there was a previous winner, reverse their advancement
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
      // Only clear the slot if the previous winner is actually in it
      const slotField = isOdd ? "entrant1_id" : "entrant2_id"
      const currentSlot = isOdd ? nextBracket.entrant1_id : nextBracket.entrant2_id
      if (currentSlot === previousWinnerId) {
        await supabase.from("brackets").update({ [slotField]: null }).eq("id", nextBracket.id as string)
      }
    }

    // Re-open resolved bet_matches so advanceWinner can re-resolve them
    await supabase
      .from("bet_matches")
      .update({ outcome: "pending", resolved_at: null })
      .eq("bracket_id", bracketId)
      .in("outcome", ["proposer_won", "acceptor_won"])

    // Re-open proposals that were voided due to this match concluding
    await supabase
      .from("bet_proposals")
      .update({ status: "open", void_reason: null })
      .eq("bracket_id", bracketId)
      .eq("void_reason", "Match concluded with no taker")

    // Clear the bracket winner so advanceWinner can set it fresh
    await supabase
      .from("brackets")
      .update({ winner_id: null, completed_at: null, killmail_id: null, killmail_url: null })
      .eq("id", bracketId)
  }

  // Store override_reason
  if (overrideReason) {
    await supabase
      .from("brackets")
      .update({ override_reason: String(overrideReason) })
      .eq("id", bracketId)
  }

  await advanceWinner(bracketId, String(newWinnerId), killmailUrl ? String(killmailUrl) : undefined)

  const { data: updated } = await supabase.from("brackets").select("*").eq("id", bracketId).single()
  return NextResponse.json({ bracket: updated })
}
