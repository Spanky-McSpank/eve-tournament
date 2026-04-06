import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"
import { isAdminRequest } from "@/lib/auth"

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Admin access required — log in with an admin character" }, { status: 403 })

  let body: Record<string, unknown>
  try { body = (await request.json()) as Record<string, unknown> }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const { name, entrantCount } = body
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }
  if (![4, 6, 8, 10, 12, 16, 24, 32, 48, 64].includes(Number(entrantCount))) {
    return NextResponse.json({ error: "entrantCount must be one of: 4, 6, 8, 10, 12, 16, 24, 32, 48, 64" }, { status: 400 })
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
