"use client"

import Image from "next/image"
import { useState } from "react"
import { formatISK } from "@/lib/utils"
import { calcPropOdds, calcPropAcceptorStake } from "@/lib/props"
import type { PropWithProposals, PropCategory } from "@/lib/props"
import PropBetModal from "./PropBetModal"

const C = {
  gold: "var(--ev-gold)",
  champagne: "var(--ev-champagne)",
  card: "var(--ev-card)",
  card2: "var(--ev-card2)",
  border2: "var(--ev-border2)",
  text: "var(--ev-text)",
  muted: "var(--ev-muted)",
} as const

function categoryColor(cat: PropCategory): string {
  switch (cat) {
    case "tournament_winner": return "var(--ev-gold)"
    case "reaches_final":
    case "reaches_semifinal":
    case "reaches_top4": return "#3b82f6"
    case "round1_elimination": return "#c0392b"
    case "match_duration":
    case "isk_destroyed": return "#f59e0b"
    case "custom": return "#9B59B6"
  }
}

function categoryLabel(cat: PropCategory): string {
  switch (cat) {
    case "tournament_winner": return "TOURNAMENT WINNER"
    case "reaches_final": return "REACHES FINAL"
    case "reaches_semifinal":
    case "reaches_top4": return "REACHES SEMIS"
    case "round1_elimination": return "R1 ELIMINATION"
    case "match_duration": return "MATCH DURATION"
    case "isk_destroyed": return "ISK DESTROYED"
    case "custom": return "CUSTOM PROP"
  }
}

function CapsuleerIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="32" fill="var(--ev-steel)" />
      <circle cx="32" cy="24" r="11" fill="var(--ev-card2)" />
      <ellipse cx="32" cy="52" rx="16" ry="13" fill="var(--ev-card2)" />
    </svg>
  )
}

export interface PropCardProps {
  prop: PropWithProposals
  tournamentId: string
  currentCharacterId?: number
  onBetPlaced: () => void
}

export default function PropCard({ prop, tournamentId, currentCharacterId, onBetPlaced }: PropCardProps) {
  const [showModal, setShowModal] = useState(false)
  const [modalSide, setModalSide] = useState<"yes" | "no">("yes")
  const [accepting, setAccepting] = useState<string | null>(null)
  const [acceptError, setAcceptError] = useState<string | null>(null)

  const odds = calcPropOdds(prop.yes_prob)
  const isResolved = prop.status === "resolved_yes" || prop.status === "resolved_no"
  const isLocked = prop.status === "locked"
  const isApproved = prop.status === "approved"
  const catColor = categoryColor(prop.category)

  async function handleAccept(proposalId: string, proposerCharId: number) {
    if (!currentCharacterId) {
      window.location.href = `/api/auth/eve?returnTo=${encodeURIComponent(window.location.pathname)}`
      return
    }
    if (currentCharacterId === proposerCharId) return
    setAccepting(proposalId)
    setAcceptError(null)
    try {
      const res = await fetch(`/api/tournament/${tournamentId}/props/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string }
        setAcceptError(d.error ?? "Failed to accept")
        return
      }
      onBetPlaced()
    } catch (e) {
      setAcceptError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setAccepting(null)
    }
  }

  function openModal(s: "yes" | "no") {
    setModalSide(s)
    setShowModal(true)
  }

  return (
    <>
      <div style={{
        background: C.card, border: `0.5px solid ${C.border2}`,
        borderRadius: 10, overflow: "hidden", display: "flex", flexDirection: "column",
      }}>
        {/* Header: category badge + lock indicator */}
        <div style={{
          padding: "8px 14px", background: C.card2,
          borderBottom: `0.5px solid ${C.border2}`,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{
            fontSize: 9, fontFamily: "monospace", letterSpacing: 1,
            padding: "2px 8px", borderRadius: 20,
            background: `${catColor}18`,
            border: `1px solid ${catColor}40`,
            color: catColor,
          }}>{categoryLabel(prop.category)}</span>
          {prop.locks_at_round && isApproved && (
            <span style={{ fontSize: 9, fontFamily: "monospace", color: "#f59e0b", marginLeft: "auto" }}>
              🔒 Locks R{prop.locks_at_round}
            </span>
          )}
        </div>

        <div style={{ padding: "14px 14px 0" }}>
          {/* Target pilot section */}
          {prop.target_character_id && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ borderRadius: "50%", overflow: "hidden", width: 40, height: 40, flexShrink: 0 }}>
                <Image
                  src={`https://images.evetech.net/characters/${prop.target_character_id}/portrait?size=64`}
                  alt={prop.target_character_name ?? ""}
                  width={40} height={40}
                  style={{ borderRadius: "50%", objectFit: "cover" }}
                  onError={() => {/* ignore */}}
                />
              </div>
              <div>
                <div style={{ color: C.champagne, fontSize: 13, fontWeight: 600 }}>
                  {prop.target_character_name}
                </div>
                <div style={{ color: C.muted, fontSize: 10, fontFamily: "monospace" }}>
                  Will {prop.target_character_name}...
                </div>
              </div>
            </div>
          )}

          {/* Prop title */}
          <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 6, lineHeight: 1.35 }}>
            {prop.title}
          </div>

          {/* Resolution condition */}
          {prop.resolution_condition && (
            <div style={{ fontSize: 10, fontFamily: "monospace", color: C.muted, fontStyle: "italic", marginBottom: 8 }}>
              {prop.resolution_condition}
            </div>
          )}

          {/* Odds display */}
          <div style={{ fontFamily: "monospace", fontSize: 11, color: C.gold, marginBottom: 10 }}>
            <span style={{ color: "#22c55e" }}>YES</span>
            {" — "}{odds.yes.percentage}% · {odds.yes.fractional}
            {"   "}
            <span style={{ color: "#c0392b" }}>NO</span>
            {" — "}{odds.no.percentage}% · {odds.no.fractional}
          </div>
        </div>

        {/* Open proposals section */}
        {prop.proposals.length > 0 && (
          <div style={{ borderTop: `0.5px solid ${C.border2}`, padding: "10px 14px" }}>
            <div style={{ fontSize: 9, fontFamily: "monospace", color: C.muted, letterSpacing: 1, marginBottom: 8 }}>
              OPEN PROPOSALS
            </div>
            {acceptError && (
              <div style={{ fontSize: 10, color: "#c0392b", fontFamily: "monospace", marginBottom: 6, padding: "4px 8px", background: "rgba(192,57,43,0.08)", border: "1px solid rgba(192,57,43,0.2)", borderRadius: 3 }}>
                {acceptError}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {prop.proposals.map((p) => {
                const isMyProposal = p.proposer_character_id === currentCharacterId
                const oppositeSide = p.proposition === "yes" ? "NO" : "YES"
                const acceptorNeeds = calcPropAcceptorStake(p.isk_amount, p.implied_prob)
                return (
                  <div key={p.id} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "6px 8px",
                    background: "rgba(255,255,255,0.02)",
                    border: `0.5px solid ${isMyProposal ? "rgba(240,192,64,0.25)" : C.border2}`,
                    borderRadius: 6,
                  }}>
                    <div style={{ borderRadius: "50%", overflow: "hidden", width: 22, height: 22, flexShrink: 0, background: "#333" }}>
                      {!p.is_anonymous && (
                        <Image
                          src={`https://images.evetech.net/characters/${p.proposer_character_id}/portrait?size=32`}
                          alt={p.proposer_name}
                          width={22} height={22}
                          style={{ borderRadius: "50%" }}
                        />
                      )}
                      {p.is_anonymous && <CapsuleerIcon size={22} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 10, fontFamily: "monospace", color: C.text, lineHeight: 1.4 }}>
                        <span style={{ color: C.champagne }}>{p.is_anonymous ? "Anonymous" : p.proposer_name}</span>
                        {" backs "}
                        <span style={{
                          color: p.proposition === "yes" ? "#22c55e" : "#c0392b",
                          fontWeight: 700,
                        }}>{p.proposition.toUpperCase()}</span>
                      </div>
                      <div style={{ fontSize: 10, fontFamily: "monospace", color: C.muted }}>
                        <span style={{ color: C.champagne }}>{formatISK(p.isk_amount)}</span>
                        {" vs "}<span style={{ color: "#aaa" }}>{formatISK(acceptorNeeds)}</span>
                      </div>
                    </div>
                    {isMyProposal || !isApproved ? (
                      <span style={{
                        fontSize: 9, fontFamily: "monospace",
                        padding: "3px 8px", borderRadius: 20,
                        border: "1px solid rgba(240,192,64,0.3)",
                        color: "rgba(240,192,64,0.5)",
                      }}>
                        {isMyProposal ? "Your Bet" : isLocked ? "🔒" : "Closed"}
                      </span>
                    ) : !currentCharacterId ? (
                      <button onClick={() => { window.location.href = `/api/auth/eve?returnTo=${encodeURIComponent(window.location.pathname)}` }} style={{
                        fontSize: 9, fontFamily: "monospace", padding: "3px 8px", borderRadius: 20,
                        border: `1px solid ${C.border2}`, background: "transparent", color: C.muted, cursor: "pointer",
                      }}>Login</button>
                    ) : (
                      <button
                        onClick={() => void handleAccept(p.id, p.proposer_character_id)}
                        disabled={accepting === p.id}
                        style={{
                          fontSize: 9, fontFamily: "monospace", padding: "3px 10px", borderRadius: 20,
                          border: `1px solid ${C.gold}`, background: "transparent",
                          color: C.champagne, cursor: accepting === p.id ? "not-allowed" : "pointer",
                          whiteSpace: "nowrap", flexShrink: 0,
                        }}
                      >{accepting === p.id ? "···" : `TAKE ${oppositeSide}`}</button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Resolved banner */}
        {isResolved && (
          <div style={{
            margin: "10px 14px", padding: "10px 14px", borderRadius: 6, textAlign: "center",
            background: prop.status === "resolved_yes" ? "rgba(34,197,94,0.08)" : "rgba(192,57,43,0.08)",
            border: `1px solid ${prop.status === "resolved_yes" ? "rgba(34,197,94,0.3)" : "rgba(192,57,43,0.3)"}`,
          }}>
            <div style={{
              fontFamily: "monospace", fontSize: 13, fontWeight: 700,
              color: prop.status === "resolved_yes" ? "#22c55e" : "#c0392b",
            }}>
              {prop.status === "resolved_yes" ? "✓ CAME TRUE" : "✗ DID NOT HAPPEN"}
            </div>
            {prop.resolution_note && (
              <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", marginTop: 4 }}>
                {prop.resolution_note}
              </div>
            )}
          </div>
        )}

        {/* Locked banner */}
        {isLocked && (
          <div style={{
            margin: "10px 14px", padding: "10px 14px", borderRadius: 6, textAlign: "center",
            background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)",
          }}>
            <div style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 600, color: "#f59e0b" }}>
              🔒 LOCKED — Awaiting Resolution
            </div>
          </div>
        )}

        {/* Action buttons */}
        {isApproved && (
          <div style={{ padding: "8px 14px 14px", display: "flex", gap: 8 }}>
            {!currentCharacterId ? (
              <button onClick={() => { window.location.href = `/api/auth/eve?returnTo=${encodeURIComponent(window.location.pathname)}` }} style={{
                flex: 1, padding: "8px 0", background: "transparent",
                border: `0.5px solid ${C.border2}`, borderRadius: 6,
                color: C.muted, fontSize: 12, fontFamily: "monospace", cursor: "pointer",
              }}>Login to Bet</button>
            ) : (
              <>
                <button onClick={() => openModal("yes")} style={{
                  flex: 1, padding: "8px 0",
                  background: C.gold, border: "none", borderRadius: 6,
                  color: "#080500", fontSize: 12, fontWeight: 600, fontFamily: "monospace", cursor: "pointer",
                }}>BET YES</button>
                <button onClick={() => openModal("no")} style={{
                  flex: 1, padding: "8px 0",
                  background: "transparent", border: "1px solid rgba(192,57,43,0.5)", borderRadius: 6,
                  color: "#c0392b", fontSize: 12, fontWeight: 600, fontFamily: "monospace", cursor: "pointer",
                }}>BET NO</button>
              </>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <PropBetModal
          prop={prop}
          tournamentId={tournamentId}
          initialSide={modalSide}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); onBetPlaced() }}
        />
      )}
    </>
  )
}
