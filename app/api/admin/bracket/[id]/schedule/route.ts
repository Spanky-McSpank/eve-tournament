import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"
import { isAdminRequest } from "@/lib/auth"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id: bracketId } = await params

  let body: Record<string, unknown>
  try { body = await request.json() as Record<string, unknown> }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const supabase = createSupabaseServerClient()
  const { data: bracket } = await supabase
    .from("brackets").select("id").eq("id", bracketId).single()
  if (!bracket) return NextResponse.json({ error: "Bracket not found" }, { status: 404 })

  // scheduledTime can be an ISO string or null to clear
  const scheduledTime = body.scheduledTime === null ? null : body.scheduledTime !== undefined ? String(body.scheduledTime) : undefined
  if (scheduledTime === undefined) {
    return NextResponse.json({ error: "scheduledTime is required (ISO string or null)" }, { status: 400 })
  }

  const { data: updated, error } = await supabase
    .from("brackets")
    .update({ scheduled_time: scheduledTime })
    .eq("id", bracketId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ bracket: updated })
}
