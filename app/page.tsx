"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useEveAuth } from "@/hooks/useEveAuth"
import EveLoginButton from "@/components/ui/EveLoginButton"

const GOLD = "#f0c040"

interface Tournament {
  id: string
  name: string
  status: "registration" | "active" | "complete"
  entrant_count: number
  created_at: string
  currentEntrants: number
}

const STATUS_COLOR: Record<string, string> = {
  registration: "#3b82f6",
  active: "#22c55e",
  complete: GOLD,
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
      {/* Top bar */}
      <div style={{
        padding: "16px 32px",
        borderBottom: "1px solid rgba(240,192,64,0.1)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ color: GOLD, fontSize: 14, fontFamily: "monospace", letterSpacing: 2, fontWeight: 700 }}>
          EVE TOURNAMENT
        </div>
        <EveLoginButton />
      </div>

      {/* Hero */}
      <div style={{ textAlign: "center", padding: "64px 32px 48px" }}>
        <h1 style={{ color: GOLD, fontSize: 42, fontFamily: "monospace", fontWeight: 700, margin: 0, letterSpacing: 2 }}>
          EVE Tournament
        </h1>
        <p style={{ color: "#555", fontSize: 14, fontFamily: "monospace", marginTop: 12, letterSpacing: 1 }}>
          1v1 Championship Bracket &amp; Bookie Board
        </p>
      </div>

      {/* Tournament cards */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 32px 64px" }}>
        {loading || authLoading ? (
          <div style={{ textAlign: "center", color: "#444", fontFamily: "monospace", fontSize: 13, padding: 40 }}>
            Loading...
          </div>
        ) : tournaments.length === 0 ? (
          <div style={{ textAlign: "center", color: "#444", fontFamily: "monospace", fontSize: 13, padding: 40 }}>
            No tournaments yet — check back soon
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
            {tournaments.map((t) => {
              const statusColor = STATUS_COLOR[t.status] ?? "#555"
              return (
                <div key={t.id} style={{
                  background: "#0d0d1a",
                  border: "1px solid rgba(240,192,64,0.12)",
                  borderRadius: 6, padding: 20,
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ color: "#c8c8c8", fontSize: 15, fontWeight: 500, lineHeight: 1.3, flex: 1 }}>
                      {t.name}
                    </div>
                    <span style={{
                      flexShrink: 0, marginLeft: 8,
                      fontSize: 9, fontFamily: "monospace", letterSpacing: 1,
                      padding: "2px 7px", border: "1px solid " + statusColor,
                      borderRadius: 3, color: statusColor, textTransform: "uppercase",
                    }}>{t.status}</span>
                  </div>
                  <div style={{ color: "#555", fontSize: 11, fontFamily: "monospace", marginBottom: 16 }}>
                    {t.currentEntrants} / {t.entrant_count} entrants
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Link href={"/tournament/" + t.id} style={{
                      flex: 1, textAlign: "center", padding: "7px 0",
                      background: GOLD, borderRadius: 4,
                      color: "#0a0a0f", fontSize: 12, fontWeight: 700,
                      fontFamily: "monospace", textDecoration: "none",
                    }}>View Tournament</Link>
                    {t.status === "registration" && (
                      <Link href={"/tournament/" + t.id + "/register"} style={{
                        flex: 1, textAlign: "center", padding: "7px 0",
                        background: "transparent",
                        border: "1px solid " + GOLD,
                        borderRadius: 4,
                        color: GOLD, fontSize: 12, fontWeight: 700,
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
          <div style={{ textAlign: "center", marginTop: 48 }}>
            <Link href="/admin" style={{
              fontSize: 10, color: "#444", fontFamily: "monospace",
              textDecoration: "none", letterSpacing: 1,
            }}>ADMIN PANEL</Link>
          </div>
        )}
      </div>
    </div>
  )
}