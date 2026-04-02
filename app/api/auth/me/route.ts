import { NextRequest, NextResponse } from 'next/server'

interface EveSession {
  character_id: number
  character_name: string
  corporation_id: number
  access_token: string
  expires_at: number
}

export async function GET(request: NextRequest) {
  const raw = request.cookies.get('eve_session')?.value

  if (!raw) {
    return NextResponse.json({ character: null, isAuthenticated: false })
  }

  let session: EveSession
  try {
    session = JSON.parse(raw) as EveSession
  } catch {
    return NextResponse.json({ character: null, isAuthenticated: false })
  }

  if (Date.now() > session.expires_at) {
    return NextResponse.json({ character: null, isAuthenticated: false })
  }

  const adminIds = (process.env.ADMIN_CHARACTER_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const isAdmin = adminIds.includes(String(session.character_id))
  const showWelcome = session.character_name === "Wenchy The Destroyer"

  return NextResponse.json({
    character: {
      character_id: session.character_id,
      character_name: session.character_name,
      corporation_id: session.corporation_id,
    },
    isAuthenticated: true,
    isAdmin,
    showWelcome,
  })
}
