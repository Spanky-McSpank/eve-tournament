import Image from "next/image"
import Link from "next/link"
import { cookies } from "next/headers"
import { notFound } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase"
import type { Entrant } from "@/lib/bracket"
import AdminBackButton from "@/components/admin/AdminBackButton"
import { isAdminCharacter } from "@/lib/auth"
import TournamentRulesCard from "@/components/tournament/TournamentRulesCard"

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
  ship_class: string | null
  ship_restrictions: string | null
  banned_ships: string | null
  engagement_rules: string | null
  system_name: string | null
  system_id: number | null
  fitting_restrictions: string | null
  additional_rules: string | null
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

  const [{ data: tournament }, { data: entrants }] = await Promise.all([
    supabase.from("tournaments").select("id, name, status, entrant_count, ship_class, ship_restrictions, banned_ships, engagement_rules, system_name, system_id, fitting_restrictions, additional_rules").eq("id", id).single(),
    supabase.from("entrants").select("*").eq("tournament_id", id)
      .order("seed", { ascending: true, nullsFirst: false })
      .order("registered_at", { ascending: true }),
  ])

  if (!tournament) notFound()

  const t = tournament as Tournament
  const entrantList = (entrants ?? []) as Entrant[]

  // Determine current round info for active tournaments
  let currentRound = 0
  let totalRounds = 0
  if (t.status !== "registration") {
    const { data: brackets } = await supabase
      .from("brackets")
      .select("round, winner_id")
      .eq("tournament_id", id)
    if (brackets && brackets.length > 0) {
      totalRounds = Math.max(...brackets.map((b) => b.round as number))
      const incomplete = brackets.filter((b) => !b.winner_id)
      currentRound = incomplete.length > 0
        ? Math.min(...incomplete.map((b) => b.round as number))
        : totalRounds
    }
  }

  // Find champion, third and fourth place
  let champion: Entrant | null = null
  let thirdPlace: Entrant | null = null
  let fourthPlace: Entrant | null = null
  if (t.status === "complete") {
    const { data: finalMatch } = await supabase
      .from("brackets")
      .select("winner_id")
      .eq("tournament_id", id)
      .eq("round", totalRounds)
      .eq("is_third_place", false)
      .single()
    if (finalMatch?.winner_id) {
      champion = entrantList.find((e) => e.id === finalMatch.winner_id) ?? null
    }
    const { data: thirdPlaceMatch } = await supabase
      .from("brackets")
      .select("winner_id, entrant1_id, entrant2_id")
      .eq("tournament_id", id)
      .eq("is_third_place", true)
      .single()
    if (thirdPlaceMatch?.winner_id) {
      thirdPlace = entrantList.find((e) => e.id === thirdPlaceMatch.winner_id) ?? null
      const fourthId =
        thirdPlaceMatch.entrant1_id === thirdPlaceMatch.winner_id
          ? thirdPlaceMatch.entrant2_id
          : thirdPlaceMatch.entrant1_id
      if (fourthId) fourthPlace = entrantList.find((e) => e.id === fourthId) ?? null
    }
  }

  const statusColor = STATUS_COLOR[t.status]

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--ev-bg)",
      backgroundImage: [
        "linear-gradient(rgba(200,150,12,0.03) 1px, transparent 1px)",
        "linear-gradient(90deg, rgba(200,150,12,0.03) 1px, transparent 1px)",
      ].join(", "),
      backgroundSize: "32px 32px",
      color: "var(--ev-text)",
      fontFamily: "system-ui, sans-serif",
    }}>
      {/* Header */}
      <div style={{ padding: "32px 32px 0", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
          <Link href="/" style={{ color: "#444", fontSize: 11, fontFamily: "monospace", textDecoration: "none" }}>
            ← All Tournaments
          </Link>
          {isAdmin && <AdminBackButton />}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
          <h1 style={{ color: GOLD, fontSize: "var(--font-2xl)", fontFamily: "monospace", fontWeight: 700, margin: 0 }}>
            {t.name}
          </h1>
          <span style={{
            fontSize: 10, fontFamily: "monospace", letterSpacing: 2,
            padding: "2px 10px", border: `1px solid ${statusColor}`,
            borderRadius: 3, color: statusColor, textTransform: "uppercase",
          }}>{t.status}</span>
          {t.status !== "registration" && currentRound > 0 && (
            <span style={{ fontSize: 12, color: "var(--ev-muted)", fontFamily: "monospace" }}>
              Round {currentRound} of {totalRounds}
            </span>
          )}
        </div>
      </div>

      <div style={{ padding: 32, maxWidth: 1000, margin: "0 auto" }}>
        {/* Champion banner */}
        {t.status === "complete" && champion && (
          <div style={{
            padding: 28, marginBottom: 16,
            border: "1px solid var(--ev-border2)",
            background: "rgba(240,192,64,0.04)", borderRadius: 10,
            display: "flex", alignItems: "center", gap: 24,
          }}>
            <div style={{ borderRadius: "50%", overflow: "hidden", width: "clamp(96px,8vw,160px)", height: "clamp(96px,8vw,160px)", flexShrink: 0 }}>
              {champion.portrait_url
                ? <Image src={champion.portrait_url} alt={champion.character_name} width={160} height={160}
                    style={{ borderRadius: "50%", objectFit: "cover", width: "100%", height: "100%" }} />
                : <CapsuleerIcon size={128} />
              }
            </div>
            <div>
              <div style={{ color: GOLD, fontSize: "var(--font-sm)", fontFamily: "monospace", letterSpacing: 2, marginBottom: 4 }}>
                🏆 CHAMPION
              </div>
              <div style={{ color: GOLD, fontSize: "var(--font-2xl)", fontWeight: 700 }}>{champion.character_name}</div>
              {champion.corporation_name && (
                <div style={{ color: "var(--ev-muted)", fontSize: "var(--font-base)", marginTop: 4 }}>{champion.corporation_name}</div>
              )}
              <div style={{ marginTop: 8, fontFamily: "monospace", fontSize: "var(--font-sm)", color: "var(--ev-muted)" }}>
                {Math.round(champion.efficiency * 100)}% efficiency · {champion.kills_30d}K / {champion.losses_30d}L
              </div>
            </div>
          </div>
        )}

        {/* Third place banner */}
        {t.status === "complete" && thirdPlace && (
          <div style={{
            padding: "18px 24px", marginBottom: 10,
            border: "1px solid rgba(205,127,50,0.35)",
            background: "rgba(205,127,50,0.03)", borderRadius: 10,
            display: "flex", alignItems: "center", gap: 20,
          }}>
            <div style={{ borderRadius: "50%", overflow: "hidden", width: "clamp(64px,5vw,96px)", height: "clamp(64px,5vw,96px)", flexShrink: 0 }}>
              {thirdPlace.portrait_url
                ? <Image src={thirdPlace.portrait_url} alt={thirdPlace.character_name} width={96} height={96}
                    style={{ borderRadius: "50%", objectFit: "cover", width: "100%", height: "100%" }} />
                : <CapsuleerIcon size={80} />
              }
            </div>
            <div>
              <div style={{ color: "#CD7F32", fontSize: "var(--font-sm)", fontFamily: "monospace", letterSpacing: 2, marginBottom: 4 }}>
                🥉 3RD PLACE
              </div>
              <div style={{ color: "#CD7F32", fontSize: "var(--font-xl)", fontWeight: 700 }}>{thirdPlace.character_name}</div>
              {thirdPlace.corporation_name && (
                <div style={{ color: "var(--ev-muted)", fontSize: "var(--font-sm)", marginTop: 3 }}>{thirdPlace.corporation_name}</div>
              )}
            </div>
          </div>
        )}

        {/* Fourth place */}
        {t.status === "complete" && fourthPlace && (
          <div style={{
            padding: "10px 20px", marginBottom: 28,
            background: "rgba(255,255,255,0.02)", borderRadius: 8,
            border: "0.5px solid rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{ borderRadius: "50%", overflow: "hidden", width: 40, height: 40, flexShrink: 0, opacity: 0.6 }}>
              {fourthPlace.portrait_url
                ? <Image src={fourthPlace.portrait_url} alt={fourthPlace.character_name} width={40} height={40}
                    style={{ borderRadius: "50%", objectFit: "cover" }} />
                : <CapsuleerIcon size={40} />
              }
            </div>
            <div style={{ color: "var(--ev-muted)", fontSize: "var(--font-sm)", fontFamily: "monospace" }}>
              4th Place: {fourthPlace.character_name}
            </div>
          </div>
        )}

        {/* Rules card — always visible when registration or active */}
        {(t.status === "registration" || t.status === "active") && (
          <TournamentRulesCard tournament={t} />
        )}

        {/* Registration state */}
        {t.status === "registration" && (
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--ev-muted)" }}>
                  {entrantList.length} / {t.entrant_count} pilots registered
                </span>
              </div>
              <div style={{ height: 6, background: "var(--ev-steel)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  width: `${(entrantList.length / t.entrant_count) * 100}%`,
                  height: "100%", background: GOLD, transition: "width 0.5s",
                }} />
              </div>
            </div>
            <Link href={`/tournament/${id}/register`} style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              padding: "0 32px", marginBottom: 32, minHeight: "var(--btn-height)", minWidth: 200,
              background: GOLD, borderRadius: "var(--border-radius)", color: "var(--ev-bg)",
              fontSize: "var(--font-lg)", fontWeight: 700, fontFamily: "monospace", textDecoration: "none",
            }}>Register Now</Link>
          </>
        )}

        {/* Active/complete CTA buttons */}
        {(t.status === "active" || t.status === "complete") && (
          <div style={{ display: "flex", gap: 16, marginBottom: 32, flexWrap: "wrap" }}>
            <Link href={`/tournament/${id}/bracket`} style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "0 28px", minHeight: "var(--btn-height)", minWidth: 200,
              background: GOLD, borderRadius: "var(--border-radius)",
              color: "var(--ev-bg)", fontSize: "var(--font-lg)", fontWeight: 700, fontFamily: "monospace", textDecoration: "none",
            }}>⚔ View Bracket</Link>
            <Link href={`/tournament/${id}/bets`} style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "0 28px", minHeight: "var(--btn-height)", minWidth: 200,
              background: "transparent",
              border: `1px solid ${GOLD}`, borderRadius: "var(--border-radius)",
              color: GOLD, fontSize: "var(--font-lg)", fontWeight: 700, fontFamily: "monospace", textDecoration: "none",
            }}>🎲 Bookie Board</Link>
          </div>
        )}

        {/* Entrant portrait grid */}
        {entrantList.length > 0 && (
          <>
            <h2 style={{ color: "var(--ev-muted)", fontSize: 10, fontFamily: "monospace", letterSpacing: 2, marginBottom: 16 }}>
              {t.status === "registration" ? "REGISTERED PILOTS" : "ENTRANTS"}
            </h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {entrantList.map((e) => (
                <div key={e.id} style={{ position: "relative" }} title={e.character_name}>
                  <div style={{ borderRadius: "50%", overflow: "hidden", width: "clamp(48px,4vw,80px)", height: "clamp(48px,4vw,80px)" }}>
                    {e.portrait_url
                      ? <Image src={e.portrait_url} alt={e.character_name} width={80} height={80}
                          style={{ borderRadius: "50%", objectFit: "cover", width: "100%", height: "100%" }} />
                      : <CapsuleerIcon size={48} />
                    }
                  </div>
                  {e.seed != null && (
                    <div style={{
                      position: "absolute", bottom: -2, right: -2,
                      background: "var(--ev-bg)", border: `1px solid ${GOLD}`,
                      borderRadius: "50%", width: 16, height: 16,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 8, color: GOLD, fontFamily: "monospace", fontWeight: 700,
                    }}>{e.seed}</div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
