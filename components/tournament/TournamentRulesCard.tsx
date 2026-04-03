"use client"

import { useState } from "react"
import { type TournamentRules, hasAnyRules } from "@/lib/tournament-rules"

interface TournamentRulesCardProps {
  tournament: TournamentRules & { name?: string }
  collapsible?: boolean
}

export default function TournamentRulesCard({ tournament, collapsible }: TournamentRulesCardProps) {
  const [open, setOpen] = useState(false)

  if (!hasAnyRules(tournament)) return null

  if (collapsible && !open) {
    return (
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => setOpen(true)}
          style={{
            background: "transparent",
            border: "0.5px solid var(--ev-border2)",
            borderRadius: "var(--border-radius)",
            color: "var(--ev-gold)",
            fontFamily: "monospace",
            fontSize: 11,
            letterSpacing: 1,
            padding: "6px 14px",
            cursor: "pointer",
          }}
        >
          ⚔ View Tournament Rules
        </button>
      </div>
    )
  }

  const {
    ship_class,
    ship_restrictions,
    banned_ships,
    engagement_rules,
    system_name,
    system_id,
    fitting_restrictions,
    additional_rules,
  } = tournament

  const bannedHasCommas = banned_ships ? banned_ships.includes(",") : false

  return (
    <div style={{ marginBottom: 16 }}>
      {collapsible && (
        <button
          onClick={() => setOpen(false)}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--ev-muted)",
            fontFamily: "monospace",
            fontSize: 10,
            letterSpacing: 1,
            padding: "0 0 8px 0",
            cursor: "pointer",
            display: "block",
          }}
        >
          ▲ Collapse Rules
        </button>
      )}
      <div style={{
        border: "0.5px solid var(--ev-border2)",
        borderTop: "2px solid var(--ev-gold)",
        borderRadius: "var(--border-radius)",
        background: "var(--ev-card)",
        overflow: "hidden",
      }}>
        {/* Header bar */}
        <div style={{
          padding: "10px 16px",
          background: "var(--ev-card2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--ev-gold)", letterSpacing: 2, textTransform: "uppercase" }}>
            ⚔ TOURNAMENT RULES
          </span>
          {ship_class && (
            <span style={{
              background: "rgba(240,192,64,0.1)",
              border: "1px solid var(--ev-gold)",
              borderRadius: 20,
              padding: "2px 10px",
              fontSize: 9,
              fontFamily: "monospace",
              color: "var(--ev-gold)",
              letterSpacing: 1,
            }}>
              🚀 {ship_class.toUpperCase()}
            </span>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>

          {ship_restrictions && (
            <div>
              <div style={{ fontSize: 9, fontFamily: "monospace", color: "var(--ev-gold)", letterSpacing: 2, marginBottom: 6, textTransform: "uppercase" }}>ALLOWED SHIPS</div>
              <div style={{ fontSize: 13, color: "var(--ev-text)", lineHeight: 1.6 }}>{ship_restrictions}</div>
            </div>
          )}

          {banned_ships && (
            <div>
              <div style={{ fontSize: 9, fontFamily: "monospace", color: "#c0392b", letterSpacing: 2, marginBottom: 6, textTransform: "uppercase" }}>⛔ BANNED SHIPS</div>
              {bannedHasCommas ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {banned_ships.split(",").map((s) => s.trim()).filter(Boolean).map((ship) => (
                    <span key={ship} style={{
                      fontSize: 11, fontFamily: "monospace", color: "#c0392b",
                      background: "rgba(192,57,43,0.1)", border: "0.5px solid rgba(192,57,43,0.3)",
                      borderRadius: 4, padding: "2px 8px",
                    }}>{ship}</span>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "var(--ev-text)", lineHeight: 1.6 }}>{banned_ships}</div>
              )}
            </div>
          )}

          {engagement_rules && (
            <div style={{ background: "rgba(200,150,12,0.04)", border: "0.5px solid rgba(200,150,12,0.15)", borderRadius: 6, padding: "12px 14px" }}>
              <div style={{ fontSize: 9, fontFamily: "monospace", color: "var(--ev-gold)", letterSpacing: 2, marginBottom: 8, textTransform: "uppercase" }}>⚔ ENGAGEMENT RULES</div>
              <div style={{ fontSize: 13, color: "var(--ev-text)", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{engagement_rules}</div>
            </div>
          )}

          {system_name && (
            <div>
              <div style={{ fontSize: 9, fontFamily: "monospace", color: "var(--ev-muted)", letterSpacing: 2, marginBottom: 6, textTransform: "uppercase" }}>📍 FIGHT LOCATION</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 14, fontFamily: "monospace", color: "var(--ev-text)" }}>{system_name}</span>
                {system_id && (
                  <a
                    href={`https://evemaps.dotlan.net/system/${encodeURIComponent(system_name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 10, color: "var(--ev-gold)", fontFamily: "monospace", textDecoration: "none" }}
                  >
                    View on Dotlan →
                  </a>
                )}
              </div>
            </div>
          )}

          {fitting_restrictions && (
            <div>
              <div style={{ fontSize: 9, fontFamily: "monospace", color: "#f59e0b", letterSpacing: 2, marginBottom: 6, textTransform: "uppercase" }}>⚙ FITTING RESTRICTIONS</div>
              <div style={{ fontSize: 13, color: "var(--ev-text)", lineHeight: 1.6 }}>{fitting_restrictions}</div>
            </div>
          )}

          {additional_rules && (
            <div>
              <div style={{ fontSize: 9, fontFamily: "monospace", color: "var(--ev-muted)", letterSpacing: 2, marginBottom: 6, textTransform: "uppercase" }}>ADDITIONAL NOTES</div>
              <div style={{ fontSize: 12, color: "var(--ev-muted)", lineHeight: 1.7, fontStyle: "italic" }}>{additional_rules}</div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
