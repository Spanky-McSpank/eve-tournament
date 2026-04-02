"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { formatISK } from "@/lib/utils"
import { EditBetModal, ForceSettleModal } from "@/components/admin/EditBetModal"

const GOLD = "var(--ev-gold-light)"

type Tab = "proposals" | "matches" | "settlements" | "records"

interface BetSummary {
  totalProposals: number
  matched: number
  open: number
  voided: number
  pendingResolution: number
  totalIskInPlay: number
}

interface Proposal {
  id: string
  proposer_name: string
  proposer_character_id: number
  isk_amount: number
  implied_prob: number
  status: string
  is_proxy: boolean
  void_reason: string | null
  created_at: string
}

interface BetMatch {
  id: string
  outcome: string
  proposer_name: string
  acceptor_name: string
  proposer_character_id: number
  acceptor_character_id: number
  proposer_stake: number
  acceptor_stake: number
  proposal_id: string
  settled_note: string | null
  created_at: string
}

interface Settlement {
  id: string
  from_character_name: string
  to_character_name: string
  isk_amount: number
  is_paid: boolean
  round: number
  created_at: string
}

const STATUS_COLOR: Record<string, string> = {
  open: "#3b82f6",
  matched: GOLD,
  settled: "#22c55e",
  void: "#555",
}

const OUTCOME_COLOR: Record<string, string> = {
  pending: GOLD,
  proposer_wins: "#22c55e",
  acceptor_wins: "#22c55e",
  void: "#555",
}

export default function BetManagementClient({
  tournamentId,
  tournamentName,
  tournamentStatus,
}: {
  tournamentId: string
  tournamentName: string
  tournamentStatus: string
}) {
  const [tab, setTab] = useState<Tab>("proposals")
  const [summary, setSummary] = useState<BetSummary | null>(null)
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [matches, setMatches] = useState<BetMatch[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterOutcome, setFilterOutcome] = useState<string>("all")

  // Modals
  const [editProposal, setEditProposal] = useState<Proposal | null>(null)
  const [forceSettleMatch, setForceSettleMatch] = useState<BetMatch | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/tournament/${tournamentId}/bet-summary`)
      if (res.ok) {
        const d = await res.json() as {
          summary: BetSummary
          proposals: Proposal[]
          matches: BetMatch[]
          settlements: Settlement[]
        }
        setSummary(d.summary)
        setProposals(d.proposals ?? [])
        setMatches(d.matches ?? [])
        setSettlements(d.settlements ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [tournamentId])

  useEffect(() => { void loadData() }, [loadData, refreshKey])

  const TABS: { key: Tab; label: string }[] = [
    { key: "proposals", label: "Open Proposals" },
    { key: "matches", label: "Matched Bets" },
    { key: "settlements", label: "Settlements" },
    { key: "records", label: "All Bets" },
  ]

  const filteredProposals = proposals.filter((p) =>
    filterStatus === "all" || p.status === filterStatus
  )
  const filteredMatches = matches.filter((m) =>
    filterOutcome === "all" || m.outcome === filterOutcome
  )

  function outcomeLabel(outcome: string) {
    if (outcome === "proposer_wins") return "Proposer Won"
    if (outcome === "acceptor_wins") return "Acceptor Won"
    return outcome.charAt(0).toUpperCase() + outcome.slice(1)
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--ev-bg)",
      backgroundImage: [
        "linear-gradient(rgba(200,150,12,0.03) 1px, transparent 1px)",
        "linear-gradient(90deg, rgba(200,150,12,0.03) 1px, transparent 1px)",
      ].join(", "),
      backgroundSize: "32px 32px",
      color: "var(--ev-text)",
      fontFamily: "system-ui, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        borderBottom: "0.5px solid var(--ev-border2)",
        padding: "16px 24px",
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
      }}>
        <Link href="/admin" style={{
          fontSize: 11, color: "var(--ev-muted)", fontFamily: "monospace",
          textDecoration: "none", padding: "4px 10px",
          border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4,
        }}>← Admin</Link>
        <h1 style={{ color: GOLD, fontSize: 16, fontFamily: "monospace", fontWeight: 600, margin: 0 }}>
          {tournamentName} — Bet Management 💰
        </h1>
        <span style={{
          fontSize: 9, fontFamily: "monospace", letterSpacing: 2, padding: "2px 8px",
          border: `1px solid ${tournamentStatus === "active" ? "#22c55e" : GOLD}`,
          borderRadius: 3, color: tournamentStatus === "active" ? "#22c55e" : GOLD,
          textTransform: "uppercase",
        }}>{tournamentStatus}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <Link href={`/tournament/${tournamentId}/bets`} style={{
            fontSize: 11, color: "var(--ev-text)", textDecoration: "none",
            padding: "5px 12px", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 4, fontFamily: "monospace",
          }}>🎲 Public Board</Link>
          <Link href={`/tournament/${tournamentId}`} style={{
            fontSize: 11, color: "var(--ev-text)", textDecoration: "none",
            padding: "5px 12px", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 4, fontFamily: "monospace",
          }}>← Roster</Link>
        </div>
      </div>

      {/* Summary bar */}
      {summary && (
        <div style={{
          padding: "12px 24px",
          background: "rgba(240,192,64,0.03)",
          borderBottom: "0.5px solid var(--ev-border2)",
          display: "flex", gap: 24, flexWrap: "wrap",
        }}>
          {[
            { label: "TOTAL", value: summary.totalProposals },
            { label: "MATCHED", value: summary.matched, color: GOLD },
            { label: "OPEN", value: summary.open, color: "#3b82f6" },
            { label: "VOIDED", value: summary.voided, color: "#555" },
            { label: "PENDING", value: summary.pendingResolution, color: "#f59e0b" },
            { label: "ISK IN PLAY", value: formatISK(summary.totalIskInPlay), color: "#22c55e" },
          ].map((s) => (
            <div key={s.label}>
              <div style={{ fontSize: 9, fontFamily: "monospace", color: "var(--ev-muted)", letterSpacing: 1, marginBottom: 2 }}>
                {s.label}
              </div>
              <div style={{ fontSize: 14, fontFamily: "monospace", color: s.color ?? "var(--ev-text)", fontWeight: 600 }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "0 24px" }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: "12px 20px", background: "transparent", border: "none",
            borderBottom: tab === t.key ? `2px solid ${GOLD}` : "2px solid transparent",
            color: tab === t.key ? GOLD : "var(--ev-muted)",
            fontSize: 11, fontFamily: "monospace", letterSpacing: 1, cursor: "pointer",
            textTransform: "uppercase", marginBottom: -1,
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: 24 }}>
        {loading && (
          <div style={{ color: "#444", fontFamily: "monospace", fontSize: 12, textAlign: "center", padding: 40 }}>
            Loading...
          </div>
        )}

        {!loading && tab === "proposals" && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {["all", "open", "matched", "settled", "void"].map((s) => (
                <button key={s} onClick={() => setFilterStatus(s)} style={{
                  padding: "4px 12px", fontSize: 10, fontFamily: "monospace",
                  background: filterStatus === s ? "rgba(240,192,64,0.15)" : "transparent",
                  border: `1px solid ${filterStatus === s ? GOLD : "rgba(255,255,255,0.1)"}`,
                  borderRadius: 4, color: filterStatus === s ? GOLD : "var(--ev-muted)",
                  cursor: "pointer", textTransform: "uppercase", letterSpacing: 1,
                }}>{s}</button>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredProposals.length === 0 && (
                <div style={{ color: "#444", fontFamily: "monospace", fontSize: 12, padding: "24px 0" }}>
                  No proposals
                </div>
              )}
              {filteredProposals.map((p) => (
                <div key={p.id} style={{
                  background: "var(--ev-card)", border: "0.5px solid var(--ev-border2)",
                  borderRadius: 8, padding: "12px 16px",
                  display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                }}>
                  <span style={{
                    fontSize: 9, fontFamily: "monospace", letterSpacing: 1,
                    padding: "2px 6px", borderRadius: 3,
                    border: `1px solid ${STATUS_COLOR[p.status] ?? "#555"}`,
                    color: STATUS_COLOR[p.status] ?? "#555",
                    textTransform: "uppercase",
                  }}>{p.status}</span>
                  {p.is_proxy && (
                    <span style={{ fontSize: 9, fontFamily: "monospace", color: "#f59e0b", letterSpacing: 1 }}>PROXY</span>
                  )}
                  <span style={{ fontFamily: "monospace", fontSize: 13, color: "var(--ev-text)" }}>{p.proposer_name}</span>
                  <span style={{ fontFamily: "monospace", fontSize: 12, color: GOLD }}>{formatISK(p.isk_amount)}</span>
                  <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--ev-muted)" }}>
                    {Math.round(p.implied_prob * 100)}% implied
                  </span>
                  {p.void_reason && (
                    <span style={{ fontSize: 10, color: "#555", fontFamily: "monospace" }}>Void: {p.void_reason}</span>
                  )}
                  <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                    {p.status === "open" && (
                      <button onClick={() => setEditProposal(p)} style={{
                        padding: "4px 12px", fontSize: 10, fontFamily: "monospace",
                        background: "transparent", border: `1px solid ${GOLD}`,
                        borderRadius: 4, color: GOLD, cursor: "pointer",
                      }}>Edit</button>
                    )}
                    {(p.status === "open" || p.status === "matched") && (
                      <button onClick={() => {
                        setEditProposal({ ...p, status: "open_for_void" as string } as Proposal & { status: string })
                        setEditProposal(p)
                        // Open edit modal on void tab
                        setEditProposal({ ...p, _defaultTab: "void" } as Proposal & { _defaultTab?: string })
                      }} style={{
                        padding: "4px 12px", fontSize: 10, fontFamily: "monospace",
                        background: "transparent", border: "1px solid #c0392b",
                        borderRadius: 4, color: "#c0392b", cursor: "pointer",
                      }}>Void</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {!loading && tab === "matches" && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {["all", "pending", "proposer_wins", "acceptor_wins", "void"].map((s) => (
                <button key={s} onClick={() => setFilterOutcome(s)} style={{
                  padding: "4px 12px", fontSize: 10, fontFamily: "monospace",
                  background: filterOutcome === s ? "rgba(240,192,64,0.15)" : "transparent",
                  border: `1px solid ${filterOutcome === s ? GOLD : "rgba(255,255,255,0.1)"}`,
                  borderRadius: 4, color: filterOutcome === s ? GOLD : "var(--ev-muted)",
                  cursor: "pointer", textTransform: "uppercase", letterSpacing: 1,
                }}>{s === "all" ? "All" : outcomeLabel(s)}</button>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredMatches.length === 0 && (
                <div style={{ color: "#444", fontFamily: "monospace", fontSize: 12, padding: "24px 0" }}>
                  No matches
                </div>
              )}
              {filteredMatches.map((m) => (
                <div key={m.id} style={{
                  background: "var(--ev-card)", border: "0.5px solid var(--ev-border2)",
                  borderRadius: 8, padding: "12px 16px",
                  display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                }}>
                  <span style={{
                    fontSize: 9, fontFamily: "monospace", letterSpacing: 1,
                    padding: "2px 6px", borderRadius: 3,
                    border: `1px solid ${OUTCOME_COLOR[m.outcome] ?? "#555"}`,
                    color: OUTCOME_COLOR[m.outcome] ?? "#555",
                    textTransform: "uppercase",
                  }}>{outcomeLabel(m.outcome)}</span>
                  <div style={{ fontFamily: "monospace", fontSize: 12 }}>
                    <span style={{ color: "var(--ev-text)" }}>{m.proposer_name}</span>
                    <span style={{ color: "var(--ev-muted)" }}> ({formatISK(m.proposer_stake)})</span>
                    <span style={{ color: "#555", margin: "0 8px" }}>vs</span>
                    <span style={{ color: "var(--ev-text)" }}>{m.acceptor_name}</span>
                    <span style={{ color: "var(--ev-muted)" }}> ({formatISK(m.acceptor_stake)})</span>
                  </div>
                  {m.settled_note && (
                    <span style={{ fontSize: 10, color: "var(--ev-muted)", fontFamily: "monospace" }}>
                      Note: {m.settled_note}
                    </span>
                  )}
                  <div style={{ marginLeft: "auto" }}>
                    {m.outcome === "pending" && (
                      <button onClick={() => setForceSettleMatch(m)} style={{
                        padding: "4px 12px", fontSize: 10, fontFamily: "monospace",
                        background: "transparent", border: `1px solid ${GOLD}`,
                        borderRadius: 4, color: GOLD, cursor: "pointer",
                      }}>Force Settle</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {!loading && tab === "settlements" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {settlements.length === 0 && (
              <div style={{ color: "#444", fontFamily: "monospace", fontSize: 12, padding: "24px 0" }}>
                No settlements yet
              </div>
            )}
            {settlements.map((s) => (
              <div key={s.id} style={{
                background: "var(--ev-card)", border: "0.5px solid var(--ev-border2)",
                borderRadius: 8, padding: "12px 16px",
                display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
              }}>
                <span style={{
                  fontSize: 9, fontFamily: "monospace", letterSpacing: 1,
                  padding: "2px 6px", borderRadius: 3,
                  border: `1px solid ${s.is_paid ? "#22c55e" : "#f59e0b"}`,
                  color: s.is_paid ? "#22c55e" : "#f59e0b",
                  textTransform: "uppercase",
                }}>{s.is_paid ? "Paid" : "Pending"}</span>
                <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--ev-muted)" }}>R{s.round}</span>
                <span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--ev-text)" }}>
                  {s.from_character_name} → {s.to_character_name}
                </span>
                <span style={{ fontFamily: "monospace", fontSize: 12, color: GOLD }}>{formatISK(s.isk_amount)}</span>
              </div>
            ))}
          </div>
        )}

        {!loading && tab === "records" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {proposals.length === 0 && (
              <div style={{ color: "#444", fontFamily: "monospace", fontSize: 12, padding: "24px 0" }}>
                No bets recorded
              </div>
            )}
            {proposals.map((p) => (
              <div key={p.id} style={{
                background: "var(--ev-card)", border: "0.5px solid var(--ev-border2)",
                borderRadius: 8, padding: "10px 16px",
                display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
              }}>
                <span style={{
                  fontSize: 9, fontFamily: "monospace", letterSpacing: 1,
                  padding: "2px 6px", borderRadius: 3,
                  border: `1px solid ${STATUS_COLOR[p.status] ?? "#555"}`,
                  color: STATUS_COLOR[p.status] ?? "#555",
                  textTransform: "uppercase", flexShrink: 0,
                }}>{p.status}</span>
                <span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--ev-text)" }}>{p.proposer_name}</span>
                <span style={{ fontFamily: "monospace", fontSize: 12, color: GOLD }}>{formatISK(p.isk_amount)}</span>
                <span style={{ fontFamily: "monospace", fontSize: 10, color: "var(--ev-muted)" }}>
                  {new Date(p.created_at).toLocaleString()}
                </span>
                {p.void_reason && (
                  <span style={{ fontSize: 10, color: "#555", fontFamily: "monospace" }}>↳ {p.void_reason}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {editProposal && (
        <EditBetModal
          proposal={editProposal}
          onClose={() => setEditProposal(null)}
          onSaved={() => { setEditProposal(null); setRefreshKey((k) => k + 1) }}
        />
      )}
      {forceSettleMatch && (
        <ForceSettleModal
          match={forceSettleMatch}
          onClose={() => setForceSettleMatch(null)}
          onSaved={() => { setForceSettleMatch(null); setRefreshKey((k) => k + 1) }}
        />
      )}
    </div>
  )
}
