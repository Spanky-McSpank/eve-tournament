"use client"

import Image from "next/image"
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { formatISK } from "@/lib/utils"
import { calculateAcceptorStake } from "@/lib/odds"
import { EditBetModal, ForceSettleModal } from "@/components/admin/EditBetModal"

const GOLD = "var(--ev-gold-light)"
const AMBER = "#f59e0b"

type Tab = "all" | "open" | "matched" | "settlements"

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
  bracket_id: string | null
  predicted_winner_id: string | null
  bracket_round: number | null
  bracket_match_number: number | null
  predicted_winner_name: string | null
  predicted_winner_portrait: string | null
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
  acceptor_winner_id: string | null
  acceptor_winner_name: string | null
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

// Portrait pill — character portrait 24×24 with name and optional badge
function CharacterCell({
  characterId,
  name,
  isProxy,
  muted,
}: {
  characterId?: number
  name: string
  isProxy?: boolean
  muted?: boolean
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
      {characterId ? (
        <div style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
          <Image
            src={`https://images.evetech.net/characters/${characterId}/portrait?size=32`}
            alt={name}
            width={24}
            height={24}
            style={{ objectFit: "cover", display: "block" }}
          />
        </div>
      ) : (
        <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--ev-steel)", flexShrink: 0 }} />
      )}
      <span style={{
        fontFamily: "monospace", fontSize: 11,
        color: muted ? "var(--ev-muted)" : "var(--ev-text)",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 110,
      }}>{name}</span>
      {isProxy && (
        <span style={{ fontSize: 8, fontFamily: "monospace", color: AMBER, letterSpacing: 1, flexShrink: 0 }}>PROXY</span>
      )}
    </div>
  )
}

function StatusPill({ proposal, match }: { proposal: Proposal; match?: BetMatch }) {
  if (proposal.status === "open") {
    return <span style={pill("#3b82f6")}>OPEN</span>
  }
  if (proposal.status === "matched" && match?.outcome === "pending") {
    return <span style={pill("#3b82f6", true)}>MATCHED</span>
  }
  if (match?.outcome === "proposer_wins") {
    return <span style={pill("#22c55e")}>SETTLED · PROPOSER</span>
  }
  if (match?.outcome === "acceptor_wins") {
    return <span style={pill("#22c55e")}>SETTLED · ACCEPTOR</span>
  }
  if (proposal.status === "void" || match?.outcome === "void") {
    return <span style={pill("#555")}>VOID</span>
  }
  if (proposal.status === "settled") {
    return <span style={pill("#22c55e")}>SETTLED</span>
  }
  return <span style={pill("#555")}>{proposal.status.toUpperCase()}</span>
}

function pill(color: string, solid = false): React.CSSProperties {
  return {
    fontSize: 8, fontFamily: "monospace", letterSpacing: 1,
    padding: "2px 6px", borderRadius: 3,
    border: `1px solid ${color}`,
    color: solid ? "var(--ev-bg)" : color,
    background: solid ? color : "transparent",
    textTransform: "uppercase" as const,
    whiteSpace: "nowrap" as const,
  }
}

// Accept on Behalf modal
function AcceptOnBehalfModal({
  proposal,
  onClose,
  onSaved,
}: {
  proposal: Proposal
  onClose: () => void
  onSaved: () => void
}) {
  const [charName, setCharName] = useState("")
  const [charId, setCharId] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const acceptorStake = calculateAcceptorStake(proposal.isk_amount, proposal.implied_prob)

  async function handleAccept() {
    if (!charName.trim() || !charId.trim()) {
      setError("Character name and ID are required")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/bet/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "accept",
          characterName: charName.trim(),
          characterId: Number(charId.trim()),
          proposalId: proposal.id,
        }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) { setError(data.error ?? "Failed"); return }
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }} onClick={onClose}>
      <div style={{
        background: "var(--ev-card)", border: "0.5px solid var(--ev-border2)",
        borderRadius: 10, padding: 28, maxWidth: 400, width: "100%",
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ color: GOLD, fontFamily: "monospace", fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
          Accept on Behalf
        </div>
        <div style={{ color: "var(--ev-muted)", fontFamily: "monospace", fontSize: 11, marginBottom: 20 }}>
          {proposal.proposer_name} backs {proposal.predicted_winner_name ?? "—"} for {formatISK(proposal.isk_amount)}
        </div>

        <div style={{
          background: "rgba(240,192,64,0.06)", border: "0.5px solid var(--ev-border2)",
          borderRadius: 6, padding: "10px 14px", marginBottom: 16,
          fontFamily: "monospace", fontSize: 12,
        }}>
          <span style={{ color: "var(--ev-muted)" }}>Acceptor must risk: </span>
          <span style={{ color: GOLD, fontWeight: 700 }}>{formatISK(acceptorStake)}</span>
          <span style={{ color: "var(--ev-muted)" }}> ISK</span>
        </div>

        <label style={{ fontSize: 10, fontFamily: "monospace", color: "var(--ev-muted)", display: "block", marginBottom: 4 }}>
          CHARACTER NAME
        </label>
        <input
          value={charName}
          onChange={(e) => setCharName(e.target.value)}
          placeholder="Capsuleer Name"
          style={{
            width: "100%", padding: "7px 10px", marginBottom: 10,
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 5, color: "var(--ev-text)", fontSize: 12, fontFamily: "monospace",
            boxSizing: "border-box",
          }}
        />
        <label style={{ fontSize: 10, fontFamily: "monospace", color: "var(--ev-muted)", display: "block", marginBottom: 4 }}>
          CHARACTER ID
        </label>
        <input
          value={charId}
          onChange={(e) => setCharId(e.target.value)}
          placeholder="123456789"
          type="number"
          style={{
            width: "100%", padding: "7px 10px", marginBottom: 12,
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 5, color: "var(--ev-text)", fontSize: 12, fontFamily: "monospace",
            boxSizing: "border-box",
          }}
        />

        {error && (
          <div style={{ color: "#c0392b", fontSize: 11, fontFamily: "monospace", marginBottom: 10 }}>{error}</div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleAccept} disabled={loading} style={{
            flex: 1, padding: "8px 0", background: GOLD, border: "none", borderRadius: 6,
            color: "var(--ev-bg)", fontSize: 12, fontWeight: 700, fontFamily: "monospace",
            cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1,
          }}>{loading ? "Accepting..." : "Confirm Accept"}</button>
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

export default function BetManagementClient({
  tournamentId,
  tournamentName,
  tournamentStatus,
}: {
  tournamentId: string
  tournamentName: string
  tournamentStatus: string
}) {
  const [tab, setTab] = useState<Tab>("all")
  const [summary, setSummary] = useState<BetSummary | null>(null)
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [matches, setMatches] = useState<BetMatch[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  // Modals
  const [editProposal, setEditProposal] = useState<{ proposal: Proposal; defaultTab: "edit" | "void" } | null>(null)
  const [forceSettleMatch, setForceSettleMatch] = useState<BetMatch | null>(null)
  const [acceptOnBehalf, setAcceptOnBehalf] = useState<Proposal | null>(null)

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

  // Build proposal→match lookup
  const matchByProposalId = Object.fromEntries(matches.map((m) => [m.proposal_id, m]))

  const TABS: { key: Tab; label: string }[] = [
    { key: "all", label: "All Bets" },
    { key: "open", label: "Open Proposals" },
    { key: "matched", label: "Matched Bets" },
    { key: "settlements", label: "Settlements" },
  ]

  const openProposals = proposals.filter((p) => p.status === "open")
  const pendingMatches = matches.filter((m) => m.outcome === "pending")

  function outcomeLabel(outcome: string) {
    if (outcome === "proposer_wins") return "Proposer Won"
    if (outcome === "acceptor_wins") return "Acceptor Won"
    return outcome.charAt(0).toUpperCase() + outcome.slice(1)
  }

  const statusColor = tournamentStatus === "active" ? "#22c55e" : GOLD

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
        padding: "14px 24px",
      }}>
        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, fontFamily: "monospace", fontSize: 10, color: "var(--ev-muted)" }}>
          <Link href="/admin" style={{ color: "var(--ev-muted)", textDecoration: "none" }}>Admin</Link>
          <span>›</span>
          <Link href={`/tournament/${tournamentId}`} style={{ color: "var(--ev-muted)", textDecoration: "none" }}>{tournamentName}</Link>
          <span>›</span>
          <span style={{ color: GOLD }}>Bet Management</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h1 style={{ color: GOLD, fontSize: 16, fontFamily: "monospace", fontWeight: 600, margin: 0 }}>
            💰 Bet Management
          </h1>
          <span style={{
            fontSize: 9, fontFamily: "monospace", letterSpacing: 2, padding: "2px 7px",
            border: `1px solid ${statusColor}`, borderRadius: 3,
            color: statusColor, textTransform: "uppercase",
          }}>{tournamentStatus}</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <Link href={`/tournament/${tournamentId}/bets`} style={{
              fontSize: 11, color: "var(--ev-text)", textDecoration: "none",
              padding: "5px 12px", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 4, fontFamily: "monospace",
            }}>🎲 Public Board</Link>
            <Link href={`/tournament/${tournamentId}/bracket`} style={{
              fontSize: 11, color: "var(--ev-text)", textDecoration: "none",
              padding: "5px 12px", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 4, fontFamily: "monospace",
            }}>⚔ Bracket</Link>
          </div>
        </div>
      </div>

      {/* Summary bar */}
      {summary && (
        <div style={{
          padding: "10px 24px",
          background: "rgba(240,192,64,0.03)",
          borderBottom: "0.5px solid var(--ev-border2)",
          display: "flex", gap: 28, flexWrap: "wrap", alignItems: "center",
        }}>
          {[
            { label: "TOTAL", value: String(summary.totalProposals) },
            { label: "MATCHED", value: String(summary.matched), color: GOLD },
            { label: "OPEN", value: String(summary.open), color: "#3b82f6" },
            { label: "VOIDED", value: String(summary.voided), color: "#555" },
            { label: "PENDING", value: String(summary.pendingResolution), color: AMBER },
            { label: "ISK IN PLAY", value: formatISK(summary.totalIskInPlay), color: "#22c55e" },
          ].map((s) => (
            <div key={s.label}>
              <div style={{ fontSize: 8, fontFamily: "monospace", color: "var(--ev-muted)", letterSpacing: 1, marginBottom: 2 }}>
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
            padding: "11px 18px", background: "transparent", border: "none",
            borderBottom: tab === t.key ? `2px solid ${GOLD}` : "2px solid transparent",
            color: tab === t.key ? GOLD : "var(--ev-muted)",
            fontSize: 11, fontFamily: "monospace", letterSpacing: 1, cursor: "pointer",
            textTransform: "uppercase", marginBottom: -1,
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: 24, overflowX: "auto" }}>
        {loading && (
          <div style={{ color: "#444", fontFamily: "monospace", fontSize: 12, textAlign: "center", padding: 40 }}>
            Loading...
          </div>
        )}

        {/* ── TAB: All Bets ── */}
        {!loading && tab === "all" && (
          proposals.length === 0 ? (
            <div style={{ color: "#444", fontFamily: "monospace", fontSize: 12, padding: "32px 0" }}>No bets recorded</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: "monospace" }}>
              <thead>
                <tr style={{ color: "var(--ev-muted)", fontSize: 9, letterSpacing: 1, textTransform: "uppercase" }}>
                  {["Match", "Proposer", "Backs", "P.Stake", "Acceptor", "Backs", "A.Stake", "Status", "Actions"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "6px 10px", borderBottom: "0.5px solid rgba(255,255,255,0.07)", fontWeight: 400 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {proposals.map((p) => {
                  const m = matchByProposalId[p.id]
                  return (
                    <tr key={p.id} style={{ borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "8px 10px", color: "var(--ev-muted)", whiteSpace: "nowrap" }}>
                        {p.bracket_round != null ? `R${p.bracket_round}·M${p.bracket_match_number}` : "—"}
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        <CharacterCell
                          characterId={p.proposer_character_id}
                          name={p.proposer_name}
                          isProxy={p.is_proxy}
                        />
                      </td>
                      <td style={{ padding: "8px 10px", color: GOLD, whiteSpace: "nowrap", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {p.predicted_winner_name
                          ? p.predicted_winner_name.slice(0, 16) + (p.predicted_winner_name.length > 16 ? "…" : "")
                          : "—"}
                      </td>
                      <td style={{ padding: "8px 10px", color: GOLD, whiteSpace: "nowrap" }}>
                        {formatISK(p.isk_amount)}
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        {m ? (
                          <CharacterCell
                            characterId={m.acceptor_character_id}
                            name={m.acceptor_name}
                          />
                        ) : (
                          <span style={{ color: "var(--ev-muted)", fontStyle: "italic", fontSize: 10 }}>— Waiting —</span>
                        )}
                      </td>
                      <td style={{ padding: "8px 10px", color: GOLD, whiteSpace: "nowrap", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {m?.acceptor_winner_name
                          ? m.acceptor_winner_name.slice(0, 16) + (m.acceptor_winner_name.length > 16 ? "…" : "")
                          : "—"}
                      </td>
                      <td style={{ padding: "8px 10px", color: GOLD, whiteSpace: "nowrap" }}>
                        {m ? formatISK(m.acceptor_stake) : "—"}
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        <StatusPill proposal={p} match={m} />
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          {p.status === "open" && (
                            <button onClick={() => setEditProposal({ proposal: p, defaultTab: "edit" })} style={actionBtn(GOLD)}>Edit</button>
                          )}
                          {(p.status === "open" || p.status === "matched") && (
                            <button onClick={() => setEditProposal({ proposal: p, defaultTab: "void" })} style={actionBtn("#c0392b")}>Void</button>
                          )}
                          {p.status === "matched" && m?.outcome === "pending" && (
                            <button onClick={() => setForceSettleMatch(m)} style={actionBtn(AMBER)}>Settle</button>
                          )}
                          {p.status !== "open" && p.status !== "matched" && (
                            <span style={{ color: "#444", fontSize: 9, fontFamily: "monospace" }}>—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )
        )}

        {/* ── TAB: Open Proposals ── */}
        {!loading && tab === "open" && (
          openProposals.length === 0 ? (
            <div style={{ color: "#444", fontFamily: "monospace", fontSize: 12, padding: "32px 0" }}>No open proposals</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
              {openProposals.map((p) => (
                <div key={p.id} style={{
                  background: "var(--ev-card)", border: "0.5px solid var(--ev-border2)",
                  borderRadius: 10, padding: "16px 18px",
                }}>
                  {/* Match label */}
                  <div style={{ fontSize: 9, fontFamily: "monospace", color: "var(--ev-muted)", letterSpacing: 1, marginBottom: 10 }}>
                    {p.bracket_round != null ? `R${p.bracket_round} · M${p.bracket_match_number}` : "MATCH TBD"}
                  </div>

                  {/* Fighter they back */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    {p.predicted_winner_portrait ? (
                      <div style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: `1px solid ${GOLD}` }}>
                        <Image src={p.predicted_winner_portrait} alt={p.predicted_winner_name ?? ""} width={40} height={40} style={{ objectFit: "cover" }} />
                      </div>
                    ) : (
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--ev-steel)", flexShrink: 0 }} />
                    )}
                    <div>
                      <div style={{ fontSize: 9, color: "var(--ev-muted)", fontFamily: "monospace", letterSpacing: 1 }}>BACKS</div>
                      <div style={{ color: GOLD, fontFamily: "monospace", fontSize: 12, fontWeight: 600 }}>
                        {p.predicted_winner_name ?? "—"}
                      </div>
                    </div>
                  </div>

                  {/* Proposer */}
                  <div style={{ marginBottom: 10 }}>
                    <CharacterCell characterId={p.proposer_character_id} name={p.proposer_name} isProxy={p.is_proxy} />
                  </div>

                  {/* Stake */}
                  <div style={{ fontFamily: "monospace", fontSize: 20, color: GOLD, fontWeight: 700, marginBottom: 4 }}>
                    {formatISK(p.isk_amount)}
                  </div>
                  <div style={{ fontSize: 10, fontFamily: "monospace", color: "var(--ev-muted)", marginBottom: 6 }}>
                    Needs opponent to risk:{" "}
                    <span style={{ color: "var(--ev-text)" }}>
                      {formatISK(calculateAcceptorStake(p.isk_amount, p.implied_prob))}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, fontFamily: "monospace", color: "var(--ev-muted)", marginBottom: 14 }}>
                    Win chance: <span style={{ color: GOLD }}>{Math.round(p.implied_prob * 100)}%</span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button onClick={() => setAcceptOnBehalf(p)} style={{
                      ...actionBtn(GOLD), flex: 1, padding: "6px 0", justifyContent: "center",
                    }}>Accept on Behalf</button>
                    <button onClick={() => setEditProposal({ proposal: p, defaultTab: "edit" })} style={actionBtn(AMBER)}>Edit</button>
                    <button onClick={() => setEditProposal({ proposal: p, defaultTab: "void" })} style={actionBtn("#c0392b")}>Void</button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* ── TAB: Matched Bets ── */}
        {!loading && tab === "matched" && (
          pendingMatches.length === 0 ? (
            <div style={{ color: "#444", fontFamily: "monospace", fontSize: 12, padding: "32px 0" }}>
              No pending matched bets
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pendingMatches.map((m) => {
                const prop = proposals.find((p) => p.id === m.proposal_id)
                return (
                  <div key={m.id} style={{
                    background: "var(--ev-card)", border: "0.5px solid var(--ev-border2)",
                    borderRadius: 8, padding: "12px 16px",
                    display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
                  }}>
                    <span style={{ fontSize: 9, fontFamily: "monospace", color: "var(--ev-muted)", letterSpacing: 1, flexShrink: 0 }}>
                      {prop?.bracket_round != null ? `R${prop.bracket_round}·M${prop.bracket_match_number}` : "—"}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <CharacterCell characterId={m.proposer_character_id} name={m.proposer_name} />
                      <span style={{ fontSize: 10, color: "var(--ev-muted)", fontFamily: "monospace" }}>
                        backs {prop?.predicted_winner_name ?? "—"} · {formatISK(m.proposer_stake)}
                      </span>
                    </div>
                    <span style={{ color: "#555", fontFamily: "monospace", fontSize: 10 }}>vs</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <CharacterCell characterId={m.acceptor_character_id} name={m.acceptor_name} />
                      <span style={{ fontSize: 10, color: "var(--ev-muted)", fontFamily: "monospace" }}>
                        backs {m.acceptor_winner_name ?? "—"} · {formatISK(m.acceptor_stake)}
                      </span>
                    </div>
                    <div style={{ marginLeft: "auto" }}>
                      <button onClick={() => setForceSettleMatch(m)} style={actionBtn(AMBER)}>Force Settle</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* ── TAB: Settlements ── */}
        {!loading && tab === "settlements" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {settlements.length === 0 && (
              <div style={{ color: "#444", fontFamily: "monospace", fontSize: 12, padding: "32px 0" }}>No settlements yet</div>
            )}
            {settlements.map((s) => (
              <div key={s.id} style={{
                background: "var(--ev-card)", border: "0.5px solid var(--ev-border2)",
                borderRadius: 8, padding: "12px 16px",
                display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
              }}>
                <span style={{
                  fontSize: 9, fontFamily: "monospace", letterSpacing: 1, padding: "2px 6px", borderRadius: 3,
                  border: `1px solid ${s.is_paid ? "#22c55e" : AMBER}`,
                  color: s.is_paid ? "#22c55e" : AMBER, textTransform: "uppercase",
                }}>{s.is_paid ? "Paid" : "Pending"}</span>
                <span style={{ fontFamily: "monospace", fontSize: 10, color: "var(--ev-muted)" }}>R{s.round}</span>
                <span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--ev-text)" }}>
                  {s.from_character_name}
                  <span style={{ color: "var(--ev-muted)", margin: "0 6px" }}>→</span>
                  {s.to_character_name}
                </span>
                <span style={{ fontFamily: "monospace", fontSize: 12, color: GOLD, marginLeft: "auto" }}>{formatISK(s.isk_amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {editProposal && (
        <EditBetModal
          proposal={editProposal.proposal}
          defaultTab={editProposal.defaultTab}
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
      {acceptOnBehalf && (
        <AcceptOnBehalfModal
          proposal={acceptOnBehalf}
          onClose={() => setAcceptOnBehalf(null)}
          onSaved={() => { setAcceptOnBehalf(null); setRefreshKey((k) => k + 1) }}
        />
      )}
    </div>
  )
}

function actionBtn(color: string): React.CSSProperties {
  return {
    padding: "3px 10px", fontSize: 10, fontFamily: "monospace",
    background: "transparent", border: `1px solid ${color}`,
    borderRadius: 4, color, cursor: "pointer", whiteSpace: "nowrap",
  }
}
