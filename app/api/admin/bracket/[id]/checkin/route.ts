import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"
import { getSessionCharacter } from "@/lib/auth"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSessionCharacter(request)
  if (!session?.isAdmin) return NextResponse.json({ error: "Admin access required — log in with an admin character" }, { status: 403 })
  const { id: bracketId } = await params

  let body: { entrantId: string; checkedIn: boolean }
  try { body = await request.json() as { entrantId: string; checkedIn: boolean } }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const supabase = createSupabaseServerClient()

  const { error } = await supabase
    .from("entrants")
    .update({ checked_in: body.checkedIn })
    .eq("id", body.entrantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ bracketId, entrantId: body.entrantId, checkedIn: body.checkedIn })
}
