// NOTE: Run this in Supabase SQL editor if you haven't already:
// ALTER TABLE brackets ADD COLUMN IF NOT EXISTS locked BOOLEAN DEFAULT FALSE;

import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"
import { isAdminRequest } from "@/lib/auth"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bracketId: string }> }
) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Admin access required — log in with an admin character" }, { status: 403 })
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
