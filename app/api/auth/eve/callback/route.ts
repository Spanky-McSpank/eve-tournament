import { NextRequest, NextResponse } from 'next/server'

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

interface JwtPayload {
  sub: string   // "CHARACTER:EVE:{id}"
  name: string
}

interface EsiCharacterPublic {
  corporation_id: number
  name: string
}

function decodeJwtPayload(token: string): JwtPayload {
  const segment = token.split('.')[1]
  const padded = segment + '='.repeat((4 - segment.length % 4) % 4)
  const json = Buffer.from(padded, 'base64').toString('utf8')
  return JSON.parse(json) as JwtPayload
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  const storedState = request.cookies.get('eve_oauth_state')?.value

  if (!state || !storedState || state !== storedState) {
    return NextResponse.json({ error: 'State mismatch' }, { status: 400 })
  }

  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 })
  }

  // Exchange code for tokens
  const credentials = Buffer.from(
    `${process.env.EVE_CLIENT_ID}:${process.env.EVE_CLIENT_SECRET}`
  ).toString('base64')

  const tokenRes = await fetch('https://login.eveonline.com/v2/oauth/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
    }),
  })

  if (!tokenRes.ok) {
    return NextResponse.json({ error: 'Token exchange failed' }, { status: 500 })
  }

  const tokens: TokenResponse = await tokenRes.json()

  // Decode JWT to get character info
  const payload = decodeJwtPayload(tokens.access_token)
  const characterId = parseInt(payload.sub.split(':')[2], 10)
  const characterName = payload.name

  // Fetch corporation_id from ESI
  const esiRes = await fetch(
    `https://esi.evetech.net/latest/characters/${characterId}/`,
    { headers: { 'Accept': 'application/json' } }
  )

  let corporationId = 0
  if (esiRes.ok) {
    const esiChar: EsiCharacterPublic = await esiRes.json()
    corporationId = esiChar.corporation_id
  }

  const session = {
    character_id: characterId,
    character_name: characterName,
    corporation_id: corporationId,
    access_token: tokens.access_token,
    expires_at: Date.now() + 1_200_000,
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const response = NextResponse.redirect(appUrl + '/')

  response.cookies.set('eve_session', JSON.stringify(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 86400,
    path: '/',
  })

  response.cookies.delete('eve_oauth_state')

  return response
}
