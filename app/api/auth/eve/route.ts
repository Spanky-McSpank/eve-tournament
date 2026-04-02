import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const rawReturnTo = searchParams.get('returnTo') ?? '/'
  // Validate: must be a relative path with no protocol
  const returnTo = rawReturnTo.startsWith('/') && !/^\/\/|https?:\/\//i.test(rawReturnTo)
    ? rawReturnTo
    : '/'

  const state = randomUUID()

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.EVE_CLIENT_ID!,
    redirect_uri: process.env.EVE_CALLBACK_URL!,
    scope: 'esi-killmails.read_killmails.v1',
    state,
  })

  const ssoUrl = `https://login.eveonline.com/v2/oauth/authorize?${params.toString()}`

  const response = NextResponse.redirect(ssoUrl)
  response.cookies.set('eve_oauth_state', JSON.stringify({ state, returnTo }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 300,
    path: '/',
  })

  return response
}
