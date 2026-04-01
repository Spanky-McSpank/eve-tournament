"use client"

import { useEffect, useState } from "react"
import { createSupabaseClient } from "@/lib/supabase"
import { formatISK } from "@/lib/utils"

const GOLD = "var(--ev-gold-light)"

interface Settlement {
  id: string
  round: number
  from_character_id: number
  from_character_name: string
  to_character_id: number
  to_character_name: string
  isk_amount: number
  is_paid: boolean
  created_at: string
}

export interface SettlementBoardProps {
  tournamentId: string
  isAdmin?: boolean
  refreshKey?: number
}

export default function SettlementBoard({ tournamentId, isAdmin, refreshKey }: SettlementBoardProps) {
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [loading, setLoading] = useState(true)
  const [payingId, setPayingId] = useState<string | null>(null)

  async function fetchSettlements() {
    try {
      const res = await fetch(`/api/tournament/${tournamentId}/settlements`)
      if (res.ok) {
        const data = await res.json() as { settlements: Settlement[] }
        setSettlements(data.settlements ?? [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchSettlements()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, refreshKey])

  // Realtime subscription
  useEffect(() => {
    const supabase = createSupabaseClient()
    const channel = supabase
      .channel(`settlements-${tournamentId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "settlements",
        filter: `tournament_id=eq.${tournamentId}`,
      }, () => { void fetchSettlements() })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId])

  async function handleMarkPaid(settlementId: string) {
    setPayingId(settlementId)
    try {
      const res = await fetch(`/api/tournament/${tournamentId}/settlement/${settlementId}/pay`, { method: "POST" })
      if (res.ok) void fetchSettlements()
    } finally {
      setPayingId(null)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#444", fontFamily: "monospace", fontSize: 12 }}>
        Loading settlements...
      </div>
    )
  }

  if (settlements.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#444", fontFamily: "monospace", fontSize: 13 }}>
        No settlements yet — they appear after each round completes
      </div>
    )
  }

  // Group by round
  const rounds = [...new Set(settlements.map((s) => s.round))].sort((a, b) => a - b)

  // Compute net position per character across all settlements
  const netMap = new Map<number, { name: string; net: number }>()
  for (const s of settlements) {
    if (!s.is_paid) continue // only count resolved debts in position
    const loser = netMap.get(s.from_character_id) ?? { name: s.from_character_name, net: 0 }
    loser.net -= s.isk_amount
    netMap.set(s.from_character_id, loser)

    const winner = netMap.get(s.to_character_id) ?? { name: s.to_character_name, net: 0 }
    winner.net += s.isk_amount
    netMap.set(s.to_character_id, winner)
  }

  const netPositions = [...netMap.entries()]
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.net - a.net)

  return (
    <div>
      {/* Round-by-round settlements */}
      {rounds.map((round) => {
        const roundSettlements = settlements.filter((s) => s.round === round)
        const allPaid = roundSettlements.every((s) => s.is_paid)
        return (
          <div key={round} style={{ marginBottom: 28 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 12, marginBottom: 12,
            }}>
              <h3 style={{ color: GOLD, fontSize: 11, fontFamily: "monospace", letterSpacing: 2, fontWeight: 600, margin: 0 }}>
                ROUND {round} SETTLEMENT
              </h3>
              {allPaid && (
                <span style={{ fontSize: 9, fontFamily: "monospace", padding: "2px 8px", borderRadius: 10, background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}>
                  ALL PAID
                </span>
              )}
            </div>
            <div style={{
              background: "var(--ev-card)", border: "0.5px solid var(--ev-border2)",
              borderRadius: 8, overflow: "hidden",
            }}>
              {roundSettlements.map((s, i) => (
                <div key={s.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 14px",
                  background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
                  borderBottom: i < roundSettlements.length - 1 ? "0.5px solid var(--ev-border2)" : "none",
                }}>
                  <div style={{ flex: 1, fontFamily: "monospace", fontSize: 12, color: "var(--ev-text)" }}>
                    <span style={{ color: "#c0392b" }}>{s.from_character_name}</span>
                    <span style={{ color: "var(--ev-muted)", margin: "0 6px" }}>owes</span>
                    <span style={{ color: "#27ae60" }}>{s.to_character_name}</span>
                    <span style={{ color: GOLD, marginLeft: 8 }}>— {formatISK(s.isk_amount)}</span>
                  </div>
                  {s.is_paid ? (
                    <span style={{ fontSize: 10, fontFamily: "monospace", color: "#22c55e", letterSpacing: 1 }}>
                      PAID ✓
                    </span>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 10, fontFamily: "monospace", color: GOLD, letterSpacing: 1 }}>
                        PENDING
                      </span>
                      {isAdmin && (
                        <button
                          onClick={() => void handleMarkPaid(s.id)}
                          disabled={payingId === s.id}
                          style={{
                            fontSize: 9, fontFamily: "monospace", padding: "3px 8px",
                            background: "transparent",
                            border: "1px solid rgba(34,197,94,0.4)", borderRadius: 3,
                            color: "#22c55e", cursor: payingId === s.id ? "not-allowed" : "pointer",
                          }}
                        >{payingId === s.id ? "···" : "Mark Paid"}</button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Net positions */}
      {netPositions.length > 0 && (
        <div>
          <h3 style={{ color: GOLD, fontSize: 11, fontFamily: "monospace", letterSpacing: 2, fontWeight: 600, margin: "0 0 12px" }}>
            NET POSITIONS (PAID)
          </h3>
          <div style={{ background: "var(--ev-card)", border: "0.5px solid var(--ev-border2)", borderRadius: 8, overflow: "hidden" }}>
            {netPositions.map((p, i) => (
              <div key={p.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 14px",
                background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
                borderBottom: i < netPositions.length - 1 ? "0.5px solid var(--ev-border2)" : "none",
              }}>
                <span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--ev-text)" }}>{p.name}</span>
                <span style={{
                  fontFamily: "monospace", fontSize: 12,
                  color: p.net >= 0 ? "#27ae60" : "#c0392b",
                }}>
                  {p.net >= 0 ? "+" : ""}{formatISK(p.net)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
