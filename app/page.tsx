"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useEveAuth } from "@/hooks/useEveAuth"
import EveLoginButton from "@/components/ui/EveLoginButton"

interface Tournament {
  id: string
  name: string
  status: "registration" | "active" | "complete"
  entrant_count: number
  created_at: string
  currentEntrants: number
}

const STATUS_BADGE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  registration: { bg: "#0A1535", color: "#60A5FA", border: "#60A5FA44", label: "Registration" },
  active:       { bg: "#052010", color: "#22C55E", border: "#22C55E44", label: "Active" },
  complete:     { bg: "#1A1508", color: "#F0D878", border: "#F0D87844", label: "Complete" },
}

export default function HomePage() {
  const { isAdmin, isLoading: authLoading } = useEveAuth()
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void fetch("/api/tournaments")
      .then((r) => r.ok ? r.json() : { tournaments: [] })
      .then((d: { tournaments?: Tournament[] }) => {
        setTournaments(d.tournaments ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="ev-page" style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* Nav bar */}
      <div style={{
        background: "var(--ev-card)",
        borderBottom: "1.5px solid var(--ev-gold)",
        padding: "14px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ fontSize: "var(--font-lg)", fontFamily: "monospace", letterSpacing: 3, fontWeight: 700 }}>
          <span style={{ color: "var(--ev-text)" }}>EVE </span>
          <span style={{ color: "var(--ev-champagne)" }}>TOURNAMENT</span>
        </div>
        <EveLoginButton />
      </div>

      {/* Hero */}
      <div style={{ textAlign: "center", padding: "72px 32px 52px" }}>
        <h1 style={{
          color: "var(--ev-champagne)",
          fontSize: "var(--font-3xl)", fontFamily: "monospace", fontWeight: 700,
          margin: 0, letterSpacing: 3, lineHeight: 1.1,
        }}>
          EVE TOURNAMENT
        </h1>
        <p style={{
          color: "var(--ev-muted)", fontSize: "var(--font-xl)",
          fontFamily: "monospace", marginTop: 14, letterSpacing: 2,
        }}>
          1v1 Championship · Bookie Board · Live Brackets
        </p>
      </div>

      {/* Tournament cards */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 32px 80px" }}>
        {loading || authLoading ? (
          <div style={{ textAlign: "center", color: "var(--ev-muted)", fontFamily: "monospace", fontSize: 13, padding: 40 }}>
            Loading...
          </div>
        ) : tournaments.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--ev-muted)", fontFamily: "monospace", fontSize: 13, padding: 40 }}>
            No tournaments yet — check back soon
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 20 }}>
            {tournaments.map((t) => {
              const badge = STATUS_BADGE[t.status] ?? STATUS_BADGE.registration
              return (
                <div key={t.id} className="ev-card" style={{ padding: "var(--card-padding)" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ color: "var(--ev-text)", fontSize: "var(--font-base)", fontWeight: 500, lineHeight: 1.3, flex: 1 }}>
                      {t.name}
                    </div>
                    <span style={{
                      flexShrink: 0, marginLeft: 10,
                      fontSize: "var(--font-sm)", fontFamily: "monospace", letterSpacing: 1,
                      padding: "3px 9px",
                      background: badge.bg,
                      border: `1px solid ${badge.border}`,
                      borderRadius: 20, color: badge.color,
                    }}>{badge.label}</span>
                  </div>
                  <div style={{
                    color: "var(--ev-champagne)", fontSize: "var(--font-sm)",
                    fontFamily: "monospace", marginBottom: 18,
                  }}>
                    {t.currentEntrants} / {t.entrant_count} pilots
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Link href={"/tournament/" + t.id} style={{
                      flex: 1, textAlign: "center",
                      padding: "0", minHeight: "var(--btn-height)",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      background: "var(--ev-gold)", borderRadius: "var(--border-radius)",
                      color: "#080500", fontSize: "var(--font-base)", fontWeight: 700,
                      fontFamily: "monospace", textDecoration: "none",
                    }}>View Tournament</Link>
                    {t.status === "registration" && (
                      <Link href={"/tournament/" + t.id + "/register"} style={{
                        flex: 1, textAlign: "center",
                        padding: "0", minHeight: "var(--btn-height)",
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        background: "transparent",
                        border: "1px solid var(--ev-gold)",
                        borderRadius: "var(--border-radius)",
                        color: "var(--ev-gold)", fontSize: "var(--font-base)", fontWeight: 700,
                        fontFamily: "monospace", textDecoration: "none",
                      }}>Register</Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!authLoading && isAdmin && (
          <div style={{ textAlign: "center", marginTop: 52 }}>
            <Link href="/admin" style={{
              fontSize: 10, color: "var(--ev-muted)", fontFamily: "monospace",
              textDecoration: "none", letterSpacing: 2,
              padding: "4px 12px", border: "0.5px solid var(--ev-border2)",
              borderRadius: 4,
            }}>ADMIN PANEL</Link>
          </div>
        )}
      </div>
    </div>
  )
}
