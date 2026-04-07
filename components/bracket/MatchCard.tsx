"use client"

import Image from "next/image"
import { useState } from "react"
import type { BracketWithEntrants, Entrant } from "@/lib/bracket"
import ResultModal from "./ResultModal"

const C = {
  gold: "var(--ev-gold)",
  goldLight: "var(--ev-gold-light)",
  champagne: "var(--ev-champagne)",
  card: "var(--ev-card)",
  card2: "var(--ev-card2)",
  border2: "var(--ev-border2)",
  steel: "var(--ev-steel)",
  text: "var(--ev-text)",
  muted: "var(--ev-muted)",
  live: "var(--ev-live)",
  danger: "var(--ev-danger)",
} as const

const BRONZE = "#CD7F32"
const PORTRAIT_SIZE = "clamp(40px, 3.2vw, 56px)"

function CapsuleerSilhouette({ size }: { size: number }) {
  const r = size / 2
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="24" fill="#0D1420" />
      <circle cx="24" cy="18" r={r * 0.35} fill="#1E2D45" />
      <ellipse cx="24" cy="38" rx={r * 0.52} ry={r * 0.43} fill="#1E2D45" />
    </svg>
  )
}

function OddsPill({
  oddsPercent, oddsFractional, hasData, isFavorite,
}: {
  oddsPercent?: number
  oddsFractional?: string
  hasData?: boolean
  isFavorite?: boolean
}) {
  if (hasData === false) {
    return (
      <span style={{
        display: "inline-block",
        background: C.steel, border: `0.5px solid ${C.border2}`,
        borderRadius: 20, padding: "2px 8px",
        fontSize: "var(--font-sm)", fontFamily: "monospace", color: C.muted,
        whiteSpace: "nowrap",
      }}>No Data</span>
    )
  }
  if (oddsPercent === undefined) return null
  return (
    <span style={{
      display: "inline-block",
      background: C.steel, border: `0.5px solid ${C.border2}`,
      borderRadius: 20, padding: "3px 8px",
      fontSize: "var(--font-sm)", fontFamily: "monospace",
      color: isFavorite ? C.champagne : C.muted,
      whiteSpace: "nowrap",
    }}>
      {oddsPercent}% • {oddsFractional}
    </span>
  )
}

function FighterPanel({
  entrant, isWinner, isLoser, oddsPercent, oddsFractional, hasData, side,
}: {
  entrant: Entrant | null
  isWinner: boolean
  isLoser: boolean
  oddsPercent?: number
  oddsFractional?: string
  hasData?: boolean
  side: "left" | "right"
}) {
  if (!entrant) {
    return (
      <div style={{
        flex: "1 1 0", minWidth: 0, overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: 80, padding: "10px 12px",
        background: "rgba(30,45,69,0.3)",
        borderRadius: side === "left" ? "9px 0 0 9px" : "0 9px 9px 0",
      }}>
        <span style={{ color: C.muted, fontSize: 11, fontFamily: "monospace", opacity: 0.4 }}>TBD</span>
      </div>
    )
  }

  const isFavorite = oddsPercent !== undefined && oddsPercent > 50

  return (
    <div style={{
      flex: "1 1 0",
      minWidth: 0,
      overflow: "hidden",
      display: "flex",
      flexDirection: side === "right" ? "row-reverse" : "row",
      alignItems: "center",
      gap: 8,
      padding: "10px 12px",
      background: isWinner
        ? "rgba(200,150,12,0.07)"
        : isLoser ? "rgba(0,0,0,0.15)" : "transparent",
      borderRadius: side === "left" ? "9px 0 0 9px" : "0 9px 9px 0",
      borderLeft: isWinner && side === "left" ? `3px solid ${C.gold}` : undefined,
      borderRight: isWinner && side === "right" ? `3px solid ${C.gold}` : undefined,
      opacity: isLoser ? 0.4 : 1,
      transition: "opacity 0.3s",
    }}>
      {/* Portrait — never shrinks */}
      <div style={{
        flexShrink: 0,
        borderRadius: "50%",
        overflow: "hidden",
        width: PORTRAIT_SIZE,
        height: PORTRAIT_SIZE,
      }}>
        {entrant.portrait_url
          ? <Image src={entrant.portrait_url} alt={entrant.character_name} width={56} height={56}
              style={{ borderRadius: "50%", objectFit: "cover", width: "100%", height: "100%" }} />
          : <CapsuleerSilhouette size={40} />
        }
      </div>

      {/* Text block — shrinks, clips */}
      <div style={{
        flex: "1 1 0",
        minWidth: 0,
        overflow: "hidden",
        textAlign: side === "right" ? "right" : "left",
      }}>
        <div style={{
          display: "block",
          color: isWinner ? C.champagne : C.text,
          fontWeight: isWinner ? 600 : 400,
          fontSize: "var(--font-base)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: "100%",
        }}>
          {entrant.character_name}
        </div>
        {entrant.corporation_name && (
          <div style={{
            display: "block",
            color: C.muted,
            fontSize: "var(--font-sm)",
            marginTop: 1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "100%",
          }}>
            {entrant.corporation_name}
          </div>
        )}
        <div style={{ marginTop: 4 }}>
          <OddsPill
            oddsPercent={oddsPercent}
            oddsFractional={oddsFractional}
            hasData={hasData}
            isFavorite={isFavorite}
          />
        </div>
      </div>
    </div>
  )
}

export interface MatchCardProps {
  match: BracketWithEntrants
  isAdmin: boolean
  onResultEntered: () => void
  isThirdPlace?: boolean
}

export default function MatchCard({ match, isAdmin, onResultEntered, isThirdPlace }: MatchCardProps) {
  const [showModal, setShowModal] = useState(false)
  const [locked, setLocked] = useState(match.locked)
  const [lockConfirming, setLockConfirming] = useState(false)
  const [lockLoading, setLockLoading] = useState(false)

  const isComplete = Boolean(match.winner)
  const bothSet = Boolean(match.entrant1 && match.entrant2)
  const canEnterResult = isAdmin && !isComplete && bothSet
  const canOverride = isAdmin && !isComplete && Boolean(match.entrant1) && !match.entrant2

  const e1IsWinner = isComplete && match.winner?.id === match.entrant1?.id
  const e1IsLoser = isComplete && !e1IsWinner && Boolean(match.entrant1)
  const e2IsWinner = isComplete && match.winner?.id === match.entrant2?.id
  const e2IsLoser = isComplete && !e2IsWinner && Boolean(match.entrant2)

  async function handleLockToggle(newLocked: boolean) {
    setLockLoading(true)
    setLockConfirming(false)
    try {
      const res = await fetch(`/api/admin/bracket/${match.id}/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locked: newLocked }),
      })
      if (res.ok) {
        setLocked(newLocked)
        onResultEntered() // trigger refetch
      }
    } finally {
      setLockLoading(false)
    }
  }

  return (
    <>
      <div style={{
        background: C.card,
        border: `0.5px solid ${isThirdPlace ? BRONZE + "55" : C.border2}`,
        borderRadius: "var(--border-radius)",
        overflow: "hidden",
        width: "100%",
        minWidth: "clamp(320px, 24vw, 440px)",
      }}>
        {/* Header bar */}
        <div style={{
          padding: "6px 12px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: `0.5px solid ${C.border2}`,
          background: C.card2,
          gap: 8,
        }}>
          {/* Left: round label or 3rd place badge */}
          {isThirdPlace ? (
            <span style={{
              fontSize: 9, fontFamily: "monospace", letterSpacing: 1,
              padding: "2px 8px", borderRadius: 20,
              background: "rgba(205,127,50,0.12)",
              color: BRONZE, border: `0.5px solid ${BRONZE}55`,
            }}>🥉 3RD PLACE</span>
          ) : (
            <span style={{ fontSize: 9, fontFamily: "monospace", color: C.muted, letterSpacing: 1 }}>
              R{match.round} · M{match.match_number}
            </span>
          )}

          {/* Right section: admin lock toggle + status pill */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
            {/* Admin lock toggle — only when match not complete */}
            {isAdmin && !isComplete && (
              lockConfirming ? (
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 8, fontFamily: "monospace", color: C.muted }}>Lock?</span>
                  <button onClick={() => void handleLockToggle(true)} disabled={lockLoading} style={{
                    fontSize: 8, fontFamily: "monospace", padding: "2px 6px", borderRadius: 3,
                    background: "#c0392b", border: "none", color: "#fff", cursor: "pointer",
                  }}>Yes</button>
                  <button onClick={() => setLockConfirming(false)} style={{
                    fontSize: 8, fontFamily: "monospace", padding: "2px 6px", borderRadius: 3,
                    background: "transparent", border: "1px solid rgba(255,255,255,0.15)",
                    color: C.muted, cursor: "pointer",
                  }}>No</button>
                </div>
              ) : locked ? (
                <button
                  onClick={() => void handleLockToggle(false)}
                  disabled={lockLoading}
                  style={{
                    fontSize: 8, fontFamily: "monospace", padding: "2px 8px", borderRadius: 20,
                    background: "#c0392b", border: "none",
                    color: "#fff", cursor: lockLoading ? "not-allowed" : "pointer",
                    letterSpacing: 0.5, opacity: lockLoading ? 0.6 : 1,
                  }}
                >🔒 Bets Locked</button>
              ) : (
                <button
                  onClick={() => setLockConfirming(true)}
                  disabled={lockLoading}
                  style={{
                    fontSize: 8, fontFamily: "monospace", padding: "2px 8px", borderRadius: 20,
                    background: "transparent", border: "1px solid #22c55e",
                    color: "#22c55e", cursor: lockLoading ? "not-allowed" : "pointer",
                    letterSpacing: 0.5,
                  }}
                >🔓 Bets Open</button>
              )
            )}

            {/* Status pill */}
            {isComplete ? (
              <span style={{
                fontSize: 9, fontFamily: "monospace", letterSpacing: 1,
                padding: "2px 8px", borderRadius: 20,
                background: "#1A1508", color: C.champagne, border: `0.5px solid ${C.border2}`,
              }}>Match Complete</span>
            ) : bothSet ? (
              locked ? (
                <span style={{ fontSize: 9, fontFamily: "monospace", color: "#f97316", letterSpacing: 1 }}>🔒</span>
              ) : (
                <span style={{
                  fontSize: 9, fontFamily: "monospace", letterSpacing: 1,
                  padding: "2px 8px", borderRadius: 20,
                  background: "#052010", color: C.live, border: "0.5px solid rgba(34,197,94,0.27)",
                }}>● Live Odds</span>
              )
            ) : null}
          </div>
        </div>

        {/* Fighter row */}
        <div style={{ display: "flex", alignItems: "stretch" }}>
          <FighterPanel
            entrant={match.entrant1}
            isWinner={e1IsWinner}
            isLoser={e1IsLoser}
            oddsPercent={match.odds?.entrant1.percentage}
            oddsFractional={match.odds?.entrant1.fractional}
            hasData={match.odds?.entrant1.hasData}
            side="left"
          />
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
            width: "clamp(28px, 2.5vw, 40px)",
            background: "rgba(200,150,12,0.04)",
          }}>
            <span style={{ color: C.muted, fontSize: 9, fontFamily: "monospace", letterSpacing: 2, opacity: 0.4 }}>VS</span>
          </div>
          <FighterPanel
            entrant={match.entrant2}
            isWinner={e2IsWinner}
            isLoser={e2IsLoser}
            oddsPercent={match.odds?.entrant2.percentage}
            oddsFractional={match.odds?.entrant2.fractional}
            hasData={match.odds?.entrant2.hasData}
            side="right"
          />
        </div>

        {(match.killmail_url || canEnterResult || canOverride) && (
          <div style={{
            borderTop: `0.5px solid ${C.border2}`,
            padding: "6px 12px",
            display: "flex", gap: 8, justifyContent: "flex-end",
            background: C.card2,
          }}>
            {match.killmail_url && (
              <a href={match.killmail_url} target="_blank" rel="noopener noreferrer" style={{
                fontSize: "var(--font-sm)", color: C.champagne, textDecoration: "none",
                padding: "4px 12px", border: `0.5px solid ${C.border2}`,
                borderRadius: "var(--border-radius)", fontFamily: "monospace",
                minHeight: "var(--btn-height-sm)", display: "inline-flex", alignItems: "center",
              }}>⚔ View Kill</a>
            )}
            {canEnterResult && (
              <button onClick={() => setShowModal(true)} style={{
                fontSize: "var(--font-sm)", color: C.gold, background: "transparent",
                padding: "4px 12px", border: `1px solid ${C.gold}`,
                borderRadius: "var(--border-radius)", cursor: "pointer", fontFamily: "monospace",
                minHeight: "var(--btn-height-sm)",
              }}>Enter Result</button>
            )}
            {canOverride && (
              <button onClick={() => setShowModal(true)} style={{
                fontSize: "var(--font-sm)", color: "#f59e0b", background: "transparent",
                padding: "4px 12px", border: "1px solid #f59e0b",
                borderRadius: "var(--border-radius)", cursor: "pointer", fontFamily: "monospace",
                minHeight: "var(--btn-height-sm)",
              }}>Enter Result — Override</button>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <ResultModal
          match={match}
          onClose={() => setShowModal(false)}
          onConfirm={() => { setShowModal(false); onResultEntered() }}
        />
      )}
    </>
  )
}
