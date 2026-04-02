"use client"

import Image from "next/image"
import { useEffect, useState, useCallback } from "react"
import { formatISK } from "@/lib/utils"
import { calculateAcceptorStake } from "@/lib/odds"
import type { BracketWithEntrants } from "@/lib/bracket"
import ProposeBetModal from "./ProposeBetModal"

const C = {
  gold: "var(--ev-gold)",
  champagne: "var(--ev-champagne)",
  card: "var(--ev-card)",
  card2: "var(--ev-card2)",
  border2: "var(--ev-border2)",
  steel: "var(--ev-steel)",
  text: "var(--ev-text)",
  muted: "var(--ev-muted)",
} as const

interface Proposal {
  id: string
  bracket_id: string
  proposer_character_id: number
  proposer_name: string
  predicted_winner_id: string
  isk_amount: number
  implied_prob: number
  status: string
  is_proxy: boolean
  acceptorStake: number
  proposerPortraitUrl: string
  predictedWinnerName: string
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
      <circle cx="24" cy="24" r="24" fill="var(--ev-steel)" />
      <circle cx="24" cy="18" r="8" fill="var(--ev-card2)" />
      <ellipse cx="24" cy="38" rx="12" ry="10" fill="var(--ev-card2)" />
    </svg>
  )
}

function FighterHeader({ side, match }: { side: "left" | "right"; match: BracketWithEntrants }) {
  const entrant = side === "left" ? match.entrant1 : match.entrant2
  const odds = side === "left" ? match.odds?.entrant1 : match.odds?.entrant2
  if (!entrant) return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 6px" }}>
      <div style={{ width: 40, height: 40, borderRadius: "50%", background: C.steel }} />
      <span style={{ color: C.muted, fontSize: 10, fontFamily: "monospace" }}>TBD</span>
    </div>
  )
  const isFavorite = odds && odds.impliedProb > 0.5
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "12px 6px", textAlign: "center" }}>
      <div style={{ borderRadius: "50%", overflow: "hidden", width: 40, height: 40, flexShrink: 0 }}>
        {entrant.portrait_url
          ? <Image src={entrant.portrait_url} alt={entrant.character_name} width={40} height={40}
              style={{ borderRadius: "50%", objectFit: "cover" }} />
          : <CapsuleerIcon size={40} />
        }
      </div>
      <div style={{ color: C.text, fontSize: 12, fontWeight: 500, lineHeight: 1.3 }}>{entrant.character_name}</div>
      {odds && (
        odds.hasData === false ? (
          <span style={{ background: C.steel, border: `0.5px solid ${C.border2}`, borderRadius: 20, padding: "2px 8px", fontSize: 9, fontFamily: "monospace", color: C.muted }}>No Data</span>
        ) : (
          <span style={{
            background: C.steel, border: `0.5px solid ${C.border2}`,
            borderRadius: 20, padding: "2px 8px",
            fontSize: 9, fontFamily: "monospace",
            color: isFavorite ? C.champagne : C.muted,
          }}>{odds.percentage}% · {odds.fractional}</span>
        )
      )}
    </div>
  )
}

export default function OddsCard({
  match, tournamentId, currentCharacterId, onBetPlaced, refreshKey,
}: OddsCardProps) {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [showModal, setShowModal] = useState(false)
  const [accepting, setAccepting] = useState<string | null>(null)
  const [acceptError, setAcceptError] = useState<string | null>(null)

  const fetchProposals = useCallback(async () => {
    const res = await fetch(`/api/tournament/${tournamentId}/proposals`)
    if (!res.ok) return
    const data = await res.json() as { proposals: Proposal[] }
    setProposals((data.proposals ?? []).filter((p) => p.bracket_id === match.id))
  }, [tournamentId, match.id])

  useEffect(() => {
    void fetchProposals()
  }, [fetchProposals, refreshKey])

  const isComplete = Boolean(match.winner)
  const myProposal = proposals.find((p) => p.proposer_character_id === currentCharacterId)
  const alreadyAccepted = false // tracked via refreshKey after accept

  async function handleAccept(proposalId: string, proposerCharId: number) {
    if (!currentCharacterId) { window.location.href = `/api/auth/eve?returnTo=${encodeURIComponent(window.location.pathname)}`; return }
    if (currentCharacterId === proposerCharId) return
    setAccepting(proposalId)
    setAcceptError(null)
    try {
      const res = await fetch(`/api/tournament/${tournamentId}/bet/accept`, {
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
      void fetchProposals()
    } catch (e) {
      setAcceptError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setAccepting(null)
    }
  }

  const matchProposals = proposals

  return (
    <>
      <div style={{
        background: C.card, border: `0.5px solid ${C.border2}`,
        borderRadius: 10, overflow: "hidden", display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          padding: "6px 14px", background: C.card2,
          borderBottom: `0.5px solid ${C.border2}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 10, fontFamily: "monospace", color: C.muted, letterSpacing: 1 }}>
            R{match.round} · M{match.match_number}
          </span>
          {!isComplete && match.locked && (
            <span style={{ fontSize: 9, fontFamily: "monospace", color: "#f97316", letterSpacing: 1 }}>🔒 LOCKED</span>
          )}
          {!isComplete && !match.locked && (
            <span style={{ fontSize: 9, fontFamily: "monospace", padding: "2px 7px", borderRadius: 20, background: "#052010", color: "#22c55e", border: "0.5px solid rgba(34,197,94,0.27)" }}>● LIVE</span>
          )}
          {isComplete && (
            <span style={{ fontSize: 9, fontFamily: "monospace", color: C.muted }}>COMPLETE</span>
          )}
        </div>

        {/* Section A: Match header */}
        <div style={{ display: "flex", alignItems: "stretch" }}>
          <FighterHeader side="left" match={match} />
          <div style={{ display: "flex", alignItems: "center", padding: "0 4px", color: C.muted, fontSize: 9, fontFamily: "monospace", letterSpacing: 2, opacity: 0.3, flexShrink: 0 }}>VS</div>
          <FighterHeader side="right" match={match} />
        </div>

        {/* Section B: Open Proposals */}
        <div style={{ borderTop: `0.5px solid ${C.border2}`, padding: "10px 14px" }}>
          <div style={{ fontSize: 9, fontFamily: "monospace", color: C.muted, letterSpacing: 1, marginBottom: 8 }}>OPEN PROPOSALS</div>

          {acceptError && (
            <div style={{ fontSize: 10, color: "#c0392b", fontFamily: "monospace", marginBottom: 6, padding: "4px 8px", background: "rgba(192,57,43,0.08)", border: "1px solid rgba(192,57,43,0.2)", borderRadius: 3 }}>
              {acceptError}
            </div>
          )}

          {matchProposals.length === 0 ? (
            <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", opacity: 0.5, padding: "4px 0" }}>
              No open bets — be the first
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {matchProposals.map((p) => {
                const isMyProposal = p.proposer_character_id === currentCharacterId
                return (
                  <div key={p.id} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "6px 8px",
                    background: "rgba(255,255,255,0.02)",
                    border: `0.5px solid ${isMyProposal ? "rgba(240,192,64,0.25)" : C.border2}`,
                    borderRadius: 6,
                  }}>
                    <Image
                      src={p.proposerPortraitUrl}
                      alt={p.proposer_name}
                      width={22} height={22}
                      style={{ borderRadius: "50%", flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 10, fontFamily: "monospace", color: C.text, lineHeight: 1.4 }}>
                        <span style={{ color: C.champagne }}>{p.proposer_name}</span>
                        {p.is_proxy && <span style={{ marginLeft: 4, fontSize: 8, color: "#f97316", border: "1px solid #f97316", borderRadius: 3, padding: "0 3px" }}>PROXY</span>}
                        {" "}backs{" "}
                        <span style={{ color: C.champagne }}>{p.predictedWinnerName}</span>
                      </div>
                      <div style={{ fontSize: 10, fontFamily: "monospace", color: C.muted }}>
                        <span style={{ color: C.champagne }}>{formatISK(p.isk_amount)}</span>
                        {" vs "}<span style={{ color: "#aaa" }}>{formatISK(p.acceptorStake)}</span>
                      </div>
                    </div>
                    {isComplete || isMyProposal ? (
                      <span style={{
                        fontSize: 9, fontFamily: "monospace",
                        padding: "3px 8px", borderRadius: 20,
                        border: `1px solid rgba(240,192,64,0.3)`,
                        color: "rgba(240,192,64,0.5)",
                      }}>
                        {isComplete ? "Closed" : "Your Bet"}
                      </span>
                    ) : !currentCharacterId ? (
                      <button onClick={() => { window.location.href = `/api/auth/eve?returnTo=${encodeURIComponent(window.location.pathname)}` }} style={{
                        fontSize: 9, fontFamily: "monospace", padding: "3px 8px", borderRadius: 20,
                        border: `1px solid ${C.border2}`, background: "transparent", color: C.muted, cursor: "pointer",
                      }}>Login</button>
                    ) : (
                      <button
                        onClick={() => void handleAccept(p.id, p.proposer_character_id)}
                        disabled={accepting === p.id || alreadyAccepted}
                        style={{
                          fontSize: 9, fontFamily: "monospace", padding: "3px 10px", borderRadius: 20,
                          border: `1px solid ${C.gold}`, background: "transparent",
                          color: C.champagne, cursor: accepting === p.id ? "not-allowed" : "pointer",
                          whiteSpace: "nowrap", flexShrink: 0,
                        }}
                      >{accepting === p.id ? "···" : "TAKE BET"}</button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Section C: Place bet */}
        <div style={{ padding: "8px 14px 12px", marginTop: "auto" }}>
          {isComplete ? (
            <button disabled style={{
              width: "100%", padding: "8px 0", background: "transparent",
              border: `0.5px solid ${C.border2}`, borderRadius: 6,
              color: C.muted, fontSize: 12, fontFamily: "monospace", cursor: "not-allowed", opacity: 0.5,
            }}>Match Complete</button>
          ) : match.locked ? (
            <button disabled style={{
              width: "100%", padding: "8px 0", background: "transparent",
              border: `0.5px solid rgba(249,115,22,0.3)`, borderRadius: 6,
              color: "#f97316", fontSize: 12, fontFamily: "monospace", cursor: "not-allowed", opacity: 0.7,
            }}>🔒 Betting Locked</button>
          ) : myProposal ? (
            <button disabled style={{
              width: "100%", padding: "8px 0", background: "transparent",
              border: `1px solid rgba(240,192,64,0.3)`, borderRadius: 6,
              color: "rgba(240,192,64,0.5)", fontSize: 12, fontFamily: "monospace", cursor: "not-allowed",
            }}>Proposal Posted ✓</button>
          ) : !currentCharacterId ? (
            <button onClick={() => { window.location.href = `/api/auth/eve?returnTo=${encodeURIComponent(window.location.pathname)}` }} style={{
              width: "100%", padding: "8px 0", background: "transparent",
              border: `0.5px solid ${C.border2}`, borderRadius: 6,
              color: C.muted, fontSize: 12, fontFamily: "monospace", cursor: "pointer",
            }}>Login to Bet</button>
          ) : (
            <button onClick={() => setShowModal(true)} style={{
              width: "100%", padding: "8px 0",
              background: C.gold, border: "none", borderRadius: 6,
              color: "#080500", fontSize: 12, fontWeight: 600, fontFamily: "monospace", cursor: "pointer",
            }}>PLACE BET</button>
          )}
        </div>
      </div>

      {showModal && (
        <ProposeBetModal
          match={match}
          tournamentId={tournamentId}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); onBetPlaced(); void fetchProposals() }}
        />
      )}
    </>
  )
}
