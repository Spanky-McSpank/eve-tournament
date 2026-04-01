import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase"
import type { Entrant } from "@/lib/bracket"

const GOLD = "#f0c040"

const STATUS_COLOR: Record<string, string> = {
  registration: "#3b82f6",
  active: "#22c55e",
  complete: GOLD,
}

function CapsuleerIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="24" fill="#1a1a2e" />
      <circle cx="24" cy="18" r="8" fill="#2a2a3e" />
      <ellipse cx="24" cy="38" rx="12" ry="10" fill="#2a2a3e" />
    </svg>
  )
}

interface Tournament {
  id: string
  name: string
  status: "registration" | "active" | "complete"
  entrant_count: number
}

export default async function TournamentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = createSupabaseServerClient()

  const [{ data: tournament }, { data: entrants }] = await Promise.all([
    supabase.from("tournaments").select("id, name, status, entrant_count").eq("id", id).single(),
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

  // Find champion (winner of final round match)
  let champion: Entrant | null = null
  if (t.status === "complete") {
    const { data: finalMatch } = await supabase
      .from("brackets")
      .select("winner_id")
      .eq("tournament_id", id)
      .eq("round", totalRounds)
      .order("match_number", { ascending: true })
      .limit(1)
      .single()
    if (finalMatch?.winner_id) {
      champion = entrantList.find((e) => e.id === finalMatch.winner_id) ?? null
    }
  }

  const statusColor = STATUS_COLOR[t.status]

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0f",
      backgroundImage: [
        "linear-gradient(rgba(240,192,64,0.03) 1px, transparent 1px)",
        "linear-gradient(90deg, rgba(240,192,64,0.03) 1px, transparent 1px)",
      ].join(", "),
      backgroundSize: "32px 32px",
      color: "#c8c8c8",
      fontFamily: "system-ui, sans-serif",
    }}>
      {/* Header */}
      <div style={{ padding: "32px 32px 0", maxWidth: 1000, margin: "0 auto" }}>
        <Link href="/" style={{ color: "#444", fontSize: 11, fontFamily: "monospace", textDecoration: "none" }}>
          ← All Tournaments
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
          <h1 style={{ color: GOLD, fontSize: 26, fontFamily: "monospace", fontWeight: 700, margin: 0 }}>
            {t.name}
          </h1>
          <span style={{
            fontSize: 10, fontFamily: "monospace", letterSpacing: 2,
            padding: "2px 10px", border: `1px solid ${statusColor}`,
            borderRadius: 3, color: statusColor, textTransform: "uppercase",
          }}>{t.status}</span>
          {t.status !== "registration" && currentRound > 0 && (
            <span style={{ fontSize: 12, color: "#555", fontFamily: "monospace" }}>
              Round {currentRound} of {totalRounds}
            </span>
          )}
        </div>
      </div>

      <div style={{ padding: 32, maxWidth: 1000, margin: "0 auto" }}>
        {/* Champion banner */}
        {t.status === "complete" && champion && (
          <div style={{
            padding: 28, marginBottom: 28,
            border: "1px solid rgba(240,192,64,0.5)",
            background: "rgba(240,192,64,0.04)", borderRadius: 8,
            display: "flex", alignItems: "center", gap: 24,
          }}>
            <div style={{ borderRadius: "50%", overflow: "hidden", width: 128, height: 128, flexShrink: 0 }}>
              {champion.portrait_url
                ? <Image src={champion.portrait_url} alt={champion.character_name} width={128} height={128}
                    style={{ borderRadius: "50%", objectFit: "cover" }} />
                : <CapsuleerIcon size={128} />
              }
            </div>
            <div>
              <div style={{ color: GOLD, fontSize: 11, fontFamily: "monospace", letterSpacing: 2, marginBottom: 4 }}>
                🏆 CHAMPION
              </div>
              <div style={{ color: GOLD, fontSize: 28, fontWeight: 700 }}>{champion.character_name}</div>
              {champion.corporation_name && (
                <div style={{ color: "#888", fontSize: 13, marginTop: 4 }}>{champion.corporation_name}</div>
              )}
              <div style={{ marginTop: 8, fontFamily: "monospace", fontSize: 12, color: "#666" }}>
                {Math.round(champion.efficiency * 100)}% efficiency · {champion.kills_30d}K / {champion.losses_30d}L
              </div>
            </div>
          </div>
        )}

        {/* Registration state */}
        {t.status === "registration" && (
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontFamily: "monospace", color: "#666" }}>
                  {entrantList.length} / {t.entrant_count} pilots registered
                </span>
              </div>
              <div style={{ height: 6, background: "#1a1a2e", borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  width: `${(entrantList.length / t.entrant_count) * 100}%`,
                  height: "100%", background: GOLD, transition: "width 0.5s",
                }} />
              </div>
            </div>
            <Link href={`/tournament/${id}/register`} style={{
              display: "inline-block", padding: "12px 32px", marginBottom: 32,
              background: GOLD, borderRadius: 6, color: "#0a0a0f",
              fontSize: 14, fontWeight: 700, fontFamily: "monospace", textDecoration: "none",
            }}>Register Now</Link>
          </>
        )}

        {/* Active/complete CTA buttons */}
        {(t.status === "active" || t.status === "complete") && (
          <div style={{ display: "flex", gap: 16, marginBottom: 32, flexWrap: "wrap" }}>
            <Link href={`/tournament/${id}/bracket`} style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "12px 28px", background: GOLD, borderRadius: 6,
              color: "#0a0a0f", fontSize: 14, fontWeight: 700, fontFamily: "monospace", textDecoration: "none",
            }}>⚔ View Bracket</Link>
            <Link href={`/tournament/${id}/bets`} style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "12px 28px", background: "transparent",
              border: `1px solid ${GOLD}`, borderRadius: 6,
              color: GOLD, fontSize: 14, fontWeight: 700, fontFamily: "monospace", textDecoration: "none",
            }}>🎲 Bookie Board</Link>
          </div>
        )}

        {/* Entrant portrait grid */}
        {entrantList.length > 0 && (
          <>
            <h2 style={{ color: "#555", fontSize: 10, fontFamily: "monospace", letterSpacing: 2, marginBottom: 16 }}>
              {t.status === "registration" ? "REGISTERED PILOTS" : "ENTRANTS"}
            </h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {entrantList.map((e) => (
                <div key={e.id} style={{ position: "relative" }} title={e.character_name}>
                  <div style={{ borderRadius: "50%", overflow: "hidden", width: 48, height: 48 }}>
                    {e.portrait_url
                      ? <Image src={e.portrait_url} alt={e.character_name} width={48} height={48}
                          style={{ borderRadius: "50%", objectFit: "cover" }} />
                      : <CapsuleerIcon size={48} />
                    }
                  </div>
                  {e.seed != null && (
                    <div style={{
                      position: "absolute", bottom: -2, right: -2,
                      background: "#0a0a0f", border: `1px solid ${GOLD}`,
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
