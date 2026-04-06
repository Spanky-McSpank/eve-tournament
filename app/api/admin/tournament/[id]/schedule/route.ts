import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"
import { getSessionCharacter } from "@/lib/auth"

interface ScheduleBody {
  scheduledStart: string   // ISO timestamp (UTC)
  minutesPerMatch: number
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSessionCharacter(request)
  if (!session?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params

  let body: ScheduleBody
  try { body = await request.json() as ScheduleBody }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const { scheduledStart, minutesPerMatch } = body
  if (!scheduledStart || !minutesPerMatch || minutesPerMatch < 1) {
    return NextResponse.json({ error: "scheduledStart and minutesPerMatch required" }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()

  // Save schedule settings on tournament
  await supabase
    .from("tournaments")
    .update({
      scheduled_start: scheduledStart,
      minutes_per_match: minutesPerMatch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)

  // Fetch all non-bye, non-complete brackets ordered by round then match
  const { data: brackets, error } = await supabase
    .from("brackets")
    .select("id, round, match_number, is_bye, winner_id")
    .eq("tournament_id", id)
    .eq("is_bye", false)
    .is("winner_id", null)
    .order("round", { ascending: true })
    .order("match_number", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const msPerMatch = minutesPerMatch * 60 * 1000
  const startMs = new Date(scheduledStart).getTime()

  // Group non-third-place brackets by round
  const byRound = new Map<number, typeof brackets>()
  for (const b of brackets ?? []) {
    const r = b.round as number
    if (!byRound.has(r)) byRound.set(r, [])
    byRound.get(r)!.push(b)
  }

  const schedule: { bracketId: string; time: string }[] = []
  let offset = 0

  // Sort rounds
  const rounds = [...byRound.keys()].sort((a, b) => a - b)

  for (const r of rounds) {
    const roundBrackets = byRound.get(r)!
    // Assume matches happen sequentially within a round
    for (const b of roundBrackets) {
      const matchTime = new Date(startMs + offset * msPerMatch).toISOString()
      schedule.push({ bracketId: b.id as string, time: matchTime })
      offset++
    }
    // Add one match buffer between rounds (a gap)
    offset++
  }

  // Batch update
  const updates = schedule.map(({ bracketId, time }) =>
    supabase.from("brackets").update({ scheduled_time: time }).eq("id", bracketId)
  )
  await Promise.all(updates)

  return NextResponse.json({ updated: schedule.length, schedule })
}
