"use client"

import { useState } from "react"
import { calculateAcceptorStake } from "@/lib/odds"
import { formatISK } from "@/lib/utils"

const GOLD = "var(--ev-gold-light)"

interface Proposal {
  id: string
  proposer_name: string
  isk_amount: number
  implied_prob: number
  status: string
}

interface MatchRow {
  id: string
  proposer_name: string
  acceptor_name: string
  proposer_stake: number
  acceptor_stake: number
  outcome: string
}

interface EditBetModalProps {
  proposal: Proposal | null
  defaultTab?: "edit" | "void"
  onClose: () => void
  onSaved: () => void
}

interface ForceSettleModalProps {
  match: MatchRow | null
  onClose: () => void
  onSaved: () => void
}

export function EditBetModal({ proposal, defaultTab = "edit", onClose, onSaved }: EditBetModalProps) {
  const [tab, setTab] = useState<"edit" | "void">(defaultTab)
  const [iskAmount, setIskAmount] = useState(String(proposal?.isk_amount ?? ""))
  const [voidReason, setVoidReason] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!proposal) return null

  const iskNum = Number(iskAmount.replace(/[^0-9]/g, ""))
  const acceptorPreview = iskNum >= 10_000_000
    ? calculateAcceptorStake(iskNum, proposal.implied_prob)
    : null

  async function handleEdit() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/bet/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId: proposal!.id, newIskAmount: iskNum }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) { setError(data.error ?? "Failed"); return }
      onSaved()
    } catch (e) { setError(e instanceof Error ? e.message : "Unknown error") }
    finally { setLoading(false) }
  }

  async function handleVoid() {
    if (voidReason.length < 5) { setError("Reason must be at least 5 characters"); return }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/bet/void", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId: proposal!.id, reason: voidReason }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) { setError(data.error ?? "Failed"); return }
      onSaved()
    } catch (e) { setError(e instanceof Error ? e.message : "Unknown error") }
    finally { setLoading(false) }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }} onClick={onClose}>
      <div style={{
        background: "var(--ev-card)", border: "0.5px solid var(--ev-border2)",
        borderRadius: 10, padding: 28, maxWidth: 420, width: "100%",
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ color: GOLD, fontFamily: "monospace", fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
          Edit Bet — {proposal.proposer_name}
        </div>
        <div style={{ color: "var(--ev-muted)", fontFamily: "monospace", fontSize: 11, marginBottom: 16 }}>
          Current: {formatISK(proposal.isk_amount)} ISK · {Math.round(proposal.implied_prob * 100)}% implied prob
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          {(["edit", "void"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "8px 16px", background: "transparent", border: "none",
              borderBottom: tab === t ? `2px solid ${GOLD}` : "2px solid transparent",
              color: tab === t ? GOLD : "var(--ev-muted)",
              fontSize: 11, fontFamily: "monospace", letterSpacing: 1,
              textTransform: "uppercase", cursor: "pointer", marginBottom: -1,
            }}>{t === "edit" ? "Edit Amount" : "Void Bet"}</button>
          ))}
        </div>

        {tab === "edit" && (
          <div>
            <label style={{ fontSize: 11, fontFamily: "monospace", color: "var(--ev-muted)", display: "block", marginBottom: 6 }}>
              NEW ISK AMOUNT
            </label>
            <input
              type="number"
              value={iskAmount}
              onChange={(e) => setIskAmount(e.target.value)}
              min={10_000_000}
              style={{
                width: "100%", padding: "8px 12px", background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6,
                color: "var(--ev-text)", fontSize: 13, fontFamily: "monospace",
                boxSizing: "border-box",
              }}
            />
            {acceptorPreview !== null && (
              <div style={{ marginTop: 8, fontSize: 11, fontFamily: "monospace", color: "var(--ev-muted)" }}>
                Acceptor stake: <span style={{ color: GOLD }}>{formatISK(acceptorPreview)}</span>
              </div>
            )}
            {error && <div style={{ color: "#c0392b", fontSize: 11, fontFamily: "monospace", marginTop: 8 }}>{error}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={handleEdit} disabled={loading || iskNum < 10_000_000} style={{
                flex: 1, padding: "8px 0", background: GOLD, border: "none", borderRadius: 6,
                color: "var(--ev-bg)", fontSize: 12, fontWeight: 700, fontFamily: "monospace",
                cursor: loading || iskNum < 10_000_000 ? "not-allowed" : "pointer",
                opacity: loading || iskNum < 10_000_000 ? 0.5 : 1,
              }}>{loading ? "Saving..." : "Save"}</button>
              <button onClick={onClose} style={{
                flex: 1, padding: "8px 0", background: "transparent",
                border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6,
                color: "var(--ev-muted)", fontSize: 12, fontFamily: "monospace", cursor: "pointer",
              }}>Cancel</button>
            </div>
          </div>
        )}

        {tab === "void" && (
          <div>
            <label style={{ fontSize: 11, fontFamily: "monospace", color: "var(--ev-muted)", display: "block", marginBottom: 6 }}>
              VOID REASON (min 5 chars)
            </label>
            <textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              rows={3}
              style={{
                width: "100%", padding: "8px 12px", background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6,
                color: "var(--ev-text)", fontSize: 13, fontFamily: "monospace",
                resize: "vertical", boxSizing: "border-box",
              }}
            />
            {error && <div style={{ color: "#c0392b", fontSize: 11, fontFamily: "monospace", marginTop: 6 }}>{error}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={handleVoid} disabled={loading || voidReason.length < 5} style={{
                flex: 1, padding: "8px 0", background: "#c0392b", border: "none", borderRadius: 6,
                color: "#fff", fontSize: 12, fontWeight: 700, fontFamily: "monospace",
                cursor: loading || voidReason.length < 5 ? "not-allowed" : "pointer",
                opacity: loading || voidReason.length < 5 ? 0.5 : 1,
              }}>{loading ? "Voiding..." : "Void Bet"}</button>
              <button onClick={onClose} style={{
                flex: 1, padding: "8px 0", background: "transparent",
                border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6,
                color: "var(--ev-muted)", fontSize: 12, fontFamily: "monospace", cursor: "pointer",
              }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function ForceSettleModal({ match, onClose, onSaved }: ForceSettleModalProps) {
  const [winner, setWinner] = useState<"proposer" | "acceptor">("proposer")
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!match) return null

  async function handleSettle() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/bet/force-settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betMatchId: match!.id, winner, reason }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) { setError(data.error ?? "Failed"); return }
      onSaved()
    } catch (e) { setError(e instanceof Error ? e.message : "Unknown error") }
    finally { setLoading(false) }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }} onClick={onClose}>
      <div style={{
        background: "var(--ev-card)", border: "0.5px solid var(--ev-border2)",
        borderRadius: 10, padding: 28, maxWidth: 420, width: "100%",
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ color: GOLD, fontFamily: "monospace", fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
          Force Settle Match
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {(["proposer", "acceptor"] as const).map((side) => {
            const name = side === "proposer" ? match.proposer_name : match.acceptor_name
            const stake = side === "proposer" ? match.proposer_stake : match.acceptor_stake
            const payout = match.proposer_stake + match.acceptor_stake
            return (
              <button key={side} onClick={() => setWinner(side)} style={{
                flex: 1, padding: "10px 8px",
                background: winner === side ? "rgba(240,192,64,0.12)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${winner === side ? GOLD : "rgba(255,255,255,0.12)"}`,
                borderRadius: 6, cursor: "pointer", textAlign: "left",
              }}>
                <div style={{ fontSize: 11, fontFamily: "monospace", color: GOLD, marginBottom: 2 }}>
                  {side === "proposer" ? "PROPOSER" : "ACCEPTOR"}
                </div>
                <div style={{ fontSize: 12, color: "var(--ev-text)", fontFamily: "monospace" }}>{name}</div>
                <div style={{ fontSize: 10, color: "var(--ev-muted)", fontFamily: "monospace", marginTop: 2 }}>
                  Stake: {formatISK(stake)} → Payout: {formatISK(payout)}
                </div>
              </button>
            )
          })}
        </div>

        <label style={{ fontSize: 11, fontFamily: "monospace", color: "var(--ev-muted)", display: "block", marginBottom: 6 }}>
          SETTLE NOTE (optional)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Admin override reason..."
          rows={2}
          style={{
            width: "100%", padding: "8px 12px", background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6,
            color: "var(--ev-text)", fontSize: 12, fontFamily: "monospace",
            resize: "none", boxSizing: "border-box",
          }}
        />

        {error && <div style={{ color: "#c0392b", fontSize: 11, fontFamily: "monospace", marginTop: 8 }}>{error}</div>}

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={handleSettle} disabled={loading} style={{
            flex: 1, padding: "8px 0", background: GOLD, border: "none", borderRadius: 6,
            color: "var(--ev-bg)", fontSize: 12, fontWeight: 700, fontFamily: "monospace",
            cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1,
          }}>{loading ? "Settling..." : "Force Settle"}</button>
          <button onClick={onClose} style={{
            flex: 1, padding: "8px 0", background: "transparent",
            border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6,
            color: "var(--ev-muted)", fontSize: 12, fontFamily: "monospace", cursor: "pointer",
          }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
