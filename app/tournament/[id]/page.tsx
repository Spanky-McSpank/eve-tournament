import Image from "next/image"
import Link from "next/link"
import { cookies } from "next/headers"
import { notFound } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase"
import type { Entrant } from "@/lib/bracket"
import { isAdminCharacter } from "@/lib/auth"
import TournamentRulesCard from "@/components/tournament/TournamentRulesCard"
import PropsSummaryCard from "@/components/tournament/PropsSummaryCard"
import type { PropBet } from "@/lib/props"

const GOLD = "var(--ev-gold-light)"

const STATUS_COLOR: Record<string, string> = {
  registration: "#3b82f6",
  active: "#22c55e",
  complete: GOLD,
}

function CapsuleerIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="24" fill="var(--ev-steel)" />
      <circle cx="24" cy="18" r="8" fill="var(--ev-card2)" />
      <ellipse cx="24" cy="38" rx="12" ry="10" fill="var(--ev-card2)" />
    </svg>
  )
}

interface Tournament {
  id: string
  name: string
  status: "registration" | "active" | "complete"
  entrant_count: number
  announcement: string | null
  ship_class: string | null
  ship_restrictions: string | null
  banned_ships: string | null
  engagement_rules: string | null
  system_name: string | null
  system_id: number | null
  fitting_restrictions: string | null
  additional_rules: string | null
}

interface LiveMatch {
  id: string
  round: number
  match_number: number
  entrant1: Entrant | null
  entrant2: Entrant | null
  scheduled_time: string | null
}

export default async function TournamentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const cookieStore = await cookies()
  let isAdmin = false
  const rawSession = cookieStore.get("eve_session")?.value
  if (rawSession) {
    try {
      const sess = JSON.parse(rawSession) as { character_id: number; expires_at: number }
      if (Date.now() <= sess.expires_at) isAdmin = isAdminCharacter(sess.character_id)
    } catch { /* ignore */ }
  }
  const supabase = createSupabaseServerClient()

  const [{ data: tournament }, { data: entrants }, { data: propRows }] = await Promise.all([
    supabase
      .from("tournaments")
      .select(
        "id, name, status, entrant_count, announcement, ship_class, ship_restrictions, banned_ships, engagement_rules, system_name, system_id, fitting_restrictions, additional_rules"
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
      .from("prop_bets")
      .select("*")
      .eq("tournament_id", id)
      .eq("status", "approved")
      .order("created_at", { ascending: false }),
  ])

  if (!tournament) notFound()

  const t = tournament as Tournament
  const entrantList = (entrants ?? []) as Entrant[]
  const entrantMap = new Map<string, Entrant>(entrantList.map((e) => [e.id, e]))

  // Bracket info for active/complete
  let currentRound = 0
  let totalRounds = 0
  let liveMatch: LiveMatch | null = null
  let nextMatch: LiveMatch | null = null

  if (t.status !== "registration") {
    const { data: brackets } = await supabase
      .from("brackets")
      .select("*")
      .eq("tournament_id", id)
      .order("round", { ascending: true })
      .order("match_number", { ascending: true })

    if (brackets && brackets.length > 0) {
      totalRounds = Math.max(...brackets.map((b) => b.round as number))
      const incomplete = brackets.filter((b) => !b.winner_id && !b.is_bye)
      currentRound = incomplete.length > 0
        ? Math.min(...incomplete.map((b) => b.round as number))
        : totalRounds

      // Find live match (has both entrants, no winner yet, match_status='live' or first pending)
      const activeBrackets = brackets.filter((b) => !b.winner_id && !b.is_bye && b.entrant1_id && b.entrant2_id)
      const liveRow = activeBrackets.find((b) => b.match_status === "live") ?? activeBrackets[0] ?? null
      const nextRow = activeBrackets.find((b) => b.id !== liveRow?.id) ?? null

      function hydrate(b: Record<string, unknown>): LiveMatch {
        return {
          id: b.id as string,
          round: b.round as number,
          match_number: b.match_number as number,
          entrant1: entrantMap.get(b.entrant1_id as string) ?? null,
          entrant2: entrantMap.get(b.entrant2_id as string) ?? null,
          scheduled_time: b.scheduled_time as string | null,
        }
      }

      if (liveRow) liveMatch = hydrate(liveRow as Record<string, unknown>)
      if (nextRow) nextMatch = hydrate(nextRow as Record<string, unknown>)
    }
  }

  // Champion + placements
  let champion: Entrant | null = null
  let thirdPlace: Entrant | null = null
  let fourthPlace: Entrant | null = null
  if (t.status === "complete" && totalRounds > 0) {
    const [{ data: finalMatch }, { data: thirdPlaceMatch }] = await Promise.all([
      supabase
        .from("brackets")
        .select("winner_id")
        .eq("tournament_id", id)
        .eq("round", totalRounds)
        .eq("is_third_place", false)
        .single(),
      supabase
        .from("brackets")
        .select("winner_id, entrant1_id, entrant2_id")
        .eq("tournament_id", id)
        .eq("is_third_place", true)
        .single(),
    ])
    if (finalMatch?.winner_id) champion = entrantMap.get(finalMatch.winner_id as string) ?? null
    if (thirdPlaceMatch?.winner_id) {
      thirdPlace = entrantMap.get(thirdPlaceMatch.winner_id as string) ?? null
      const fId =
        thirdPlaceMatch.entrant1_id === thirdPlaceMatch.winner_id
          ? thirdPlaceMatch.entrant2_id
          : thirdPlaceMatch.entrant1_id
      if (fId) fourthPlace = entrantMap.get(fId as string) ?? null
    }
  }

  const activeProps = (propRows ?? []) as PropBet[]
  const statusColor = STATUS_COLOR[t.status] ?? "#888"

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--ev-bg)",
        backgroundImage: [
          "linear-gradient(rgba(200,150,12,0.03) 1px, transparent 1px)",
          "linear-gradient(90deg, rgba(200,150,12,0.03) 1px, transparent 1px)",
        ].join(", "),
        backgroundSize: "32px 32px",
        color: "var(--ev-text)",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px 80px" }}>

        {/* ── HERO SECTION ──────────────────────────────────────────────── */}
        <div style={{ marginBottom: 32 }}>
          <Link href="/" style={{ color: "#444", fontSize: 11, fontFamily: "monospace", textDecoration: "none" }}>
            ← All Tournaments
          </Link>

          {/* Announcement banner */}
          {t.announcement && (
            <div style={{ marginTop: 16, padding: "10px 16px", background: "rgba(200,150,12,0.1)", border: "1px solid rgba(200,150,12,0.4)", borderRadius: 6 }}>
              <span style={{ fontSize: 13, color: GOLD }}>📢 {t.announcement}</span>
            </div>
          )}

          <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <h1 style={{
              color: GOLD,
              fontSize: "clamp(22px, 3vw, 38px)",
              fontFamily: "monospace",
              fontWeight: 700,
              margin: 0,
              letterSpacing: 2,
              animation: "termsGoldShimmer 4s ease-in-out infinite",
            }}>
              {t.name}
            </h1>
            <span style={{
              fontSize: 10, fontFamily: "monospace", letterSpacing: 2,
              padding: "3px 12px", border: `1px solid ${statusColor}`,
              borderRadius: 3, color: statusColor, textTransform: "uppercase",
            }}>
              {t.status}
            </span>
            {t.status !== "registration" && currentRound > 0 && (
              <span style={{ fontSize: 12, color: "var(--ev-muted)", fontFamily: "monospace" }}>
                Round {currentRound} of {totalRounds}
              </span>
            )}
            {t.ship_class && (
              <span style={{
                fontSize: 10, fontFamily: "monospace", letterSpacing: 1,
                padding: "3px 10px", background: "rgba(200,150,12,0.08)",
                border: "1px solid rgba(200,150,12,0.3)", borderRadius: 3, color: GOLD,
              }}>
                🚀 {t.ship_class.toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {/* ── STANDINGS (complete) ───────────────────────────────────────── */}
        {t.status === "complete" && champion && (
          <div style={{ marginBottom: 32 }}>
            {/* Champion */}
            <div style={{
              padding: 28, marginBottom: 10,
              border: "1px solid rgba(240,192,64,0.3)",
              background: "rgba(240,192,64,0.04)", borderRadius: 10,
              display: "flex", alignItems: "center", gap: 24,
            }}>
              <div style={{ borderRadius: "50%", overflow: "hidden", width: "clamp(80px,7vw,140px)", height: "clamp(80px,7vw,140px)", flexShrink: 0 }}>
                {champion.portrait_url
                  ? <Image src={champion.portrait_url} alt={champion.character_name} width={140} height={140} style={{ borderRadius: "50%", objectFit: "cover", width: "100%", height: "100%" }} />
                  : <CapsuleerIcon size={100} />}
              </div>
              <div>
                <div style={{ color: GOLD, fontSize: 10, fontFamily: "monospace", letterSpacing: 2, marginBottom: 4 }}>🏆 CHAMPION</div>
                <div style={{ color: GOLD, fontSize: "var(--font-2xl)", fontWeight: 700 }}>{champion.character_name}</div>
                {champion.corporation_name && <div style={{ color: "var(--ev-muted)", fontSize: 13, marginTop: 4 }}>{champion.corporation_name}</div>}
              </div>
            </div>
            {thirdPlace && (
              <div style={{
                padding: "16px 22px", marginBottom: 6,
                border: "1px solid rgba(205,127,50,0.3)",
                background: "rgba(205,127,50,0.03)", borderRadius: 8,
                display: "flex", alignItems: "center", gap: 16,
              }}>
                <div style={{ borderRadius: "50%", overflow: "hidden", width: 56, height: 56, flexShrink: 0 }}>
                  {thirdPlace.portrait_url
                    ? <Image src={thirdPlace.portrait_url} alt={thirdPlace.character_name} width={56} height={56} style={{ borderRadius: "50%", objectFit: "cover" }} />
                    : <CapsuleerIcon size={48} />}
                </div>
                <div>
                  <div style={{ color: "#CD7F32", fontSize: 9, fontFamily: "monospace", letterSpacing: 2, marginBottom: 2 }}>🥉 3RD PLACE</div>
                  <div style={{ color: "#CD7F32", fontSize: 16, fontWeight: 700 }}>{thirdPlace.character_name}</div>
                </div>
              </div>
            )}
            {fourthPlace && (
              <div style={{
                padding: "8px 18px", marginBottom: 20,
                background: "rgba(255,255,255,0.02)", borderRadius: 6,
                border: "0.5px solid rgba(255,255,255,0.05)",
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <div style={{ borderRadius: "50%", overflow: "hidden", width: 36, height: 36, flexShrink: 0, opacity: 0.6 }}>
                  {fourthPlace.portrait_url
                    ? <Image src={fourthPlace.portrait_url} alt={fourthPlace.character_name} width={36} height={36} style={{ borderRadius: "50%", objectFit: "cover" }} />
                    : <CapsuleerIcon size={36} />}
                </div>
                <div style={{ color: "var(--ev-muted)", fontSize: 11, fontFamily: "monospace" }}>
                  4th: {fourthPlace.character_name}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ACTIVE MATCH ──────────────────────────────────────────────── */}
        {t.status === "active" && (liveMatch || nextMatch) && (
          <div style={{ marginBottom: 28 }}>
            {liveMatch && (
              <ActiveMatchCard match={liveMatch} label="⚡ NOW FIGHTING" />
            )}
            {nextMatch && (
              <ActiveMatchCard match={nextMatch} label="⏳ UP NEXT" muted />
            )}
          </div>
        )}

        {/* ── RULES ─────────────────────────────────────────────────────── */}
        <TournamentRulesCard tournament={t} />

        {/* ── PROPS SUMMARY ─────────────────────────────────────────────── */}
        {activeProps.length > 0 && (
          <PropsSummaryCard props={activeProps} tournamentId={id} />
        )}

        {/* ── REGISTRATION state ────────────────────────────────────────── */}
        {t.status === "registration" && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--ev-muted)" }}>
                {entrantList.length} / {t.entrant_count} pilots registered
              </span>
            </div>
            <div style={{ height: 5, background: "var(--ev-steel)", borderRadius: 3, overflow: "hidden", marginBottom: 20 }}>
              <div style={{ width: `${Math.min((entrantList.length / t.entrant_count) * 100, 100)}%`, height: "100%", background: GOLD, transition: "width 0.5s" }} />
            </div>
            <Link href={`/tournament/${id}/register`} style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              padding: "0 32px", minHeight: "var(--btn-height)", minWidth: 200,
              background: GOLD, borderRadius: "var(--border-radius)", color: "var(--ev-bg)",
              fontSize: "var(--font-lg)", fontWeight: 700, fontFamily: "monospace", textDecoration: "none",
            }}>
              Register Now
            </Link>
          </div>
        )}

        {/* ── CTA BUTTONS ───────────────────────────────────────────────── */}
        {(t.status === "active" || t.status === "complete") && (
          <div style={{ display: "flex", gap: 12, marginBottom: 32, flexWrap: "wrap" }}>
            <Link href={`/tournament/${id}/bracket`} style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "0 24px", minHeight: "var(--btn-height)",
              background: GOLD, borderRadius: "var(--border-radius)",
              color: "var(--ev-bg)", fontSize: "var(--font-base)", fontWeight: 700, fontFamily: "monospace", textDecoration: "none",
            }}>
              ⚔ Full Bracket
            </Link>
            <Link href={`/tournament/${id}/bets`} style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "0 24px", minHeight: "var(--btn-height)",
              background: "transparent", border: `1px solid ${GOLD}`,
              borderRadius: "var(--border-radius)",
              color: GOLD, fontSize: "var(--font-base)", fontWeight: 700, fontFamily: "monospace", textDecoration: "none",
            }}>
              🎲 Bookie Board
            </Link>
            {isAdmin && (
              <Link href={`/admin/tournament/${id}`} style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "0 24px", minHeight: "var(--btn-height)",
                background: "transparent", border: "1px solid rgba(200,150,12,0.4)",
                borderRadius: "var(--border-radius)",
                color: "var(--ev-muted)", fontSize: "var(--font-base)", fontWeight: 700, fontFamily: "monospace", textDecoration: "none",
              }}>
                ⚙ Command Center
              </Link>
            )}
          </div>
        )}

        {/* ── ENTRANT GRID ──────────────────────────────────────────────── */}
        {entrantList.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 10, fontFamily: "monospace", color: "var(--ev-muted)", letterSpacing: 2, marginBottom: 14 }}>
              {t.status === "registration" ? "REGISTERED PILOTS" : "ENTRANTS"}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {entrantList.map((e) => {
                const eliminated = e.seed != null && t.status === "active" // simplified; ideally use eliminated_round
                return (
                  <div key={e.id} style={{ position: "relative" }} title={`${e.character_name}${e.seed ? ` · Seed ${e.seed}` : ""}`}>
                    <div style={{
                      borderRadius: "50%", overflow: "hidden",
                      width: "clamp(44px,4vw,72px)", height: "clamp(44px,4vw,72px)",
                      opacity: 1,
                    }}>
                      {e.portrait_url
                        ? <Image src={e.portrait_url} alt={e.character_name} width={72} height={72} style={{ borderRadius: "50%", objectFit: "cover", width: "100%", height: "100%" }} />
                        : <CapsuleerIcon size={56} />}
                    </div>
                    {e.seed != null && (
                      <div style={{
                        position: "absolute", bottom: -2, right: -2,
                        background: "var(--ev-bg)", border: `1px solid ${GOLD}`,
                        borderRadius: "50%", width: 15, height: 15,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 7, color: GOLD, fontFamily: "monospace", fontWeight: 700,
                      }}>
                        {e.seed}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Gold shimmer keyframe (reuse from TermsGate) */}
      <style>{`
        @keyframes termsGoldShimmer {
          0%, 100% { color: var(--ev-gold-light); }
          50% { color: var(--ev-champagne); }
        }
      `}</style>
    </div>
  )
}

// ── Active Match Card ──────────────────────────────────────────────────────

function ActiveMatchCard({
  match,
  label,
  muted = false,
}: {
  match: LiveMatch
  label: string
  muted?: boolean
}) {
  const GOLD = "var(--ev-gold-light)"
  return (
    <div style={{
      padding: "16px 20px",
      background: muted ? "rgba(255,255,255,0.02)" : "rgba(200,150,12,0.07)",
      border: `1px solid ${muted ? "rgba(255,255,255,0.06)" : "rgba(200,150,12,0.3)"}`,
      borderRadius: 10,
      marginBottom: 10,
    }}>
      <div style={{ fontSize: 9, fontFamily: "monospace", color: muted ? "var(--ev-muted)" : GOLD, letterSpacing: 2, marginBottom: 10, textTransform: "uppercase" }}>
        {label} · R{match.round}·M{match.match_number}
        {match.scheduled_time && (
          <span style={{ marginLeft: 12, color: "var(--ev-muted)" }}>
            {new Date(match.scheduled_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} EVE
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <PilotCell entrant={match.entrant1} />
        <div style={{ fontSize: 13, fontFamily: "monospace", color: muted ? "var(--ev-muted)" : GOLD, fontWeight: 700 }}>VS</div>
        <PilotCell entrant={match.entrant2} />
      </div>
    </div>
  )
}

function PilotCell({ entrant }: { entrant: Entrant | null }) {
  if (!entrant) return <div style={{ width: 120, color: "var(--ev-muted)", fontFamily: "monospace", fontSize: 11 }}>TBD</div>
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ borderRadius: "50%", overflow: "hidden", width: 44, height: 44, flexShrink: 0 }}>
        {entrant.portrait_url
          ? <Image src={entrant.portrait_url} alt={entrant.character_name} width={44} height={44} style={{ borderRadius: "50%", objectFit: "cover" }} />
          : <svg width={44} height={44} viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="24" fill="var(--ev-steel)" /><circle cx="24" cy="18" r="8" fill="var(--ev-card2)" /><ellipse cx="24" cy="38" rx="12" ry="10" fill="var(--ev-card2)" /></svg>}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ev-text)" }}>{entrant.character_name}</div>
        <div style={{ fontSize: 10, color: "var(--ev-muted)" }}>{entrant.corporation_name ?? "—"}</div>
      </div>
    </div>
  )
}
