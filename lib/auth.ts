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
  try {
    const session = JSON.parse(decodeURIComponent(sessionMatch[1])) as {
      character_id: number
      character_name: string
      expires_at: number
    }
    if (!session || typeof session.character_id !== 'number') return null
    if (Date.now() > session.expires_at) return null
    return {
      character_id: session.character_id,
      character_name: session.character_name,
      isAdmin: isAdminCharacter(session.character_id),
    }
  } catch {
    return null
  }
}

export function isAdminRequest(request: Request): boolean {
  return getSessionCharacter(request)?.isAdmin ?? false
}
