import { NextRequest, NextResponse } from "next/server"
import { advanceWinner } from "@/lib/bracket"

interface EveSession {
  character_id: number
  character_name: string
  corporation_id: number
  access_token: string
  expires_at: number
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  void params // tournamentId not needed here; bracketId identifies the match

  const raw = request.cookies.get("eve_session")?.value
  if (!raw) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let session: EveSession
  try {
    session = JSON.parse(raw) as EveSession
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const adminIds = (process.env.ADMIN_CHARACTER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

  if (!adminIds.includes(String(session.character_id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { bracketId, winnerId, killmailUrl } = body

  if (!bracketId || !winnerId) {
    return NextResponse.json({ error: "bracketId and winnerId are required" }, { status: 400 })
  }

  if (!UUID_RE.test(String(bracketId)) || !UUID_RE.test(String(winnerId))) {
    return NextResponse.json({ error: "Invalid UUID format" }, { status: 400 })
  }

  try {
    await advanceWinner(
      String(bracketId),
      String(winnerId),
      killmailUrl ? String(killmailUrl) : undefined
    )
    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
