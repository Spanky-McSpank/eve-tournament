"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import { createSupabaseClient } from "@/lib/supabase"
import { formatISK } from "@/lib/utils"
import type { BracketWithEntrants } from "@/lib/bracket"
import BetModal from "./BetModal"

const C = {
  gold: "var(--ev-gold)",
  champagne: "var(--ev-champagne)",
  card: "var(--ev-card)",
  card2: "var(--ev-card2)",
  border2: "var(--ev-border2)",
  steel: "var(--ev-steel)",
  text: "var(--ev-text)",
  muted: "var(--ev-muted)",
  live: "var(--ev-live)",
} as const

interface BetRow {
  id: string
  bettor_name: string
  isk_amount: number
  predicted_winner_id: string
  bettor_character_id: number
}

export interface OddsCardProps {
  match: BracketWithEntrants
  tournamentId: string
  currentCharacterId?: number
  onBetPlaced: () => void
  refreshKey?: number
}

function CapsuleerIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="24" fill="#0D1420" />
      <circle cx="24" cy="18" r="8" fill="#1E2D45" />
      <ellipse cx="24" cy="38" rx="12" ry="10" fill="#1E2D45" />
    </svg>
  )
}

export default function OddsCard({
  match, tournamentId, currentCharacterId, onBetPlaced, refreshKey,
}: OddsCardProps) {
  const [bets, setBets] = useState<BetRow[]>([])
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    const supabase = createSupabaseClient()
    void supabase
      .from("bets")
      .select("id, bettor_name, isk_amount, predicted_winner_id, bettor_character_id")
      .eq("bracket_id", match.id)
      .order("placed_at", { ascending: false })
      .then(({ data }) => { if (data) setBets(data as BetRow[]) })
  }, [match.id, refreshKey])

  const e1Pool = bets
    .filter((b) => b.predicted_winner_id === match.entrant1?.id)
    .reduce((s, b) => s + Number(b.isk_amount), 0)
  const e2Pool = bets
    .filter((b) => b.predicted_winner_id === match.entrant2?.id)
    .reduce((s, b) => s + Number(b.isk_amount), 0)
  const totalPool = e1Pool + e2Pool
  const e1Pct = totalPool > 0 ? (e1Pool / totalPool) * 100 : 50
  const e2Pct = 100 - e1Pct
  const leadingPool = e1Pool >= e2Pool ? "left" : "right"

  const hasBet = currentCharacterId
    ? bets.some((b) => Number(b.bettor_character_id) === currentCharacterId)
    : false
  const isComplete = Boolean(match.winner)
  const recentBets = bets.slice(0, 3)

  function FighterCol({ side }: { side: "left" | "right" }) {
    const entrant = side === "left" ? match.entrant1 : match.entrant2
    const odds = side === "left" ? match.odds?.entrant1 : match.odds?.entrant2
    if (!entrant) {
      return (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
          <span style={{ color: C.muted, fontSize: 11, fontFamily: "monospace", opacity: 0.4 }}>TBD</span>
        </div>
      )
    }
    const isWinner = isComplete && match.winner?.id === entrant.id
    const isFavorite = odds?.impliedProb !== undefined && odds.impliedProb > 0.5
    return (
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
        gap: 6, padding: "14px 8px", textAlign: "center",
      }}>
        <div style={{ borderRadius: "50%", overflow: "hidden", width: 48, height: 48, flexShrink: 0 }}>
          {entrant.portrait_url
            ? <Image src={entrant.portrait_url} alt={entrant.character_name} width={48} height={48}
                style={{ borderRadius: "50%", objectFit: "cover" }} />
            : <CapsuleerIcon size={48} />
          }
        </div>
        <div style={{ color: isWinner ? C.champagne : C.text, fontSize: 12, fontWeight: isWinner ? 600 : 400, lineHeight: 1.3 }}>
          {entrant.character_name}
        </div>
        {entrant.corporation_name && (
          <div style={{ color: C.muted, fontSize: 10 }}>{entrant.corporation_name}</div>
        )}
        {odds && (
          odds.hasData === false ? (
            <span style={{
              background: C.steel, border: `0.5px solid ${C.border2}`,
              borderRadius: 20, padding: "2px 8px",
              fontSize: 10, fontFamily: "monospace", color: C.muted,
            }}>No Data</span>
          ) : (
            <span style={{
              background: C.steel, border: `0.5px solid ${C.border2}`,
              borderRadius: 20, padding: "3px 10px",
              fontSize: 10, fontFamily: "monospace",
              color: isFavorite ? C.champagne : C.muted,
            }}>
              {odds.percentage}% · {odds.fractional}
            </span>
          )
        )}
      </div>
    )
  }

  return (
    <>
      <div style={{
        background: C.card, border: `0.5px solid ${C.border2}`,
        borderRadius: 10, overflow: "hidden",
      }}>
        {/* Match header */}
        <div style={{
          padding: "7px 14px",
          borderBottom: `0.5px solid ${C.border2}`,
          background: C.card2,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 10, fontFamily: "monospace", color: C.muted, letterSpacing: 1 }}>
            ROUND {match.round} · MATCH {match.match_number}
          </span>
          {!isComplete && (
            <span style={{
              fontSize: 9, fontFamily: "monospace", letterSpacing: 1,
              padding: "2px 8px", borderRadius: 20,
              background: "#052010", color: C.live, border: "0.5px solid rgba(34,197,94,0.27)",
            }}>● Live</span>
          )}
        </div>

        {/* Fighters */}
        <div style={{ display: "flex", alignItems: "stretch" }}>
          <FighterCol side="left" />
          <div style={{
            display: "flex", alignItems: "center", padding: "0 6px",
            color: C.muted, fontSize: 9, fontFamily: "monospace", letterSpacing: 2,
            flexShrink: 0, opacity: 0.3,
          }}>VS</div>
          <FighterCol side="right" />
        </div>

        {/* Pool bar */}
        <div style={{ padding: "8px 14px 8px" }}>
          <div style={{ textAlign: "center", fontSize: 10, fontFamily: "monospace", color: C.muted, marginBottom: 6 }}>
            {totalPool > 0
              ? <span><span style={{ color: C.champagne }}>{formatISK(totalPool)}</span> in pool</span>
              : "No bets yet"}
          </div>
          <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", background: C.steel }}>
            <div style={{
              width: `${e1Pct}%`,
              background: leadingPool === "left" ? "var(--ev-gold)" : C.steel,
              transition: "width 0.4s",
            }} />
            <div style={{
              width: `${e2Pct}%`,
              background: leadingPool === "right" ? "var(--ev-gold)" : C.steel,
              transition: "width 0.4s",
            }} />
          </div>
        </div>

        {/* Recent bets */}
        {recentBets.length > 0 && (
          <div style={{ padding: "2px 14px 8px" }}>
            {recentBets.map((bet) => {
              const fname = bet.predicted_winner_id === match.entrant1?.id
                ? match.entrant1?.character_name
                : match.entrant2?.character_name
              return (
                <div key={bet.id} style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", lineHeight: 1.9, opacity: 0.6 }}>
                  {bet.bettor_name} · <span style={{ color: C.champagne }}>{formatISK(Number(bet.isk_amount))}</span> on {fname}
                </div>
              )
            })}
          </div>
        )}

        {/* Action button */}
        <div style={{ padding: "8px 14px 12px" }}>
          {isComplete ? (
            <button disabled style={{
              width: "100%", padding: "8px 0", background: "transparent",
              border: `0.5px solid ${C.border2}`, borderRadius: 6,
              color: C.muted, fontSize: 12, fontFamily: "monospace", cursor: "not-allowed", opacity: 0.5,
            }}>Match Complete</button>
          ) : hasBet ? (
            <button disabled style={{
              width: "100%", padding: "8px 0", background: "transparent",
              border: `1px solid rgba(200,150,12,0.3)`, borderRadius: 6,
              color: "rgba(200,150,12,0.5)", fontSize: 12, fontFamily: "monospace", cursor: "not-allowed",
            }}>Bet Placed ✓</button>
          ) : !currentCharacterId ? (
            <button onClick={() => { window.location.href = "/api/auth/eve" }} style={{
              width: "100%", padding: "8px 0", background: "transparent",
              border: `0.5px solid ${C.border2}`, borderRadius: 6,
              color: C.muted, fontSize: 12, fontFamily: "monospace", cursor: "pointer",
            }}>Login to Bet</button>
          ) : (
            <button onClick={() => setShowModal(true)} style={{
              width: "100%", padding: "8px 0",
              background: "var(--ev-gold)", border: "none", borderRadius: 6,
              color: "#080500", fontSize: 12, fontWeight: 600, fontFamily: "monospace", cursor: "pointer",
            }}>Place Bet</button>
          )}
        </div>
      </div>

      {showModal && (
        <BetModal
          match={match}
          tournamentId={tournamentId}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); onBetPlaced() }}
        />
      )}
    </>
  )
}
