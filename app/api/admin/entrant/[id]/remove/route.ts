import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"
import { isAdminRequest } from "@/lib/auth"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id: entrantId } = await params

  const supabase = createSupabaseServerClient()
  const { data: entrant } = await supabase
    .from("entrants").select("id, tournament_id").eq("id", entrantId).single()
  if (!entrant) return NextResponse.json({ error: "Entrant not found" }, { status: 404 })

  const { data: tournament } = await supabase
    .from("tournaments").select("id, status").eq("id", entrant.tournament_id as string).single()

  if (tournament?.status !== "registration") {
    // Bracket is generated — find their slot
    const { data: brackets } = await supabase
      .from("brackets")
      .select("id, entrant1_id, entrant2_id, winner_id, round, match_number, tournament_id")
      .eq("tournament_id", entrant.tournament_id as string)
      .or(`entrant1_id.eq.${entrantId},entrant2_id.eq.${entrantId}`)
      .is("winner_id", null)

    for (const b of brackets ?? []) {
      if (b.winner_id) continue

      const isSlot1 = b.entrant1_id === entrantId
      const opponentId = isSlot1 ? b.entrant2_id : b.entrant1_id

      if (opponentId) {
        // Auto-advance opponent as winner
        await supabase.from("brackets").update({
          winner_id: opponentId,
          completed_at: new Date().toISOString(),
          is_bye: true,
        }).eq("id", b.id as string)

        // Advance to next round
        const nextMatchNumber = Math.ceil((b.match_number as number) / 2)
        const isOdd = (b.match_number as number) % 2 !== 0
        const { data: nextBracket } = await supabase
          .from("brackets").select("id")
          .eq("tournament_id", b.tournament_id as string)
          .eq("round", (b.round as number) + 1)
          .eq("match_number", nextMatchNumber)
          .single()
        if (nextBracket) {
          const slot = isOdd ? { entrant1_id: opponentId } : { entrant2_id: opponentId }
          await supabase.from("brackets").update(slot).eq("id", nextBracket.id as string)
        }
      } else {
        // No opponent — just null out the slot
        const slotClear = isSlot1 ? { entrant1_id: null } : { entrant2_id: null }
        await supabase.from("brackets").update(slotClear).eq("id", b.id as string)
      }
    }
  }

  await supabase.from("entrants").delete().eq("id", entrantId)
  return NextResponse.json({ success: true })
}
