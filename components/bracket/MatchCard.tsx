"use client"

import Image from "next/image"
import { useState } from "react"
import type { BracketWithEntrants, Entrant } from "@/lib/bracket"
import ResultModal from "./ResultModal"

const GOLD = "#f0c040"
const MUTED = "#c8c8c8"

function CapsuleerSilhouette({ size }: { size: number }) {
  const r = size / 2
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="24" fill="#1a1a2e" />
      <circle cx="24" cy="18" r={r * 0.35} fill="#2a2a3e" />
      <ellipse cx="24" cy="38" rx={r * 0.52} ry={r * 0.43} fill="#2a2a3e" />
    </svg>
  )
}

function FighterPanel({
  entrant,
  isWinner,
  isLoser,
  oddsPercent,
  oddsFractional,
  hasData,
  side,
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
        background: "rgba(255,255,255,0.015)",
        borderRadius: side === "left" ? "4px 0 0 4px" : "0 4px 4px 0",
      }}>
        <span style={{ color: "#3a3a4a", fontSize: 11, fontFamily: "monospace" }}>TBD</span>
      </div>
    )
  }

  return (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: side === "right" ? "row-reverse" : "row",
      alignItems: "center",
      gap: 10,
      padding: "10px 14px",
      background: isWinner ? "rgba(240,192,64,0.05)" : isLoser ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.02)",
      borderRadius: side === "left" ? "4px 0 0 4px" : "0 4px 4px 0",
      borderLeft: isWinner && side === "left" ? `3px solid ${GOLD}` : undefined,
      borderRight: isWinner && side === "right" ? `3px solid ${GOLD}` : undefined,
      opacity: isLoser ? 0.4 : 1,
      transition: "opacity 0.3s",
    }}>
      {/* Portrait */}
      <div style={{ flexShrink: 0, borderRadius: "50%", overflow: "hidden", width: 48, height: 48 }}>
        {entrant.portrait_url ? (
          <Image src={entrant.portrait_url} alt={entrant.character_name} width={48} height={48}
            style={{ borderRadius: "50%", objectFit: "cover" }} />
        ) : (
          <CapsuleerSilhouette size={48} />
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0, textAlign: side === "right" ? "right" : "left" }}>
        <div style={{
          color: isWinner ? GOLD : MUTED,
          fontWeight: isWinner ? 600 : 400,
          fontSize: 13,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {entrant.character_name}
        </div>
        {entrant.corporation_name && (
          <div style={{ color: "#555", fontSize: 11, marginTop: 1 }}>
            {entrant.corporation_name}
          </div>
        )}
        <div style={{ marginTop: 3 }}>
          {hasData === false ? (
            <span style={{
              fontSize: 10, padding: "1px 5px",
              border: "1px solid #333", borderRadius: 3,
              color: "#555", fontFamily: "monospace",
            }}>No Data</span>
          ) : oddsPercent !== undefined ? (
            <span style={{ fontSize: 11, fontFamily: "monospace", color: "#777" }}>
              {oddsPercent}% · {oddsFractional}
            </span>
          ) : null}
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
  const e1IsLoser = isComplete && match.winner?.id !== match.entrant1?.id
  const e2IsWinner = isComplete && match.winner?.id === match.entrant2?.id
  const e2IsLoser = isComplete && match.winner?.id !== match.entrant2?.id

  return (
    <>
      <div style={{
        background: "#0d0d1a",
        border: "1px solid rgba(240,192,64,0.12)",
        borderRadius: 5,
        overflow: "hidden",
        width: 320,
      }}>
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
            padding: "0 6px", flexShrink: 0,
            background: "rgba(240,192,64,0.04)",
          }}>
            <span style={{ color: "#383848", fontSize: 9, fontFamily: "monospace", letterSpacing: 2 }}>VS</span>
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
            borderTop: "1px solid rgba(240,192,64,0.07)",
            padding: "5px 10px",
            display: "flex", gap: 8, justifyContent: "flex-end",
            background: "rgba(0,0,0,0.25)",
          }}>
            {match.killmail_url && (
              <a href={match.killmail_url} target="_blank" rel="noopener noreferrer" style={{
                fontSize: 11, color: GOLD, textDecoration: "none",
                padding: "2px 8px", border: `1px solid rgba(240,192,64,0.3)`,
                borderRadius: 3, fontFamily: "monospace",
              }}>⚔ View Kill</a>
            )}
            {canEnterResult && (
              <button onClick={() => setShowModal(true)} style={{
                fontSize: 11, color: GOLD, background: "transparent",
                padding: "2px 8px", border: `1px solid rgba(240,192,64,0.35)`,
                borderRadius: 3, cursor: "pointer", fontFamily: "monospace",
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
