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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!getAdmin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params

  let body: Record<string, unknown>
  try { body = await request.json() as Record<string, unknown> }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  if (body.confirm !== "DELETE") {
    return NextResponse.json({ error: "Must send { confirm: 'DELETE' } to proceed" }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()
  const { data: tournament } = await supabase.from("tournaments").select("id").eq("id", id).single()
  if (!tournament) return NextResponse.json({ error: "Tournament not found" }, { status: 404 })

  const { error } = await supabase.from("tournaments").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
