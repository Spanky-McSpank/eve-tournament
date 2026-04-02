"use client"

import type { BracketWithEntrants } from "@/lib/bracket"
import MatchCard from "./MatchCard"

function getRoundLabel(round: number, totalRounds: number): string {
  if (round === totalRounds) return "Final"
  if (round === totalRounds - 1 && totalRounds === 2) return "Final"
  if (totalRounds >= 5 && round === 2) return "Round of 32"
  if (totalRounds === 4 && round === 3) return "Quarterfinals"
  if (totalRounds === 4 && round === 2) return "Round of 16"
  if (totalRounds === 3 && round === 2) return "Quarterfinals"
  if (round === totalRounds - 1 && totalRounds > 2) return "Semifinals"
  if (round === 1) return "Round 1"
  return `Round ${round}`
}

export interface BracketColumnProps {
  matches: BracketWithEntrants[]
  round: number
  totalRounds: number
  isAdmin: boolean
  flashedIds: Set<string>
  onResultEntered: () => void
}

export default function BracketColumn({
  matches, round, totalRounds, isAdmin, flashedIds, onResultEntered,
}: BracketColumnProps) {
  const label = getRoundLabel(round, totalRounds)

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
      {/* Column header */}
      <div style={{
        height: 36, display: "flex", alignItems: "center",
        color: "rgba(240,192,64,0.7)", fontSize: "var(--font-lg)",
        fontFamily: "monospace", letterSpacing: 2, textTransform: "uppercase",
        marginBottom: 8,
      }}>
        {label}
      </div>

      {/* Matches */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        justifyContent: "space-around", width: "100%", alignItems: "center",
      }}>
        {matches.map((match) => (
          <div
            key={match.id}
            className={flashedIds.has(match.id) ? "eve-flash" : undefined}
            style={{ padding: "4px 0" }}
          >
            <MatchCard match={match} isAdmin={isAdmin} onResultEntered={onResultEntered} />
          </div>
        ))}
      </div>
    </div>
  )
}
