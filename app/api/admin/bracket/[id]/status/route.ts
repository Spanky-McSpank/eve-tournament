// NOTE: Requires schema migration:
// ALTER TABLE brackets ADD COLUMN IF NOT EXISTS match_status TEXT DEFAULT 'pending';
//   -- values: 'pending' | 'checkin' | 'live' | 'complete'

import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"
import { getSessionCharacter } from "@/lib/auth"

const VALID_STATUSES = ["pending", "checkin", "live", "complete"]

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSessionCharacter(request)
  if (!session?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id: bracketId } = await params

  let body: { match_status: string }
  try { body = await request.json() as { match_status: string } }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  if (!VALID_STATUSES.includes(body.match_status)) {
    return NextResponse.json({ error: "Invalid match_status" }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()
  const { error } = await supabase
    .from("brackets")
    .update({ match_status: body.match_status })
    .eq("id", bracketId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ bracketId, match_status: body.match_status })
}
