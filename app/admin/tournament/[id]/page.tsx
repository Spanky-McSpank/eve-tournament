import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { notFound } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase"
import { isAdminCharacter } from "@/lib/auth"
import CommandCenterClient from "@/components/admin/CommandCenterClient"

export default async function CommandCenterPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const cookieStore = await cookies()
  const raw = cookieStore.get("eve_session")?.value
  let isAdmin = false
  if (raw) {
    try {
      const sess = JSON.parse(raw) as { character_id: number; expires_at: number }
      if (Date.now() <= sess.expires_at) isAdmin = isAdminCharacter(sess.character_id)
    } catch { /* ignore */ }
  }
  if (!isAdmin) redirect("/")

  const supabase = createSupabaseServerClient()

  const [
    { data: tournament },
    { data: entrants },
    { data: brackets },
    { data: propBets },
  ] = await Promise.all([
    supabase
      .from("tournaments")
      .select(
        "id, name, status, entrant_count, current_round, scheduled_start, minutes_per_match, announcement, paused, discord_webhook_url, ship_class, ship_restrictions, banned_ships, engagement_rules, system_name, system_id, fitting_restrictions, additional_rules, created_at"
      )
      .eq("id", id)
      .single(),
    supabase
      .from("entrants")
      .select("*")
      .eq("tournament_id", id)
      .order("seed", { ascending: true, nullsFirst: false })
      .order("registered_at", { ascending: true }),
    supabase
      .from("brackets")
      .select("*")
      .eq("tournament_id", id)
      .order("round", { ascending: true })
      .order("match_number", { ascending: true }),
    supabase
      .from("prop_bets")
      .select("id, title, status, category")
      .eq("tournament_id", id)
      .in("status", ["approved", "pending"]),
  ])

  if (!tournament) notFound()

  // Build entrant map for hydrating brackets
  const entrantMap = new Map<string, Record<string, unknown>>(
    (entrants ?? []).map((e) => [e.id as string, e as Record<string, unknown>])
  )

  const hydratedBrackets = (brackets ?? []).map((b) => ({
    ...b,
    entrant1: b.entrant1_id ? (entrantMap.get(b.entrant1_id as string) ?? null) : null,
    entrant2: b.entrant2_id ? (entrantMap.get(b.entrant2_id as string) ?? null) : null,
    winner: b.winner_id ? (entrantMap.get(b.winner_id as string) ?? null) : null,
  }))

  // Bet summary (total ISK in play)
  const { data: betSummaryRow } = await supabase
    .from("bet_matches")
    .select("acceptor_isk_amount, outcome")
    .in(
      "proposal_id",
      (
        await supabase
          .from("bet_proposals")
          .select("id")
          .eq("tournament_id", id)
          .eq("status", "matched")
      ).data?.map((p) => p.id as string) ?? []
    )
    .eq("outcome", "pending")

  const totalIskInPlay = (betSummaryRow ?? []).reduce(
    (sum, bm) => sum + (bm.acceptor_isk_amount as number ?? 0),
    0
  )

  const openPropCount = (propBets ?? []).filter((p) => p.status === "approved").length

  return (
    <CommandCenterClient
      tournament={tournament as Record<string, unknown>}
      entrants={(entrants ?? []) as Record<string, unknown>[]}
      brackets={hydratedBrackets as Record<string, unknown>[]}
      totalIskInPlay={totalIskInPlay}
      openPropCount={openPropCount}
    />
  )
}
