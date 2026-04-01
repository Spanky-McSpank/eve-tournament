"use client"

import Image from "next/image"
import Link from "next/link"
import { use, useEffect, useState } from "react"
import { useEveAuth } from "@/hooks/useEveAuth"
import EveLoginButton from "@/components/ui/EveLoginButton"

const GOLD = "var(--ev-gold-light)"

interface Tournament {
  id: string
  name: string
  status: string
  entrant_count: number
}

interface Entrant {
  id: string
  character_id: number
  character_name: string
  corporation_name: string | null
  portrait_url: string | null
  kills_30d: number
  losses_30d: number
  isk_destroyed_30d: number
  isk_lost_30d: number
  efficiency: number
}

function EfficiencyBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 60 ? "#22c55e" : pct >= 40 ? GOLD : "#c0392b"
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--ev-muted)" }}>ISK EFFICIENCY</span>
        <span style={{ fontSize: 11, fontFamily: "monospace", color }}>{pct}%</span>
      </div>
      <div style={{ height: 4, background: "var(--ev-steel)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width 0.5s" }} />
      </div>
    </div>
  )
}

export default function RegisterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { character, isAuthenticated, isLoading: authLoading } = useEveAuth()

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [tournamentLoading, setTournamentLoading] = useState(true)
  const [myEntrant, setMyEntrant] = useState<Entrant | null>(null)
  const [entrantCount, setEntrantCount] = useState(0)
  const [registering, setRegistering] = useState(false)
  const [regError, setRegError] = useState<string | null>(null)
  const [registered, setRegistered] = useState(false)

  useEffect(() => {
    void (async () => {
      const [tRes, eRes] = await Promise.all([
        fetch(`/api/tournament/${id}/info`),
        fetch(`/api/tournament/${id}/entrants`),
      ])
      if (tRes.ok) {
        const d = await tRes.json() as { tournament: Tournament }
        setTournament(d.tournament)
      }
      if (eRes.ok) {
        const d = await eRes.json() as { entrants: Entrant[] }
        setEntrantCount(d.entrants.length)
        if (character) {
          const mine = d.entrants.find((e) => e.character_id === character.character_id)
          if (mine) { setMyEntrant(mine); setRegistered(true) }
        }
      }
      setTournamentLoading(false)
    })()
  }, [id, character])

  async function handleRegister() {
    setRegistering(true)
    setRegError(null)
    try {
      const res = await fetch(`/api/tournament/${id}/register`, { method: "POST" })
      const data = await res.json() as { entrant?: Entrant; error?: string }
      if (!res.ok) { setRegError(data.error ?? "Registration failed"); return }
      setMyEntrant(data.entrant ?? null)
      setRegistered(true)
      setEntrantCount((n) => n + 1)
    } catch (e) {
      setRegError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setRegistering(false)
    }
  }

  const pageStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: "var(--ev-bg)",
    backgroundImage: [
      "linear-gradient(rgba(200,150,12,0.03) 1px, transparent 1px)",
      "linear-gradient(90deg, rgba(200,150,12,0.03) 1px, transparent 1px)",
    ].join(", "),
    backgroundSize: "32px 32px",
    color: "var(--ev-text)",
    fontFamily: "system-ui, sans-serif",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 24,
  }

  if (tournamentLoading || authLoading) {
    return (
      <div style={pageStyle}>
        <div style={{ color: "#444", fontFamily: "monospace", fontSize: 13 }}>Loading...</div>
      </div>
    )
  }

  // State A: closed or not found
  if (!tournament || tournament.status !== "registration") {
    return (
      <div style={pageStyle}>
        <div style={{
          background: "var(--ev-card)", border: "0.5px solid var(--ev-border2)",
          borderRadius: 10, padding: 40, textAlign: "center", maxWidth: 400,
        }}>
          <div style={{ color: GOLD, fontSize: 18, fontFamily: "monospace", marginBottom: 12 }}>
            Registration Closed
          </div>
          <div style={{ color: "var(--ev-muted)", fontSize: 13, marginBottom: 20 }}>
            {!tournament ? "Tournament not found." : `This tournament is ${tournament.status}.`}
          </div>
          <Link href={tournament ? `/tournament/${id}` : "/"} style={{
            color: "var(--ev-text)", fontSize: 12, fontFamily: "monospace", textDecoration: "none",
            padding: "6px 16px", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4,
          }}>← Back</Link>
        </div>
      </div>
    )
  }

  // State B: not authenticated
  if (!isAuthenticated) {
    return (
      <div style={pageStyle}>
        <div style={{
          background: "var(--ev-card)", border: "0.5px solid var(--ev-border2)",
          borderRadius: 10, padding: 40, textAlign: "center", maxWidth: 400,
        }}>
          <div style={{ color: GOLD, fontSize: 18, fontFamily: "monospace", marginBottom: 8 }}>
            {tournament.name}
          </div>
          <div style={{ color: "var(--ev-muted)", fontSize: 13, marginBottom: 24 }}>
            Log in with EVE Online to register for this tournament
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <EveLoginButton />
          </div>
        </div>
      </div>
    )
  }

  // State C: already registered
  if (registered && myEntrant) {
    const eff = myEntrant.efficiency ?? 0
    const effPct = Math.round(eff * 100)
    const effColor = effPct >= 60 ? "#22c55e" : effPct >= 40 ? GOLD : "#c0392b"
    return (
      <div style={pageStyle}>
        <div style={{
          background: "var(--ev-card)", border: "0.5px solid var(--ev-border2)",
          borderRadius: 10, padding: 40, maxWidth: 440, width: "100%",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 24 }}>
            <div style={{ borderRadius: "50%", overflow: "hidden", width: 96, height: 96, flexShrink: 0 }}>
              {myEntrant.portrait_url
                ? <Image src={myEntrant.portrait_url} alt={myEntrant.character_name} width={96} height={96}
                    style={{ borderRadius: "50%", objectFit: "cover" }} />
                : <svg width={96} height={96} viewBox="0 0 96 96" fill="none">
                    <circle cx="48" cy="48" r="48" fill="var(--ev-steel)" />
                    <circle cx="48" cy="36" r="16" fill="var(--ev-card2)" />
                    <ellipse cx="48" cy="76" rx="24" ry="20" fill="var(--ev-card2)" />
                  </svg>
              }
            </div>
            <div>
              <div style={{ color: GOLD, fontSize: 18, fontWeight: 600 }}>{myEntrant.character_name}</div>
              {myEntrant.corporation_name && (
                <div style={{ color: "var(--ev-muted)", fontSize: 12, marginTop: 2 }}>{myEntrant.corporation_name}</div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 20, marginBottom: 16 }}>
            <div>
              <div style={{ color: "var(--ev-muted)", fontSize: 10, fontFamily: "monospace", letterSpacing: 1 }}>30D KILLS</div>
              <div style={{ color: "var(--ev-text)", fontSize: 16, fontFamily: "monospace" }}>{myEntrant.kills_30d}</div>
            </div>
            <div>
              <div style={{ color: "var(--ev-muted)", fontSize: 10, fontFamily: "monospace", letterSpacing: 1 }}>30D LOSSES</div>
              <div style={{ color: "var(--ev-text)", fontSize: 16, fontFamily: "monospace" }}>{myEntrant.losses_30d}</div>
            </div>
          </div>
          <EfficiencyBar value={eff} />

          <div style={{
            marginTop: 24, padding: "12px 0", textAlign: "center",
            color: "#22c55e", fontSize: 16, fontWeight: 600,
            border: "1px solid rgba(34,197,94,0.3)", borderRadius: 10,
            background: "rgba(34,197,94,0.06)",
          }}>
            ✓ You&apos;re Registered
          </div>
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <Link href={`/tournament/${id}`} style={{
              fontSize: 12, color: "var(--ev-muted)", fontFamily: "monospace", textDecoration: "none",
            }}>← View Tournament</Link>
          </div>
        </div>
      </div>
    )
  }

  // State D: authenticated, not yet registered
  const spotsRemaining = tournament.entrant_count - entrantCount

  return (
    <div style={pageStyle}>
      <div style={{
        background: "var(--ev-card)", border: "0.5px solid var(--ev-border2)",
        borderRadius: 10, padding: 40, maxWidth: 440, width: "100%",
      }}>
        <div style={{ color: GOLD, fontSize: 16, fontFamily: "monospace", marginBottom: 20, letterSpacing: 1 }}>
          {tournament.name}
        </div>

        {character && (
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
            <div style={{ borderRadius: "50%", overflow: "hidden", width: 96, height: 96, flexShrink: 0 }}>
              <Image
                src={`https://images.evetech.net/characters/${character.character_id}/portrait?size=128`}
                alt={character.character_name}
                width={96} height={96}
                style={{ borderRadius: "50%", objectFit: "cover" }}
              />
            </div>
            <div>
              <div style={{ color: "var(--ev-text)", fontSize: 16, fontWeight: 500 }}>{character.character_name}</div>
              <div style={{ color: "var(--ev-muted)", fontSize: 11, marginTop: 4, fontFamily: "monospace" }}>
                Stats will be fetched on registration
              </div>
            </div>
          </div>
        )}

        {regError && (
          <div style={{
            color: "#c0392b", fontSize: 12, fontFamily: "monospace",
            padding: "8px 12px", background: "rgba(192,57,43,0.08)",
            border: "1px solid rgba(192,57,43,0.22)", borderRadius: 4, marginBottom: 16,
          }}>{regError}</div>
        )}

        <button
          onClick={handleRegister}
          disabled={registering || spotsRemaining <= 0}
          style={{
            width: "100%", padding: "12px 0",
            background: registering || spotsRemaining <= 0 ? "rgba(240,192,64,0.15)" : GOLD,
            border: "none", borderRadius: 10,
            color: registering || spotsRemaining <= 0 ? "var(--ev-muted)" : "var(--ev-bg)",
            fontSize: 14, fontWeight: 700,
            cursor: registering || spotsRemaining <= 0 ? "not-allowed" : "pointer",
            fontFamily: "monospace",
          }}
        >
          {registering ? "Registering..." : `Register for ${tournament.name}`}
        </button>
        <div style={{ textAlign: "center", marginTop: 10, color: "var(--ev-muted)", fontSize: 11, fontFamily: "monospace" }}>
          Spots remaining: {spotsRemaining}
        </div>
      </div>
    </div>
  )
}
