"use client"

import Link from "next/link"
import { calcPropOdds } from "@/lib/props"
import type { PropBet } from "@/lib/props"

interface PropsSummaryCardProps {
  props: PropBet[]
  tournamentId: string
}

export default function PropsSummaryCard({ props, tournamentId }: PropsSummaryCardProps) {
  if (props.length === 0) return null

  const shown = props.slice(0, 3)
  const remaining = props.length - shown.length

  const CATEGORY_LABEL: Record<string, string> = {
    tournament_winner: "WINNER",
    reaches_final: "FINAL",
    reaches_semifinal: "SEMI",
    reaches_top4: "TOP 4",
    round1_elimination: "R1 OUT",
    match_duration: "DURATION",
    isk_destroyed: "ISK",
    custom: "PROP",
  }

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontFamily: "monospace", color: "#f59e0b", letterSpacing: 2, textTransform: "uppercase" }}>
          🎲 Open Proposition Bets
        </div>
        <Link
          href={`/tournament/${tournamentId}/bets`}
          style={{ fontSize: 10, color: "var(--ev-muted)", fontFamily: "monospace", textDecoration: "none", letterSpacing: 1 }}
        >
          View Bookie Board →
        </Link>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {shown.map((prop) => {
          const odds = calcPropOdds(prop.yes_prob)
          return (
            <div
              key={prop.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                background: "rgba(255,255,255,0.03)",
                border: "0.5px solid rgba(200,150,12,0.18)",
                borderRadius: 6,
                flexWrap: "wrap",
              }}
            >
              <span style={{
                fontSize: 8,
                fontFamily: "monospace",
                letterSpacing: 1,
                padding: "2px 6px",
                border: "1px solid #f59e0b44",
                borderRadius: 3,
                color: "#f59e0b",
                flexShrink: 0,
              }}>
                {CATEGORY_LABEL[prop.category] ?? "PROP"}
              </span>
              <span style={{ flex: 1, fontSize: 12, color: "var(--ev-text)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {prop.title}
              </span>
              {prop.target_character_name && (
                <span style={{ fontSize: 11, color: "var(--ev-muted)", flexShrink: 0 }}>
                  {prop.target_character_name}
                </span>
              )}
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontFamily: "monospace", color: "#22c55e" }}>YES {odds.yes.fractional}</span>
                <span style={{ fontSize: 10, fontFamily: "monospace", color: "#ef4444" }}>NO {odds.no.fractional}</span>
              </div>
              <Link
                href={`/tournament/${tournamentId}/bets`}
                style={{
                  fontSize: 10,
                  fontFamily: "monospace",
                  color: "var(--ev-gold)",
                  border: "1px solid rgba(200,150,12,0.4)",
                  borderRadius: 4,
                  padding: "3px 8px",
                  textDecoration: "none",
                  flexShrink: 0,
                }}
              >
                BET
              </Link>
            </div>
          )
        })}
      </div>

      {remaining > 0 && (
        <div style={{ marginTop: 8, textAlign: "right" }}>
          <Link
            href={`/tournament/${tournamentId}/bets`}
            style={{ fontSize: 11, color: "var(--ev-muted)", fontFamily: "monospace", textDecoration: "none" }}
          >
            View {remaining} more prop{remaining !== 1 ? "s" : ""} →
          </Link>
        </div>
      )}
    </div>
  )
}
