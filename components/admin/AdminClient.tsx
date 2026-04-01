"use client"

import Image from "next/image"
import Link from "next/link"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { formatISK } from "@/lib/utils"
import { calculateAcceptorStake } from "@/lib/odds"

const GOLD = "var(--ev-gold-light)"

interface Tournament {
  id: string
  name: string
  status: "registration" | "active" | "complete"
  entrant_count: number
  created_at: string
  currentEntrants: number
}

interface AddedEntrant {
  character_name: string
  corporation_name: string | null
  portrait_url: string | null
}

interface AdminProposal {
  id: string
  bracket_id: string
  proposer_character_id: number
  proposer_name: string
  predicted_winner_id: string
  predictedWinnerName: string
  bracketLabel: string
  isk_amount: number
  implied_prob: number
  status: string
  is_proxy: boolean
  acceptorStake: number
}

interface AdminSettlement {
  id: string
  round: number
  from_character_name: string
  to_character_name: string
  isk_amount: number
  is_paid: boolean
}

interface MatchRow {
  id: string
  round: number
  match_number: number
  locked: boolean
  entrant1_name: string | null
  entrant2_name: string | null
  winner_id: string | null
}

const STATUS_COLOR: Record<string, string> = {
  registration: "#3b82f6",
  active: "#22c55e",
  complete: GOLD,
}

export default function AdminClient({ initialTournaments }: { initialTournaments: Tournament[] }) {
  const router = useRouter()
  const [tournaments, setTournaments] = useState(initialTournaments)

  // Create tournament form
  const [createName, setCreateName] = useState("")
  const [createCount, setCreateCount] = useState<16 | 32 | 64>(16)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Add entrant form
  const [addName, setAddName] = useState("")
  const [addTournamentId, setAddTournamentId] = useState("")
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [addedEntrant, setAddedEntrant] = useState<AddedEntrant | null>(null)

  // Generate bracket
  const [generateLoadingId, setGenerateLoadingId] = useState<string | null>(null)
  const [generateError, setGenerateError] = useState<string | null>(null)

  // Bet management
  const [betMgmtTid, setBetMgmtTid] = useState("")
  const [betProposals, setBetProposals] = useState<AdminProposal[]>([])
  const [betSettlements, setBetSettlements] = useState<AdminSettlement[]>([])
  const [betMatches, setBetMatches] = useState<MatchRow[]>([])
  const [betLoading, setBetLoading] = useState(false)

  // Proxy form
  const [proxyAction, setProxyAction] = useState<"propose" | "accept">("propose")
  const [proxyCharName, setProxyCharName] = useState("")
  const [proxyCharId, setProxyCharId] = useState("")
  const [proxyBracketId, setProxyBracketId] = useState("")
  const [proxyWinnerId, setProxyWinnerId] = useState("")
  const [proxyAmount, setProxyAmount] = useState("")
  const [proxyProposalId, setProxyProposalId] = useState("")
  const [proxyLoading, setProxyLoading] = useState(false)
  const [proxyError, setProxyError] = useState<string | null>(null)
  const [proxySuccess, setProxySuccess] = useState<string | null>(null)

  // Edit proposal
  const [editProposalId, setEditProposalId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState("")
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Lock loading
  const [lockLoading, setLockLoading] = useState<string | null>(null)

  // Settlement pay
  const [payingId, setPayingId] = useState<string | null>(null)

  const activeTournaments = tournaments.filter((t) => t.status === "active")

  const fetchBetData = useCallback(async (tid: string) => {
    if (!tid) return
    setBetLoading(true)
    try {
      const [propRes, settlRes, bracketRes] = await Promise.all([
        fetch(`/api/tournament/${tid}/proposals`),
        fetch(`/api/tournament/${tid}/settlements`),
        fetch(`/api/tournament/${tid}/bracket`),
      ])
      if (propRes.ok) {
        const d = await propRes.json() as { proposals: AdminProposal[] }
        setBetProposals(d.proposals ?? [])
      }
      if (settlRes.ok) {
        const d = await settlRes.json() as { settlements: AdminSettlement[] }
        setBetSettlements(d.settlements ?? [])
      }
      if (bracketRes.ok) {
        const d = await bracketRes.json() as { brackets: Array<{ id: string; round: number; match_number: number; locked?: boolean; winner_id: string | null; entrant1?: { character_name: string } | null; entrant2?: { character_name: string } | null }> }
        setBetMatches(
          (d.brackets ?? [])
            .filter((b) => !b.winner_id && b.entrant1 && b.entrant2)
            .map((b) => ({
              id: b.id,
              round: b.round,
              match_number: b.match_number,
              locked: b.locked ?? false,
              entrant1_name: b.entrant1?.character_name ?? null,
              entrant2_name: b.entrant2?.character_name ?? null,
              winner_id: b.winner_id,
            }))
        )
      }
    } finally {
      setBetLoading(false)
    }
  }, [])

  useEffect(() => {
    if (betMgmtTid) void fetchBetData(betMgmtTid)
  }, [betMgmtTid, fetchBetData])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateLoading(true)
    setCreateError(null)
    try {
      const res = await fetch("/api/admin/tournament", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createName, entrantCount: createCount }),
      })
      const data = await res.json() as { tournament?: Tournament; error?: string }
      if (!res.ok) { setCreateError(data.error ?? "Failed to create tournament"); return }
      setCreateName("")
      router.refresh()
      if (data.tournament) {
        setTournaments((prev) => [{ ...data.tournament!, currentEntrants: 0 }, ...prev])
      }
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setCreateLoading(false)
    }
  }

  async function handleAddEntrant(e: React.FormEvent) {
    e.preventDefault()
    setAddLoading(true)
    setAddError(null)
    setAddedEntrant(null)
    try {
      const res = await fetch("/api/admin/entrant/search-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterName: addName, tournamentId: addTournamentId }),
      })
      const data = await res.json() as { entrant?: AddedEntrant; error?: string }
      if (!res.ok) { setAddError(data.error ?? "Failed to add entrant"); return }
      setAddedEntrant(data.entrant ?? null)
      setAddName("")
      setTournaments((prev) =>
        prev.map((t) => t.id === addTournamentId ? { ...t, currentEntrants: t.currentEntrants + 1 } : t)
      )
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setAddLoading(false)
    }
  }

  async function handleGenerate(tournamentId: string) {
    if (!confirm("Generate bracket and start tournament? This cannot be undone.")) return
    setGenerateLoadingId(tournamentId)
    setGenerateError(null)
    try {
      const res = await fetch(`/api/admin/tournament/${tournamentId}/generate`, { method: "POST" })
      const data = await res.json() as { error?: string }
      if (!res.ok) { setGenerateError(data.error ?? "Failed to generate bracket"); return }
      setTournaments((prev) =>
        prev.map((t) => t.id === tournamentId ? { ...t, status: "active" } : t)
      )
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setGenerateLoadingId(null)
    }
  }

  async function handleProxySubmit(e: React.FormEvent) {
    e.preventDefault()
    setProxyLoading(true)
    setProxyError(null)
    setProxySuccess(null)
    try {
      const iskNum = parseInt(proxyAmount.replace(/,/g, ""), 10)
      const body =
        proxyAction === "propose"
          ? {
              action: "propose",
              characterName: proxyCharName,
              characterId: parseInt(proxyCharId, 10),
              bracketId: proxyBracketId,
              predictedWinnerId: proxyWinnerId,
              iskAmount: iskNum,
            }
          : {
              action: "accept",
              characterName: proxyCharName,
              characterId: parseInt(proxyCharId, 10),
              proposalId: proxyProposalId,
            }

      const res = await fetch("/api/admin/bet/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) { setProxyError(data.error ?? "Failed"); return }
      setProxySuccess(`${proxyAction === "propose" ? "Proposal posted" : "Bet accepted"} for ${proxyCharName}`)
      setProxyCharName(""); setProxyCharId(""); setProxyBracketId("")
      setProxyWinnerId(""); setProxyAmount(""); setProxyProposalId("")
      void fetchBetData(betMgmtTid)
    } catch (e) {
      setProxyError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setProxyLoading(false)
    }
  }

  async function handleVoid(proposalId: string) {
    const reason = prompt("Void reason (optional):", "Admin voided")
    if (reason === null) return
    const res = await fetch("/api/admin/bet/void", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proposalId, reason }),
    })
    if (res.ok) void fetchBetData(betMgmtTid)
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editProposalId) return
    setEditLoading(true)
    setEditError(null)
    try {
      const res = await fetch("/api/admin/bet/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId: editProposalId, newIskAmount: parseInt(editAmount.replace(/,/g, ""), 10) }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) { setEditError(data.error ?? "Failed"); return }
      setEditProposalId(null)
      setEditAmount("")
      void fetchBetData(betMgmtTid)
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setEditLoading(false)
    }
  }

  async function handleLockToggle(bracketId: string, currentLocked: boolean) {
    setLockLoading(bracketId)
    try {
      const res = await fetch(`/api/admin/bracket/${bracketId}/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locked: !currentLocked }),
      })
      if (res.ok) {
        setBetMatches((prev) => prev.map((m) => m.id === bracketId ? { ...m, locked: !currentLocked } : m))
      }
    } finally {
      setLockLoading(null)
    }
  }

  async function handleMarkPaid(settlementId: string) {
    setPayingId(settlementId)
    try {
      const res = await fetch(`/api/tournament/${betMgmtTid}/settlement/${settlementId}/pay`, { method: "POST" })
      if (res.ok) void fetchBetData(betMgmtTid)
    } finally {
      setPayingId(null)
    }
  }

  const registrationTournaments = tournaments.filter((t) => t.status === "registration")

  const cardStyle: React.CSSProperties = {
    background: "var(--ev-card)",
    border: "0.5px solid var(--ev-border2)",
    borderRadius: 10,
    padding: 24,
    marginBottom: 24,
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 12px",
    background: "var(--ev-card2)", border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 4, color: "var(--ev-text)", fontSize: 13, fontFamily: "monospace",
    outline: "none", boxSizing: "border-box",
  }

  const labelStyle: React.CSSProperties = {
    display: "block", color: "var(--ev-muted)", fontSize: 10,
    fontFamily: "monospace", letterSpacing: 1, marginBottom: 6,
  }

  const subHeadStyle: React.CSSProperties = {
    color: "var(--ev-muted)", fontSize: 10, fontFamily: "monospace",
    letterSpacing: 1, marginBottom: 10, marginTop: 20, fontWeight: 600,
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
      padding: 24,
    }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <h1 style={{ color: GOLD, fontSize: 22, fontFamily: "monospace", fontWeight: 700, margin: 0 }}>
            ADMIN PANEL
          </h1>
          <Link href="/" style={{ marginLeft: "auto", fontSize: 12, color: "var(--ev-muted)", fontFamily: "monospace", textDecoration: "none" }}>
            ← Home
          </Link>
        </div>

        {/* Create Tournament */}
        <div style={cardStyle}>
          <h2 style={{ color: GOLD, fontSize: 12, fontFamily: "monospace", letterSpacing: 2, marginBottom: 20, fontWeight: 600 }}>
            CREATE TOURNAMENT
          </h2>
          <form onSubmit={handleCreate}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 2, minWidth: 200 }}>
                <label style={labelStyle}>TOURNAMENT NAME</label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Alliance Championship Season 1"
                  required
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>ENTRANT COUNT</label>
                <div style={{ display: "flex", gap: 1 }}>
                  {([16, 32, 64] as const).map((n) => (
                    <button key={n} type="button" onClick={() => setCreateCount(n)} style={{
                      padding: "8px 20px",
                      background: createCount === n ? GOLD : "transparent",
                      border: `1px solid ${createCount === n ? GOLD : "rgba(255,255,255,0.12)"}`,
                      borderRadius: n === 16 ? "4px 0 0 4px" : n === 64 ? "0 4px 4px 0" : "0",
                      color: createCount === n ? "var(--ev-bg)" : "var(--ev-muted)",
                      fontSize: 13, fontWeight: createCount === n ? 700 : 400,
                      cursor: "pointer", fontFamily: "monospace",
                    }}>{n}</button>
                  ))}
                </div>
              </div>
            </div>
            {createError && <div style={{ color: "#c0392b", fontSize: 12, fontFamily: "monospace", marginTop: 12 }}>{createError}</div>}
            <button type="submit" disabled={createLoading || !createName.trim()} style={{
              marginTop: 16, padding: "8px 24px",
              background: createLoading || !createName.trim() ? "rgba(240,192,64,0.15)" : GOLD,
              border: "none", borderRadius: 4,
              color: createLoading || !createName.trim() ? "var(--ev-muted)" : "var(--ev-bg)",
              fontSize: 12, fontWeight: 600, cursor: createLoading || !createName.trim() ? "not-allowed" : "pointer",
              fontFamily: "monospace",
            }}>
              {createLoading ? "Creating..." : "Create Tournament"}
            </button>
          </form>
        </div>

        {/* Add Entrant */}
        <div style={cardStyle}>
          <h2 style={{ color: GOLD, fontSize: 12, fontFamily: "monospace", letterSpacing: 2, marginBottom: 20, fontWeight: 600 }}>
            MANUAL ENTRANT ADD
          </h2>
          <form onSubmit={handleAddEntrant}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 2, minWidth: 200 }}>
                <label style={labelStyle}>CHARACTER NAME</label>
                <input type="text" value={addName} onChange={(e) => setAddName(e.target.value)}
                  placeholder="Exact character name" required style={inputStyle} />
              </div>
              <div style={{ flex: 2, minWidth: 200 }}>
                <label style={labelStyle}>TOURNAMENT</label>
                <select value={addTournamentId} onChange={(e) => setAddTournamentId(e.target.value)}
                  required style={{ ...inputStyle, cursor: "pointer" }}>
                  <option value="">Select tournament...</option>
                  {registrationTournaments.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.currentEntrants}/{t.entrant_count})</option>
                  ))}
                </select>
              </div>
            </div>
            {addError && <div style={{ color: "#c0392b", fontSize: 12, fontFamily: "monospace", marginTop: 12 }}>{addError}</div>}
            {addedEntrant && (
              <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 4 }}>
                {addedEntrant.portrait_url && (
                  <div style={{ borderRadius: "50%", overflow: "hidden", width: 36, height: 36, flexShrink: 0 }}>
                    <Image src={addedEntrant.portrait_url} alt={addedEntrant.character_name} width={36} height={36}
                      style={{ borderRadius: "50%", objectFit: "cover" }} />
                  </div>
                )}
                <div>
                  <div style={{ color: "#22c55e", fontSize: 13, fontWeight: 600 }}>Added: {addedEntrant.character_name}</div>
                  {addedEntrant.corporation_name && <div style={{ color: "var(--ev-muted)", fontSize: 11 }}>{addedEntrant.corporation_name}</div>}
                </div>
              </div>
            )}
            <button type="submit" disabled={addLoading || !addName.trim() || !addTournamentId} style={{
              marginTop: 16, padding: "8px 24px",
              background: addLoading || !addName.trim() || !addTournamentId ? "rgba(240,192,64,0.15)" : GOLD,
              border: "none", borderRadius: 4,
              color: addLoading || !addName.trim() || !addTournamentId ? "var(--ev-muted)" : "var(--ev-bg)",
              fontSize: 12, fontWeight: 600,
              cursor: addLoading || !addName.trim() || !addTournamentId ? "not-allowed" : "pointer",
              fontFamily: "monospace",
            }}>{addLoading ? "Searching..." : "Search & Add"}</button>
          </form>
        </div>

        {/* Tournament List */}
        <div style={cardStyle}>
          <h2 style={{ color: GOLD, fontSize: 12, fontFamily: "monospace", letterSpacing: 2, marginBottom: 20, fontWeight: 600 }}>
            TOURNAMENTS
          </h2>
          {generateError && <div style={{ color: "#c0392b", fontSize: 12, fontFamily: "monospace", marginBottom: 12 }}>{generateError}</div>}
          {tournaments.length === 0 ? (
            <div style={{ color: "#444", fontFamily: "monospace", fontSize: 12, padding: "20px 0" }}>No tournaments yet</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Name", "Status", "Entrants", "Created", "Actions"].map((h) => (
                    <th key={h} style={{
                      textAlign: "left", padding: "6px 12px",
                      fontSize: 10, fontFamily: "monospace", letterSpacing: 1,
                      color: "var(--ev-muted)", fontWeight: 600,
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                    }}>{h.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tournaments.map((t, i) => {
                  const canGenerate = t.status === "registration" && t.currentEntrants >= 4
                  return (
                    <tr key={t.id} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                      <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--ev-text)" }}>{t.name}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ fontSize: 10, fontFamily: "monospace", letterSpacing: 1, padding: "2px 8px", border: `1px solid ${STATUS_COLOR[t.status] ?? "var(--ev-muted)"}`, borderRadius: 3, color: STATUS_COLOR[t.status] ?? "var(--ev-muted)", textTransform: "uppercase" }}>{t.status}</span>
                      </td>
                      <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 12, color: "var(--ev-muted)" }}>{t.currentEntrants} / {t.entrant_count}</td>
                      <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 11, color: "var(--ev-muted)" }}>{new Date(t.created_at).toLocaleDateString()}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <Link href={`/tournament/${t.id}`} style={{ fontSize: 11, color: "var(--ev-text)", textDecoration: "none", padding: "3px 10px", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 3, fontFamily: "monospace" }}>View</Link>
                          {t.status === "registration" && (
                            <button onClick={() => void handleGenerate(t.id)}
                              disabled={!canGenerate || generateLoadingId === t.id}
                              title={!canGenerate ? "Requires at least 4 entrants" : undefined}
                              style={{ fontSize: 11, fontFamily: "monospace", padding: "3px 10px", background: "transparent", border: `1px solid ${canGenerate ? GOLD : "rgba(255,255,255,0.08)"}`, borderRadius: 3, color: canGenerate ? GOLD : "#444", cursor: canGenerate ? "pointer" : "not-allowed" }}>
                              {generateLoadingId === t.id ? "Generating..." : "Generate Bracket & Start"}
                            </button>
                          )}
                          {t.status === "active" && (
                            <Link href={`/tournament/${t.id}/bracket`} style={{ fontSize: 11, color: GOLD, textDecoration: "none", padding: "3px 10px", border: `1px solid rgba(240,192,64,0.3)`, borderRadius: 3, fontFamily: "monospace" }}>View Bracket</Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Bet Management — only for active tournaments */}
        {activeTournaments.length > 0 && (
          <div style={cardStyle}>
            <h2 style={{ color: GOLD, fontSize: 12, fontFamily: "monospace", letterSpacing: 2, marginBottom: 20, fontWeight: 600 }}>
              BET MANAGEMENT
            </h2>

            {/* Tournament selector */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>SELECT ACTIVE TOURNAMENT</label>
              <select value={betMgmtTid} onChange={(e) => setBetMgmtTid(e.target.value)}
                style={{ ...inputStyle, maxWidth: 400 }}>
                <option value="">Select tournament...</option>
                {activeTournaments.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {betMgmtTid && (
              <>
                {betLoading && <div style={{ color: "#444", fontFamily: "monospace", fontSize: 12, padding: "12px 0" }}>Loading...</div>}

                {!betLoading && (
                  <>
                    {/* ── Match Locks ── */}
                    {betMatches.length > 0 && (
                      <div style={{ marginBottom: 24 }}>
                        <div style={subHeadStyle}>MATCH LOCKS</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {betMatches.map((m) => (
                            <div key={m.id} style={{
                              display: "flex", alignItems: "center", gap: 12,
                              padding: "8px 12px",
                              background: "var(--ev-card2)", border: "0.5px solid var(--ev-border2)", borderRadius: 6,
                            }}>
                              <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--ev-muted)", minWidth: 60 }}>
                                R{m.round} M{m.match_number}
                              </span>
                              <span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--ev-text)", flex: 1 }}>
                                {m.entrant1_name} vs {m.entrant2_name}
                              </span>
                              <button
                                onClick={() => void handleLockToggle(m.id, m.locked)}
                                disabled={lockLoading === m.id}
                                style={{
                                  padding: "3px 10px", fontSize: 10, fontFamily: "monospace",
                                  background: "transparent",
                                  border: `1px solid ${m.locked ? "#f97316" : "rgba(255,255,255,0.12)"}`,
                                  borderRadius: 3,
                                  color: m.locked ? "#f97316" : "var(--ev-muted)",
                                  cursor: lockLoading === m.id ? "not-allowed" : "pointer",
                                }}>
                                {lockLoading === m.id ? "···" : m.locked ? "🔒 Locked" : "Unlocked"}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── Open Proposals ── */}
                    <div style={{ marginBottom: 24 }}>
                      <div style={subHeadStyle}>OPEN PROPOSALS ({betProposals.length})</div>
                      {betProposals.length === 0 ? (
                        <div style={{ color: "#444", fontFamily: "monospace", fontSize: 11 }}>No open proposals</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {betProposals.map((p) => (
                            <div key={p.id} style={{
                              display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                              padding: "8px 12px",
                              background: "var(--ev-card2)", border: "0.5px solid var(--ev-border2)", borderRadius: 6,
                            }}>
                              <span style={{ fontFamily: "monospace", fontSize: 10, color: "var(--ev-muted)", minWidth: 50 }}>{p.bracketLabel}</span>
                              <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--ev-text)", flex: 1 }}>
                                <span style={{ color: GOLD }}>{p.proposer_name}</span>
                                {p.is_proxy && <span style={{ marginLeft: 4, fontSize: 8, color: "#f97316", border: "1px solid #f97316", borderRadius: 3, padding: "0 3px" }}>PROXY</span>}
                                {" backs "}{p.predictedWinnerName}
                                {" · "}<span style={{ color: GOLD }}>{formatISK(p.isk_amount)}</span>
                                {" vs "}{formatISK(calculateAcceptorStake(p.isk_amount, p.implied_prob))}
                              </span>
                              {editProposalId === p.id ? (
                                <form onSubmit={(e) => void handleEditSubmit(e)} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                  <input
                                    type="text" value={editAmount} onChange={(e) => setEditAmount(e.target.value)}
                                    placeholder="New ISK amount" autoFocus
                                    style={{ padding: "3px 8px", background: "var(--ev-card)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 3, color: "var(--ev-text)", fontSize: 11, fontFamily: "monospace", width: 120 }}
                                  />
                                  <button type="submit" disabled={editLoading} style={{ padding: "3px 8px", background: GOLD, border: "none", borderRadius: 3, color: "var(--ev-bg)", fontSize: 10, fontFamily: "monospace", cursor: "pointer" }}>Save</button>
                                  <button type="button" onClick={() => { setEditProposalId(null); setEditError(null) }} style={{ padding: "3px 8px", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 3, color: "var(--ev-muted)", fontSize: 10, fontFamily: "monospace", cursor: "pointer" }}>Cancel</button>
                                  {editError && <span style={{ color: "#c0392b", fontSize: 10, fontFamily: "monospace" }}>{editError}</span>}
                                </form>
                              ) : (
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button onClick={() => { setEditProposalId(p.id); setEditAmount(String(p.isk_amount)) }} style={{ padding: "3px 8px", background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 3, color: "var(--ev-muted)", fontSize: 10, fontFamily: "monospace", cursor: "pointer" }}>Edit</button>
                                  <button onClick={() => void handleVoid(p.id)} style={{ padding: "3px 8px", background: "transparent", border: "1px solid rgba(192,57,43,0.4)", borderRadius: 3, color: "#c0392b", fontSize: 10, fontFamily: "monospace", cursor: "pointer" }}>Void</button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* ── Proxy Bet Form ── */}
                    <div style={{ marginBottom: 24 }}>
                      <div style={subHeadStyle}>PROXY BET</div>
                      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                        {(["propose", "accept"] as const).map((a) => (
                          <button key={a} type="button" onClick={() => setProxyAction(a)} style={{
                            padding: "5px 16px",
                            background: proxyAction === a ? GOLD : "transparent",
                            border: `1px solid ${proxyAction === a ? GOLD : "rgba(255,255,255,0.12)"}`,
                            borderRadius: 4, fontFamily: "monospace", fontSize: 11,
                            color: proxyAction === a ? "var(--ev-bg)" : "var(--ev-muted)", cursor: "pointer",
                          }}>{a.toUpperCase()}</button>
                        ))}
                      </div>
                      <form onSubmit={(e) => void handleProxySubmit(e)}>
                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                          <div style={{ flex: 1, minWidth: 180 }}>
                            <label style={labelStyle}>CHARACTER NAME</label>
                            <input type="text" value={proxyCharName} onChange={(e) => setProxyCharName(e.target.value)} required placeholder="EVE character name" style={inputStyle} />
                          </div>
                          <div style={{ flex: 1, minWidth: 140 }}>
                            <label style={labelStyle}>CHARACTER ID</label>
                            <input type="number" value={proxyCharId} onChange={(e) => setProxyCharId(e.target.value)} required placeholder="EVE character ID" style={inputStyle} />
                          </div>
                        </div>

                        {proxyAction === "propose" && (
                          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                            <div style={{ flex: 1, minWidth: 180 }}>
                              <label style={labelStyle}>MATCH</label>
                              <select value={proxyBracketId} onChange={(e) => setProxyBracketId(e.target.value)} required style={{ ...inputStyle, cursor: "pointer" }}>
                                <option value="">Select match...</option>
                                {betMatches.map((m) => (
                                  <option key={m.id} value={m.id}>R{m.round} M{m.match_number}: {m.entrant1_name} vs {m.entrant2_name}</option>
                                ))}
                              </select>
                            </div>
                            <div style={{ flex: 1, minWidth: 180 }}>
                              <label style={labelStyle}>BACK FIGHTER (entrant ID)</label>
                              <input type="text" value={proxyWinnerId} onChange={(e) => setProxyWinnerId(e.target.value)} required placeholder="Entrant UUID" style={inputStyle} />
                            </div>
                            <div style={{ flex: 1, minWidth: 140 }}>
                              <label style={labelStyle}>ISK AMOUNT</label>
                              <input type="text" value={proxyAmount} onChange={(e) => setProxyAmount(e.target.value)} required placeholder="e.g. 500000000" style={inputStyle} />
                            </div>
                          </div>
                        )}

                        {proxyAction === "accept" && (
                          <div style={{ marginBottom: 12 }}>
                            <label style={labelStyle}>PROPOSAL</label>
                            <select value={proxyProposalId} onChange={(e) => setProxyProposalId(e.target.value)} required style={{ ...inputStyle, cursor: "pointer" }}>
                              <option value="">Select open proposal...</option>
                              {betProposals.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.bracketLabel} · {p.proposer_name} backs {p.predictedWinnerName} · {formatISK(p.isk_amount)}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {proxyError && <div style={{ color: "#c0392b", fontSize: 11, fontFamily: "monospace", marginBottom: 8 }}>{proxyError}</div>}
                        {proxySuccess && <div style={{ color: "#22c55e", fontSize: 11, fontFamily: "monospace", marginBottom: 8 }}>{proxySuccess}</div>}

                        <button type="submit" disabled={proxyLoading} style={{
                          padding: "7px 20px", background: proxyLoading ? "rgba(240,192,64,0.15)" : GOLD,
                          border: "none", borderRadius: 4,
                          color: proxyLoading ? "var(--ev-muted)" : "var(--ev-bg)",
                          fontSize: 11, fontWeight: 600, fontFamily: "monospace",
                          cursor: proxyLoading ? "not-allowed" : "pointer",
                        }}>{proxyLoading ? "···" : `Proxy ${proxyAction === "propose" ? "Proposal" : "Accept"}`}</button>
                      </form>
                    </div>

                    {/* ── Settlements ── */}
                    {betSettlements.length > 0 && (
                      <div>
                        <div style={subHeadStyle}>SETTLEMENTS</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {betSettlements.map((s) => (
                            <div key={s.id} style={{
                              display: "flex", alignItems: "center", gap: 12,
                              padding: "8px 12px",
                              background: "var(--ev-card2)", border: "0.5px solid var(--ev-border2)", borderRadius: 6,
                            }}>
                              <span style={{ fontFamily: "monospace", fontSize: 10, color: "var(--ev-muted)", minWidth: 50 }}>R{s.round}</span>
                              <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--ev-text)", flex: 1 }}>
                                <span style={{ color: "#c0392b" }}>{s.from_character_name}</span>
                                {" owes "}
                                <span style={{ color: "#27ae60" }}>{s.to_character_name}</span>
                                {" — "}
                                <span style={{ color: GOLD }}>{formatISK(s.isk_amount)}</span>
                              </span>
                              {s.is_paid ? (
                                <span style={{ fontSize: 10, fontFamily: "monospace", color: "#22c55e" }}>PAID ✓</span>
                              ) : (
                                <button onClick={() => void handleMarkPaid(s.id)} disabled={payingId === s.id} style={{
                                  padding: "3px 8px", background: "transparent",
                                  border: "1px solid rgba(34,197,94,0.4)", borderRadius: 3,
                                  color: "#22c55e", fontSize: 10, fontFamily: "monospace",
                                  cursor: payingId === s.id ? "not-allowed" : "pointer",
                                }}>{payingId === s.id ? "···" : "Mark Paid"}</button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
