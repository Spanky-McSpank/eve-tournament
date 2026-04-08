import { NextRequest, NextResponse } from "next/server"
import { isAdminRequest } from "@/lib/auth"
import { advanceWinner } from "@/lib/bracket"
import { createSupabaseServerClient } from "@/lib/supabase"

interface MatchResolution {
  bracketId: string
  action: "advance" | "void"
  winnerId?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Admin access required — log in with an admin character" }, { status: 403 })
  }
  const { id: tournamentId } = await params

  let body: { round?: number; matchResolutions?: MatchResolution[] }
  try { body = await request.json() as typeof body }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const { round, matchResolutions } = body
  if (!round || !Array.isArray(matchResolutions)) {
    return NextResponse.json({ error: "round and matchResolutions are required" }, { status: 400 })
  }

  console.log('=== force-advance called ===', { tournamentId, round, matchResolutions })

  const supabase = createSupabaseServerClient()

  for (const resolution of matchResolutions) {
    console.log('Processing resolution:', resolution)
    if (resolution.action === "void") {
      await supabase
        .from("brackets")
        .update({ completed_at: new Date().toISOString(), match_status: "void" })
        .eq("id", resolution.bracketId)
      console.log('Voided bracket:', resolution.bracketId)
    } else if (resolution.action === "advance" && resolution.winnerId) {
      try {
        await advanceWinner(resolution.bracketId, resolution.winnerId)
        console.log('advanceWinner completed for:', resolution.bracketId)
      } catch (e) {
        console.error('advanceWinner failed for:', resolution.bracketId, e)
        /* continue with remaining matches */
      }
    }
  }

  // Advance tournament's current_round counter
  await supabase
    .from("tournaments")
    .update({ current_round: round + 1, updated_at: new Date().toISOString() })
    .eq("id", tournamentId)

  return NextResponse.json({ success: true, nextRound: round + 1 })
}
