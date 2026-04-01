"use client"

import Image from "next/image"
import { useState } from "react"
import { formatISK } from "@/lib/utils"
import { calculateAcceptorStake } from "@/lib/odds"
import type { BracketWithEntrants, Entrant } from "@/lib/bracket"

const GOLD = "var(--ev-gold-light)"

function CapsuleerIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="32" fill="var(--ev-steel)" />
      <circle cx="32" cy="24" r="11" fill="var(--ev-card2)" />
      <ellipse cx="32" cy="52" rx="16" ry="13" fill="var(--ev-card2)" />
    </svg>
  )
}

function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  const steps = [{ n: 1, label: "Fighter" }, { n: 2, label: "Stake" }, { n: 3, label: "Confirm" }]
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 20 }}>
      {steps.map((s, i) => (
        <div key={s.n} style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 20, height: 20, borderRadius: "50%",
              background: s.n <= current ? GOLD : "var(--ev-steel)",
              border: `1px solid ${s.n <= current ? GOLD : "#333"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, color: s.n <= current ? "var(--ev-bg)" : "#444",
              fontFamily: "monospace", fontWeight: 700,
            }}>{s.n < current ? "✓" : s.n}</div>
            <span style={{ fontSize: 10, fontFamily: "monospace", color: s.n === current ? GOLD : "#444", letterSpacing: 1 }}>
              {s.label.toUpperCase()}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div style={{ width: 24, height: 1, background: "#222", margin: "0 8px" }} />
          )}
        </div>
      ))}
    </div>
  )
}

export interface ProposeBetModalProps {
  match: BracketWithEntrants
  tournamentId: string
  onClose: () => void
  onSuccess: () => void
}

export default function ProposeBetModal({ match, tournamentId, onClose, onSuccess }: ProposeBetModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedEntrant, setSelectedEntrant] = useState<Entrant | null>(null)
  const [rawAmount, setRawAmount] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const iskAmount = rawAmount ? parseInt(rawAmount.replace(/,/g, ""), 10) : 0

  const selectedOdds = selectedEntrant?.id === match.entrant1?.id
    ? match.odds?.entrant1
    : selectedEntrant?.id === match.entrant2?.id
    ? match.odds?.entrant2
    : null

  const impliedProb = selectedOdds?.impliedProb ?? 0.5
  const acceptorStake = iskAmount > 0 ? calculateAcceptorStake(iskAmount, impliedProb) : 0
  const totalPot = iskAmount + acceptorStake

  function handleAmountInput(val: string) {
    const digits = val.replace(/[^0-9]/g, "")
    if (!digits) { setRawAmount(""); return }
    setRawAmount(parseInt(digits, 10).toLocaleString("en-US"))
  }

  async function handleConfirm() {
    if (!selectedEntrant || iskAmount <= 0) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/tournament/${tournamentId}/bet/propose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bracketId: match.id,
          predictedWinnerId: selectedEntrant.id,
          iskAmount,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        setError(data.error ?? "Request failed")
        return
      }
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  function FighterCard({ entrant, selected, onSelect }: { entrant: Entrant; selected: boolean; onSelect: () => void }) {
    const odds = entrant.id === match.entrant1?.id ? match.odds?.entrant1 : match.odds?.entrant2
    return (
      <button onClick={onSelect} style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
        gap: 8, padding: "16px 10px",
        background: selected ? "rgba(240,192,64,0.07)" : "rgba(255,255,255,0.02)",
        border: `2px solid ${selected ? GOLD : "rgba(255,255,255,0.09)"}`,
        borderRadius: 10, cursor: "pointer",
        opacity: selectedEntrant && !selected ? 0.35 : 1,
        transition: "all 0.15s",
      }}>
        <div style={{ borderRadius: "50%", overflow: "hidden", width: 64, height: 64, flexShrink: 0 }}>
          {entrant.portrait_url
            ? <Image src={entrant.portrait_url} alt={entrant.character_name} width={64} height={64}
                style={{ borderRadius: "50%", objectFit: "cover" }} />
            : <CapsuleerIcon size={64} />
          }
        </div>
        <div style={{ color: selected ? GOLD : "var(--ev-text)", fontWeight: selected ? 600 : 400, fontSize: 13, textAlign: "center" }}>
          {entrant.character_name}
        </div>
        {entrant.corporation_name && (
          <div style={{ color: "var(--ev-muted)", fontSize: 11 }}>{entrant.corporation_name}</div>
        )}
        {odds && (
          <div style={{ fontFamily: "monospace", fontSize: 11, color: "#777" }}>
            {odds.hasData === false ? "No Data" : `${odds.percentage}% · ${odds.fractional}`}
          </div>
        )}
      </button>
    )
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
      }}
    >
      <div style={{
        background: "var(--ev-card)", border: "1px solid var(--ev-border2)",
        borderRadius: 10, padding: 24, width: "100%", maxWidth: 500, margin: "0 16px",
      }}>
        <StepIndicator current={step} />

        {/* Step 1: Pick fighter */}
        {step === 1 && (
          <>
            <div style={{ color: GOLD, fontSize: 13, fontFamily: "monospace", letterSpacing: 1, marginBottom: 16 }}>
              PICK YOUR FIGHTER
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              {match.entrant1 && (
                <FighterCard entrant={match.entrant1} selected={selectedEntrant?.id === match.entrant1.id}
                  onSelect={() => setSelectedEntrant(match.entrant1)} />
              )}
              {match.entrant2 && (
                <FighterCard entrant={match.entrant2} selected={selectedEntrant?.id === match.entrant2.id}
                  onSelect={() => setSelectedEntrant(match.entrant2)} />
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={onClose} style={{
                padding: "7px 16px", background: "transparent",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4,
                color: "var(--ev-muted)", fontSize: 12, cursor: "pointer", fontFamily: "monospace",
              }}>Cancel</button>
              <button onClick={() => setStep(2)} disabled={!selectedEntrant} style={{
                padding: "7px 16px", minWidth: 100,
                background: selectedEntrant ? GOLD : "rgba(240,192,64,0.15)",
                border: "none", borderRadius: 4,
                color: selectedEntrant ? "var(--ev-bg)" : "var(--ev-muted)",
                fontSize: 12, fontWeight: 600,
                cursor: selectedEntrant ? "pointer" : "not-allowed", fontFamily: "monospace",
              }}>Next →</button>
            </div>
          </>
        )}

        {/* Step 2: Enter stake */}
        {step === 2 && (
          <>
            <div style={{ color: GOLD, fontSize: 13, fontFamily: "monospace", letterSpacing: 1, marginBottom: 16 }}>
              YOUR STAKE
            </div>

            <div style={{ marginBottom: 12 }}>
              <input
                type="text"
                value={rawAmount}
                onChange={(e) => handleAmountInput(e.target.value)}
                placeholder="0"
                autoFocus
                style={{
                  width: "100%", padding: "10px 12px",
                  background: "var(--ev-card2)", border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 4, color: GOLD, fontSize: 18, fontFamily: "monospace",
                  outline: "none", boxSizing: "border-box", textAlign: "right",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {[{ label: "100M", val: 100_000_000 }, { label: "500M", val: 500_000_000 },
                { label: "1B", val: 1_000_000_000 }, { label: "5B", val: 5_000_000_000 }].map((q) => (
                <button key={q.label} onClick={() => setRawAmount(q.val.toLocaleString("en-US"))} style={{
                  flex: 1, padding: "5px 0",
                  background: "rgba(240,192,64,0.06)", border: "1px solid rgba(240,192,64,0.2)",
                  borderRadius: 3, color: "#aaa", fontSize: 11, fontFamily: "monospace", cursor: "pointer",
                }}>{q.label}</button>
              ))}
            </div>

            {iskAmount > 0 && (
              <div style={{
                padding: "12px 14px", background: "rgba(240,192,64,0.04)",
                border: "1px solid rgba(240,192,64,0.2)", borderRadius: 6, marginBottom: 16,
                fontFamily: "monospace", fontSize: 11, lineHeight: 1.8, color: "var(--ev-muted)",
              }}>
                <div>Your stake: <span style={{ color: GOLD }}>{formatISK(iskAmount)}</span></div>
                <div>Opponent must risk: <span style={{ color: GOLD }}>{formatISK(acceptorStake)}</span></div>
                <div>If you win you collect: <span style={{ color: GOLD }}>{formatISK(totalPot)}</span></div>
                <div>Your implied win chance: <span style={{ color: GOLD }}>{selectedOdds?.percentage ?? 50}%</span></div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <button onClick={() => setStep(1)} style={{
                padding: "7px 16px", background: "transparent",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4,
                color: "var(--ev-muted)", fontSize: 12, cursor: "pointer", fontFamily: "monospace",
              }}>← Back</button>
              <button onClick={() => setStep(3)} disabled={iskAmount < 10_000_000} style={{
                padding: "7px 16px", minWidth: 100,
                background: iskAmount >= 10_000_000 ? GOLD : "rgba(240,192,64,0.15)",
                border: "none", borderRadius: 4,
                color: iskAmount >= 10_000_000 ? "var(--ev-bg)" : "var(--ev-muted)",
                fontSize: 12, fontWeight: 600,
                cursor: iskAmount >= 10_000_000 ? "pointer" : "not-allowed", fontFamily: "monospace",
              }}>Next →</button>
            </div>
          </>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && selectedEntrant && (
          <>
            <div style={{ color: GOLD, fontSize: 13, fontFamily: "monospace", letterSpacing: 1, marginBottom: 16 }}>
              CONFIRM PROPOSAL
            </div>

            <div style={{
              padding: 16, background: "rgba(240,192,64,0.04)",
              border: "0.5px solid var(--ev-border2)", borderRadius: 10, marginBottom: 16,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
                <div style={{ borderRadius: "50%", overflow: "hidden", width: 48, height: 48, flexShrink: 0 }}>
                  {selectedEntrant.portrait_url
                    ? <Image src={selectedEntrant.portrait_url} alt={selectedEntrant.character_name} width={48} height={48}
                        style={{ borderRadius: "50%", objectFit: "cover" }} />
                    : <CapsuleerIcon size={48} />
                  }
                </div>
                <div>
                  <div style={{ color: GOLD, fontSize: 14, fontWeight: 600 }}>{selectedEntrant.character_name}</div>
                  {selectedEntrant.corporation_name && (
                    <div style={{ color: "var(--ev-muted)", fontSize: 11, marginTop: 2 }}>{selectedEntrant.corporation_name}</div>
                  )}
                </div>
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--ev-muted)", lineHeight: 1.8 }}>
                <div>You are risking: <span style={{ color: GOLD }}>{formatISK(iskAmount)}</span></div>
                <div>Opponent must risk: <span style={{ color: GOLD }}>{formatISK(acceptorStake)}</span></div>
                <div>Total pot if matched: <span style={{ color: GOLD }}>{formatISK(totalPot)}</span></div>
                <div>Odds: <span style={{ color: GOLD }}>{selectedOdds?.fractional ?? "1/1"}</span> ({selectedOdds?.percentage ?? 50}% win chance)</div>
              </div>
            </div>

            {error && (
              <div style={{
                color: "#c0392b", fontSize: 12, fontFamily: "monospace",
                marginBottom: 14, padding: "8px 10px",
                background: "rgba(192,57,43,0.08)", border: "1px solid rgba(192,57,43,0.22)", borderRadius: 4,
              }}>{error}</div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <button onClick={() => { setStep(2); setError(null) }} disabled={loading} style={{
                padding: "7px 16px", background: "transparent",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4,
                color: "var(--ev-muted)", fontSize: 12, cursor: loading ? "not-allowed" : "pointer", fontFamily: "monospace",
              }}>← Back</button>
              <button onClick={handleConfirm} disabled={loading} style={{
                padding: "7px 20px", minWidth: 140,
                background: loading ? "rgba(240,192,64,0.2)" : GOLD,
                border: "none", borderRadius: 4,
                color: loading ? "var(--ev-muted)" : "var(--ev-bg)",
                fontSize: 12, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", fontFamily: "monospace",
              }}>{loading ? "···" : "Post Proposal"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
