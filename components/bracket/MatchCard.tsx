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
      }}>No Data</span>
    )
  }
  if (oddsPercent === undefined) return null
  return (
    <span style={{
      display: "inline-block",
      background: C.steel, border: `0.5px solid ${C.border2}`,
      borderRadius: 20, padding: "3px 10px",
      fontSize: "var(--font-sm)", fontFamily: "monospace",
      color: isFavorite ? C.champagne : C.muted,
    }}>
      {oddsPercent}% · {oddsFractional}
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
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: 88, padding: "10px 14px",
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
      flex: 1,
      display: "flex",
      flexDirection: side === "right" ? "row-reverse" : "row",
      alignItems: "center",
      gap: 10,
      padding: "12px 14px",
      background: isWinner
        ? "rgba(200,150,12,0.07)"
        : isLoser ? "rgba(0,0,0,0.15)" : "transparent",
      borderRadius: side === "left" ? "9px 0 0 9px" : "0 9px 9px 0",
      borderLeft: isWinner && side === "left" ? `3px solid ${C.gold}` : undefined,
      borderRight: isWinner && side === "right" ? `3px solid ${C.gold}` : undefined,
      opacity: isLoser ? 0.38 : 1,
      transition: "opacity 0.3s",
    }}>
      <div style={{ flexShrink: 0, borderRadius: "50%", overflow: "hidden", width: "clamp(48px,4vw,72px)", height: "clamp(48px,4vw,72px)" }}>
        {entrant.portrait_url
          ? <Image src={entrant.portrait_url} alt={entrant.character_name} width={72} height={72}
              style={{ borderRadius: "50%", objectFit: "cover", width: "100%", height: "100%" }} />
          : <CapsuleerSilhouette size={48} />
        }
      </div>
      <div style={{ flex: 1, minWidth: 0, textAlign: side === "right" ? "right" : "left" }}>
        <div style={{
          color: isWinner ? C.champagne : C.text,
          fontWeight: isWinner ? 600 : 400,
          fontSize: "var(--font-base)",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {entrant.character_name}
        </div>
        {entrant.corporation_name && (
          <div style={{ color: C.muted, fontSize: "var(--font-sm)", marginTop: 1 }}>
            {entrant.corporation_name}
          </div>
        )}
        <div style={{ marginTop: 5 }}>
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
}

export default function MatchCard({ match, isAdmin, onResultEntered }: MatchCardProps) {
  const [showModal, setShowModal] = useState(false)

  const isComplete = Boolean(match.winner)
  const bothSet = Boolean(match.entrant1 && match.entrant2)
  const canEnterResult = isAdmin && !isComplete && bothSet

  const e1IsWinner = isComplete && match.winner?.id === match.entrant1?.id
  const e1IsLoser = isComplete && !e1IsWinner && Boolean(match.entrant1)
  const e2IsWinner = isComplete && match.winner?.id === match.entrant2?.id
  const e2IsLoser = isComplete && !e2IsWinner && Boolean(match.entrant2)

  return (
    <>
      <div style={{
        background: C.card,
        border: `0.5px solid ${C.border2}`,
        borderRadius: "var(--border-radius)",
        overflow: "hidden",
        width: "clamp(280px, 22vw, 380px)",
      }}>
        {/* Status pill */}
        <div style={{
          padding: "6px 12px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: `0.5px solid ${C.border2}`,
          background: C.card2,
        }}>
          <span style={{ fontSize: 9, fontFamily: "monospace", color: C.muted, letterSpacing: 1 }}>
            R{match.round} · M{match.match_number}
          </span>
          {isComplete ? (
            <span style={{
              fontSize: 9, fontFamily: "monospace", letterSpacing: 1,
              padding: "2px 8px", borderRadius: 20,
              background: "#1A1508", color: C.champagne, border: `0.5px solid ${C.border2}`,
            }}>Match Complete</span>
          ) : bothSet ? (
            <span style={{
              fontSize: 9, fontFamily: "monospace", letterSpacing: 1,
              padding: "2px 8px", borderRadius: 20,
              background: "#052010", color: C.live, border: "0.5px solid rgba(34,197,94,0.27)",
            }}>● Live Odds</span>
          ) : null}
        </div>

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
            padding: "0 8px", flexShrink: 0,
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

        {(match.killmail_url || canEnterResult) && (
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
