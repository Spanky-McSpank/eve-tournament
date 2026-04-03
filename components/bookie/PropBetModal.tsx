"use client"

import { useState } from "react"
import { formatISK } from "@/lib/utils"
import { calcPropOdds, calcPropAcceptorStake } from "@/lib/props"
import type { PropWithProposals } from "@/lib/props"

const GOLD = "var(--ev-gold-light)"

interface PropBetModalProps {
  prop: PropWithProposals
  tournamentId: string
  initialSide: "yes" | "no"
  onClose: () => void
  onSuccess: () => void
}

type Step = 0 | 1 | 2 | 3

function StepIndicator({ current }: { current: Step }) {
  const steps = [{ n: 1, label: "Side" }, { n: 2, label: "Stake" }, { n: 3, label: "Confirm" }]
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 20 }}>
      {steps.map((s, i) => {
        const active = (s.n as number) <= (current as number)
        return (
          <div key={s.n} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 20, height: 20, borderRadius: "50%",
                background: active ? GOLD : "var(--ev-steel)",
                border: `1px solid ${active ? GOLD : "#333"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, color: active ? "var(--ev-bg)" : "#444",
                fontFamily: "monospace", fontWeight: 700,
              }}>{(s.n as number) < (current as number) ? "✓" : s.n}</div>
              <span style={{ fontSize: 10, fontFamily: "monospace", color: s.n === current ? GOLD : "#444", letterSpacing: 1 }}>
                {s.label.toUpperCase()}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ width: 24, height: 1, background: "#222", margin: "0 8px" }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function PropBetModal({ prop, tournamentId, initialSide, onClose, onSuccess }: PropBetModalProps) {
  const [step, setStep] = useState<Step>(1)
  const [side, setSide] = useState<"yes" | "no">(initialSide)
  const [rawAmount, setRawAmount] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const odds = calcPropOdds(prop.yes_prob)
  const iskAmount = rawAmount ? parseInt(rawAmount.replace(/,/g, ""), 10) : 0

  const impliedProb = side === "yes" ? odds.yes.prob : odds.no.prob
  const acceptorStake = iskAmount > 0 ? calcPropAcceptorStake(iskAmount, impliedProb) : 0
  const totalPot = iskAmount + acceptorStake

  function handleAmountInput(val: string) {
    const digits = val.replace(/[^0-9]/g, "")
    if (!digits) { setRawAmount(""); return }
    setRawAmount(parseInt(digits, 10).toLocaleString("en-US"))
  }

  async function handleConfirm() {
    if (iskAmount < 10_000_000) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/tournament/${tournamentId}/props/propose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propId: prop.id,
          proposition: side,
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

  const sideOdds = side === "yes" ? odds.yes : odds.no

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
        borderRadius: 10, padding: 24, width: "100%", maxWidth: 480, margin: "0 16px",
      }}>
        <StepIndicator current={step} />

        {/* Prop title */}
        <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(255,255,255,0.02)", border: "0.5px solid var(--ev-border2)", borderRadius: 6 }}>
          <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--ev-muted)", letterSpacing: 1, marginBottom: 4 }}>PROPOSITION</div>
          <div style={{ fontSize: 14, color: "var(--ev-text)", fontWeight: 500 }}>{prop.title}</div>
        </div>

        {/* Step 1: Choose side */}
        {step === 1 && (
          <>
            <div style={{ color: GOLD, fontSize: 13, fontFamily: "monospace", letterSpacing: 1, marginBottom: 16 }}>
              CHOOSE YOUR SIDE
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              {(["yes", "no"] as const).map((s) => {
                const sOdds = s === "yes" ? odds.yes : odds.no
                const selected = side === s
                return (
                  <button key={s} onClick={() => setSide(s)} style={{
                    flex: 1, padding: "20px 10px",
                    background: selected
                      ? (s === "yes" ? "rgba(34,197,94,0.08)" : "rgba(192,57,43,0.08)")
                      : "rgba(255,255,255,0.02)",
                    border: `2px solid ${selected ? (s === "yes" ? "#22c55e" : "#c0392b") : "rgba(255,255,255,0.09)"}`,
                    borderRadius: 10, cursor: "pointer",
                    opacity: !selected && side !== s ? 0.35 : 1,
                    transition: "all 0.15s", display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                  }}>
                    <div style={{
                      fontSize: 18, fontWeight: 700, fontFamily: "monospace",
                      color: selected ? (s === "yes" ? "#22c55e" : "#c0392b") : "var(--ev-muted)",
                    }}>{s.toUpperCase()}</div>
                    <div style={{ fontSize: 11, fontFamily: "monospace", color: selected ? GOLD : "#555" }}>
                      {sOdds.percentage}% · {sOdds.fractional}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--ev-muted)", fontFamily: "monospace" }}>
                      {s === "yes" ? "IT HAPPENS" : "IT DOESN'T"}
                    </div>
                  </button>
                )
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={onClose} style={{
                padding: "7px 16px", background: "transparent",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4,
                color: "var(--ev-muted)", fontSize: 12, cursor: "pointer", fontFamily: "monospace",
              }}>Cancel</button>
              <button onClick={() => setStep(2)} style={{
                padding: "7px 16px", minWidth: 100,
                background: GOLD, border: "none", borderRadius: 4,
                color: "var(--ev-bg)", fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: "monospace",
              }}>Next →</button>
            </div>
          </>
        )}

        {/* Step 2: Enter stake */}
        {step === 2 && (
          <>
            <div style={{ color: GOLD, fontSize: 13, fontFamily: "monospace", letterSpacing: 1, marginBottom: 16 }}>
              YOUR STAKE — BETTING {side.toUpperCase()}
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
                <div>YOUR STAKE: <span style={{ color: GOLD }}>{formatISK(iskAmount)}</span></div>
                <div>OPPONENT MUST RISK: <span style={{ color: GOLD }}>{formatISK(acceptorStake)}</span></div>
                <div>IF YOU WIN: <span style={{ color: "#22c55e" }}>+{formatISK(acceptorStake)}</span></div>
                <div>IF YOU LOSE: <span style={{ color: "#c0392b" }}>-{formatISK(iskAmount)}</span></div>
                <div>WIN CHANCE: <span style={{ color: GOLD }}>{sideOdds.percentage}% ({sideOdds.fractional})</span></div>
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
        {step === 3 && (
          <>
            <div style={{ color: GOLD, fontSize: 13, fontFamily: "monospace", letterSpacing: 1, marginBottom: 16 }}>
              CONFIRM PROPOSAL
            </div>

            <div style={{
              padding: 16, background: "rgba(240,192,64,0.04)",
              border: "0.5px solid var(--ev-border2)", borderRadius: 10, marginBottom: 16,
            }}>
              <div style={{ fontFamily: "monospace", fontSize: 12, marginBottom: 8 }}>
                <span style={{ color: "var(--ev-muted)" }}>Betting: </span>
                <span style={{
                  color: side === "yes" ? "#22c55e" : "#c0392b",
                  fontWeight: 700, fontSize: 14,
                }}>{side.toUpperCase()}</span>
                <span style={{ color: "var(--ev-muted)", marginLeft: 8 }}>({sideOdds.percentage}% · {sideOdds.fractional})</span>
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--ev-muted)", lineHeight: 1.8 }}>
                <div>You are risking: <span style={{ color: GOLD }}>{formatISK(iskAmount)}</span></div>
                <div>Opponent must risk: <span style={{ color: GOLD }}>{formatISK(acceptorStake)}</span></div>
                <div>Total pot if matched: <span style={{ color: GOLD }}>{formatISK(totalPot)}</span></div>
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
              <button onClick={() => void handleConfirm()} disabled={loading} style={{
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
