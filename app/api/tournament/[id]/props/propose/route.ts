import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"
import { calcPropAcceptorStake } from "@/lib/props"

interface EveSession {
  character_id: number
  character_name: string
  expires_at: number
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function parseSession(request: NextRequest): EveSession | null {
  const raw = request.cookies.get("eve_session")?.value
  if (!raw) return null
  try {
    const s = JSON.parse(raw) as EveSession
    return Date.now() > s.expires_at ? null : s
  } catch { return null }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tournamentId } = await params
  const session = parseSession(request)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: Record<string, unknown>
  try { body = (await request.json()) as Record<string, unknown> }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const { propId, proposition, iskAmount } = body

  if (!propId || !proposition || iskAmount === undefined) {
    return NextResponse.json({ error: "propId, proposition, and iskAmount are required" }, { status: 400 })
  }
  if (!UUID_RE.test(String(propId))) {
    return NextResponse.json({ error: "Invalid propId UUID" }, { status: 400 })
  }
  if (proposition !== "yes" && proposition !== "no") {
    return NextResponse.json({ error: "proposition must be 'yes' or 'no'" }, { status: 400 })
  }
  const iskNum = Number(iskAmount)
  if (!Number.isInteger(iskNum) || iskNum < 10_000_000) {
    return NextResponse.json({ error: "Minimum bet is 10,000,000 ISK" }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()

  // Validate prop
  const { data: prop } = await supabase
    .from("prop_bets")
    .select("id, status, yes_prob")
    .eq("id", String(propId))
    .single()

  if (!prop) return NextResponse.json({ error: "Prop not found" }, { status: 404 })
  if (prop.status !== "approved") {
    return NextResponse.json({ error: "This prop is not open for betting" }, { status: 409 })
  }

  // Check no existing open/matched proposal from this character on this prop
  const { data: existing } = await supabase
    .from("prop_proposals")
    .select("id")
    .eq("prop_id", String(propId))
    .eq("proposer_character_id", session.character_id)
    .in("status", ["open", "matched"])
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: "You already have an active proposal on this prop" }, { status: 409 })
  }

  const yesProb = prop.yes_prob as number
  const impliedProb = proposition === "yes" ? yesProb : 1 - yesProb
  const acceptorStake = calcPropAcceptorStake(iskNum, impliedProb)

  const { data: proposal, error: insertError } = await supabase
    .from("prop_proposals")
    .insert({
      prop_id: String(propId),
      tournament_id: tournamentId,
      proposer_character_id: session.character_id,
      proposer_name: session.character_name,
      proposition: proposition as "yes" | "no",
      isk_amount: iskNum,
      implied_prob: impliedProb,
      status: "open",
      is_proxy: false,
      is_anonymous: false,
    })
    .select()
    .single()

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  return NextResponse.json({ proposal, acceptorStake })
}
