export function isAdminCharacter(characterId: string | number): boolean {
  const adminIds = (process.env.ADMIN_CHARACTER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
  return adminIds.includes(String(characterId).trim())
}

export function getSessionCharacter(request: Request): {
  character_id: number
  character_name: string
  isAdmin: boolean
} | null {
  const cookieHeader = request.headers.get('cookie') || ''
  const sessionMatch = cookieHeader.match(/eve_session=([^;]+)/)
  if (!sessionMatch) return null

  const raw = sessionMatch[1]

  type SessionData = { character_id: number; character_name: string; expires_at: number }
  let session: SessionData | null = null

  // Try direct JSON parse first, then URI-decoded parse
  try {
    session = JSON.parse(raw) as SessionData
  } catch {
    try {
      session = JSON.parse(decodeURIComponent(raw)) as SessionData
    } catch {
      return null
    }
  }

  if (!session || typeof session.character_id !== 'number') return null
  if (Date.now() > session.expires_at) return null

  const character = {
    character_id: session.character_id,
    character_name: session.character_name,
    isAdmin: isAdminCharacter(session.character_id),
  }

  console.log('[Auth]', {
    character_id: character.character_id,
    character_name: character.character_name,
    isAdmin: character.isAdmin,
    adminIds: process.env.ADMIN_CHARACTER_IDS,
  })

  return character
}

export function isAdminRequest(request: Request): boolean {
  return getSessionCharacter(request)?.isAdmin ?? false
}
