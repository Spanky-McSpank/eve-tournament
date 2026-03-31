"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import { createSupabaseClient } from "@/lib/supabase"
import { formatISK } from "@/lib/utils"
import type { BracketWithEntrants } from "@/lib/bracket"
import BetModal from "./BetModal"

const GOLD = "#f0c040"
const SLATE = "#475569"

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
      <circle cx="24" cy="24" r="24" fill="#1a1a2e" />
      <circle cx="24" cy="18" r="8" fill="#2a2a3e" />
      <ellipse cx="24" cy="38" rx="12" ry="10" fill="#2a2a3e" />
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
          <span style={{ color: "#333", fontSize: 11, fontFamily: "monospace" }}>TBD</span>
        </div>
      )
    }
    const isWinner = isComplete && match.winner?.id === entrant.id
    return (
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
        gap: 5, padding: "12px 8px", textAlign: "center",
      }}>
        <div style={{ borderRadius: "50%", overflow: "hidden", width: 48, height: 48, flexShrink: 0 }}>
          {entrant.portrait_url
            ? <Image src={entrant.portrait_url} alt={entrant.character_name} width={48} height={48}
                style={{ borderRadius: "50%", objectFit: "cover" }} />
            : <CapsuleerIcon size={48} />
          }
        </div>
        <div style={{ color: isWinner ? GOLD : "#c8c8c8", fontSize: 12, fontWeight: isWinner ? 600 : 400, lineHeight: 1.3 }}>
          {entrant.character_name}
        </div>
        {entrant.corporation_name && (
          <div style={{ color: "#555", fontSize: 10 }}>{entrant.corporation_name}</div>
        )}
        {odds && (
          <div style={{ fontFamily: "monospace", fontSize: 11, color: "#777" }}>
            {odds.hasData === false
              ? <span style={{ border: "1px solid #333", borderRadius: 3, padding: "1px 5px", color: "#555", fontSize: 10 }}>No Data</span>
              : <>{odds.percentage}% · {odds.fractional}</>
            }
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <div style={{
        background: "#0d0d1a",
        border: "1px solid rgba(240,192,64,0.12)",
        borderRadius: 6, overflow: "hidden",
      }}>
        {/* Match header */}
        <div style={{
          padding: "7px 14px",
          borderBottom: "1px solid rgba(240,192,64,0.06)",
          fontSize: 10, fontFamily: "monospace", color: "#4a4a5a", letterSpacing: 1,
        }}>
          ROUND {match.round} · MATCH {match.match_number}
        </div>

        {/* Fighters */}
        <div style={{ display: "flex", alignItems: "stretch" }}>
          <FighterCol side="left" />
          <div style={{
            display: "flex", alignItems: "center", padding: "0 4px",
            color: "#252535", fontSize: 9, fontFamily: "monospace", letterSpacing: 2, flexShrink: 0,
          }}>VS</div>
          <FighterCol side="right" />
        </div>

        {/* Pool bar */}
        <div style={{ padding: "8px 14px 6px" }}>
          <div style={{ textAlign: "center", fontSize: 10, fontFamily: "monospace", color: "#5a5a6a", marginBottom: 5 }}>
            {totalPool > 0 ? `Pool: ${formatISK(totalPool)}` : "No bets yet"}
          </div>
          <div style={{ display: "flex", height: 4, borderRadius: 2, overflow: "hidden", background: "#12121e" }}>
            <div style={{ width: `${e1Pct}%`, background: GOLD, transition: "width 0.4s" }} />
            <div style={{ width: `${e2Pct}%`, background: SLATE, transition: "width 0.4s" }} />
          </div>
        </div>

        {/* Recent bets */}
        {recentBets.length > 0 && (
          <div style={{ padding: "4px 14px 6px" }}>
            {recentBets.map((bet) => {
              const fname = bet.predicted_winner_id === match.entrant1?.id
                ? match.entrant1?.character_name
                : match.entrant2?.character_name
              return (
                <div key={bet.id} style={{ fontSize: 10, color: "#40404e", fontFamily: "monospace", lineHeight: 1.8 }}>
                  {bet.bettor_name} bet {formatISK(Number(bet.isk_amount))} on {fname}
                </div>
              )
            })}
          </div>
        )}

        {/* Action button */}
        <div style={{ padding: "8px 14px 12px" }}>
          {isComplete ? (
            <button disabled style={{
              width: "100%", padding: "7px 0", background: "transparent",
              border: "1px solid rgba(255,255,255,0.07)", borderRadius: 4,
              color: "#383840", fontSize: 12, fontFamily: "monospace", cursor: "not-allowed",
            }}>Match Complete</button>
          ) : hasBet ? (
            <button disabled style={{
              width: "100%", padding: "7px 0", background: "transparent",
              border: "1px solid rgba(240,192,64,0.2)", borderRadius: 4,
              color: "rgba(240,192,64,0.4)", fontSize: 12, fontFamily: "monospace", cursor: "not-allowed",
            }}>Bet Placed ✓</button>
          ) : !currentCharacterId ? (
            <button onClick={() => { window.location.href = "/api/auth/eve" }} style={{
              width: "100%", padding: "7px 0", background: "transparent",
              border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4,
              color: "#888", fontSize: 12, fontFamily: "monospace", cursor: "pointer",
            }}>Login to Bet</button>
          ) : (
            <button onClick={() => setShowModal(true)} style={{
              width: "100%", padding: "7px 0", background: "transparent",
              border: `1px solid ${GOLD}`, borderRadius: 4,
              color: GOLD, fontSize: 12, fontFamily: "monospace", cursor: "pointer",
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
