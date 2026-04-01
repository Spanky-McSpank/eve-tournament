// NOTE: Run this in Supabase SQL editor if you haven't already:
// ALTER TABLE brackets ADD COLUMN IF NOT EXISTS locked BOOLEAN DEFAULT FALSE;

import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"

interface EveSession {
  character_id: number
  expires_at: number
}

function getAdmin(request: NextRequest): boolean {
  const raw = request.cookies.get("eve_session")?.value
  if (!raw) return false
  try {
    const session = JSON.parse(raw) as EveSession
    if (Date.now() > session.expires_at) return false
    const ids = (process.env.ADMIN_CHARACTER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean)
    return ids.includes(String(session.character_id))
  } catch { return false }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bracketId: string }> }
) {
  if (!getAdmin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { bracketId } = await params

  let body: Record<string, unknown>
  try { body = (await request.json()) as Record<string, unknown> }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const locked = Boolean(body.locked)
  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase
    .from("brackets")
    .update({ locked })
    .eq("id", bracketId)
    .select("id, locked")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ bracket: data })
}
