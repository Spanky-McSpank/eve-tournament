const ESI_BASE = 'https://esi.evetech.net/latest'
const ZKILL_BASE = 'https://zkillboard.com/api'
const USER_AGENT = 'eve-tournament-app/1.0'

// ── Types ──────────────────────────────────────────────────────────────────

export interface CharacterPublicInfo {
  character_id: number
  name: string
  corporation_id: number
  alliance_id?: number
  birthday: string
  gender: string
  security_status: number
}

export interface CharacterPortrait {
  px64x64: string
  px128x128: string
  px256x256: string
  px512x512: string
}

export interface CharacterSearchResult {
  character_id: number
  character_name: string
}

export interface KillboardStats {
  kills_30d: number
  losses_30d: number
  isk_destroyed_30d: number
  isk_lost_30d: number
}

// ── zKillboard cache ───────────────────────────────────────────────────────

interface CacheEntry {
  data: KillboardStats
  cachedAt: number
}

const zkillCache = new Map<number, CacheEntry>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

// ── ESI helpers ────────────────────────────────────────────────────────────

export async function getCharacterPublicInfo(
  characterId: number
): Promise<CharacterPublicInfo> {
  const res = await fetch(`${ESI_BASE}/characters/${characterId}/`, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 300 },
  })
  if (!res.ok) {
    throw new Error(`ESI characters/${characterId} → ${res.status}`)
  }
  const data = await res.json()
  return { character_id: characterId, ...data } as CharacterPublicInfo
}

export async function getCharacterPortrait(
  characterId: number
): Promise<CharacterPortrait> {
  const res = await fetch(`${ESI_BASE}/characters/${characterId}/portrait/`, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 3600 },
  })
  if (!res.ok) {
    throw new Error(`ESI portrait/${characterId} → ${res.status}`)
  }
  return res.json() as Promise<CharacterPortrait>
}

export async function searchCharacterByName(
  name: string
): Promise<CharacterSearchResult | null> {
  // ESI /search/ was removed. Use /universe/ids/ instead.
  const searchRes = await fetch(`${ESI_BASE}/universe/ids/?datasource=tranquility`, {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify([name]),
  })

  if (!searchRes.ok) return null

  const data: { characters?: { id: number; name: string }[] } = await searchRes.json()
  const match = data.characters?.[0]
  if (!match) return null

  return { character_id: match.id, character_name: match.name }
}

export async function getKillboardStats(
  characterId: number
): Promise<KillboardStats> {
  const cached = zkillCache.get(characterId)
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return cached.data
  }

  await sleep(500)

  try {
    const res = await fetch(
      `${ZKILL_BASE}/stats/characterID/${characterId}/`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': USER_AGENT,
        },
      }
    )

    if (!res.ok) {
      return zeroes()
    }

    const raw = await res.json()

    // zKillboard returns {} when no data
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return zeroes()
    }

    // Extract 30-day stats from activepvp or all-time fallback
    const stats: KillboardStats = {
      kills_30d: raw.shipsDestroyed ?? 0,
      losses_30d: raw.shipsLost ?? 0,
      isk_destroyed_30d: raw.iskDestroyed ?? 0,
      isk_lost_30d: raw.iskLost ?? 0,
    }

    zkillCache.set(characterId, { data: stats, cachedAt: Date.now() })
    return stats
  } catch {
    return zeroes()
  }
}

function zeroes(): KillboardStats {
  return { kills_30d: 0, losses_30d: 0, isk_destroyed_30d: 0, isk_lost_30d: 0 }
}
