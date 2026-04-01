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

export async function POST(request: NextRequest) {
  if (!getAdmin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: Record<string, unknown>
  try { body = (await request.json()) as Record<string, unknown> }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const { name, entrantCount } = body
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }
  if (![16, 32, 64].includes(Number(entrantCount))) {
    return NextResponse.json({ error: "entrantCount must be 16, 32, or 64" }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()
  const { data: tournament, error } = await supabase
    .from("tournaments")
    .insert({ name: name.trim(), entrant_count: Number(entrantCount), status: "registration" })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tournament })
}
