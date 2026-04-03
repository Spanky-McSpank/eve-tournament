"use client"

import { useState, useEffect, useCallback } from "react"
import { formatISK } from "@/lib/utils"
import { calcPropOdds } from "@/lib/props"
import type { PropBet, PropStatus, PropCategory } from "@/lib/props"

const GOLD = "var(--ev-gold-light)"

interface Tournament {
  id: string
  name: string
  status: string
}

interface PropManagementSectionProps {
  tournaments: Tournament[]
  inputStyle: React.CSSProperties
  labelStyle: React.CSSProperties
  subHeadStyle: React.CSSProperties
  tinyBtnStyle: (variant?: "danger" | "gold" | "orange") => React.CSSProperties
}

type PropTab = "create" | "pending" | "active" | "resolved"

const VALID_CATEGORIES: { value: PropCategory; label: string }[] = [
  { value: "tournament_winner", label: "Tournament Winner" },
  { value: "reaches_final", label: "Reaches Final" },
  { value: "reaches_semifinal", label: "Reaches Semifinal" },
  { value: "reaches_top4", label: "Reaches Top 4" },
  { value: "round1_elimination", label: "Round 1 Elimination" },
  { value: "match_duration", label: "Match Duration" },
  { value: "isk_destroyed", label: "ISK Destroyed" },
  { value: "custom", label: "Custom Prop" },
]

export default function PropManagementSection({
  tournaments,
  inputStyle,
  labelStyle,
  subHeadStyle,
  tinyBtnStyle,
}: PropManagementSectionProps) {
  const [propTab, setPropTab] = useState<PropTab>("create")
  const [props, setProps] = useState<PropBet[]>([])
  const [propsLoading, setPropsLoading] = useState(false)

  // Create form
  const [createTitle, setCreateTitle] = useState("")
  const [createDesc, setCreateDesc] = useState("")
  const [createCategory, setCreateCategory] = useState<PropCategory>("custom")
  const [createTargetName, setCreateTargetName] = useState("")
  const [createTargetId, setCreateTargetId] = useState("")
  const [createResolution, setCreateResolution] = useState("")
  const [createYesProb, setCreateYesProb] = useState(0.5)
  const [createLockMode, setCreateLockMode] = useState<"none" | "round" | "time">("none")
  const [createLockRound, setCreateLockRound] = useState("")
  const [createLockAt, setCreateLockAt] = useState("")
  const [createTournamentId, setCreateTournamentId] = useState("")
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState<string | null>(null)

  // Approve modal
  const [approveId, setApproveId] = useState<string | null>(null)
  const [approveYesProb, setApproveYesProb] = useState(0.5)
  const [approveLoading, setApproveLoading] = useState(false)

  // Resolve
  const [resolveId, setResolveId] = useState<string | null>(null)
  const [resolveSide, setResolveSide] = useState<"yes" | "no">("yes")
  const [resolveNote, setResolveNote] = useState("")
  const [resolveLoading, setResolveLoading] = useState(false)
  const [resolveError, setResolveError] = useState<string | null>(null)

  // Void
  const [voidId, setVoidId] = useState<string | null>(null)
  const [voidReason, setVoidReason] = useState("")
  const [voidLoading, setVoidLoading] = useState(false)

  const activeTournaments = tournaments.filter((t) => t.status === "active" || t.status === "registration")

  const fetchAllProps = useCallback(async () => {
    if (activeTournaments.length === 0) return
    setPropsLoading(true)
    try {
      const results = await Promise.all(
        activeTournaments.map((t) =>
          fetch(`/api/tournament/${t.id}/props?_admin=1`)
            .then((r) => r.ok ? r.json() : { props: [] })
            .then((d: { props?: PropBet[] }) => d.props ?? [])
        )
      )
      // Also fetch pending_approval (not returned by public route)
      const pendingResults = await Promise.all(
        activeTournaments.map((t) =>
          fetch(`/api/admin/props/pending?tournamentId=${t.id}`)
            .then((r) => r.ok ? r.json() : { props: [] })
            .then((d: { props?: PropBet[] }) => d.props ?? [])
        )
      )
      const allProps = [...results.flat(), ...pendingResults.flat()]
      // Deduplicate by id
      const seen = new Set<string>()
      setProps(allProps.filter((p) => { if (seen.has(p.id)) return false; seen.add(p.id); return true }))
    } finally {
      setPropsLoading(false)
    }
  }, [activeTournaments.map((t) => t.id).join(",")])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void fetchAllProps()
  }, [fetchAllProps])

  const pendingProps = props.filter((p) => p.status === "pending_approval")
  const activeProps = props.filter((p) => p.status === "approved" || p.status === "locked")
  const resolvedProps = props.filter((p) => p.status === "resolved_yes" || p.status === "resolved_no" || p.status === "void")

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateLoading(true)
    setCreateError(null)
    setCreateSuccess(null)
    try {
      const body: Record<string, unknown> = {
        tournamentId: createTournamentId,
        title: createTitle,
        description: createDesc || undefined,
        category: createCategory,
        targetCharacterName: createTargetName || undefined,
        targetCharacterId: createTargetId ? Number(createTargetId) : undefined,
        resolutionCondition: createResolution || undefined,
        yesProb: createYesProb,
      }
      if (createLockMode === "round" && createLockRound) body.locksAtRound = Number(createLockRound)
      if (createLockMode === "time" && createLockAt) body.locksAt = createLockAt

      const res = await fetch("/api/admin/props/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json() as { prop?: PropBet; error?: string }
      if (!res.ok) { setCreateError(data.error ?? "Failed to create prop"); return }
      setCreateSuccess(`Created: "${data.prop?.title}"`)
      setCreateTitle("")
      setCreateDesc("")
      setCreateResolution("")
      setCreateTargetName("")
      setCreateTargetId("")
      setCreateYesProb(0.5)
      setCreateLockMode("none")
      setCreateLockRound("")
      setCreateLockAt("")
      void fetchAllProps()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setCreateLoading(false)
    }
  }

  async function handleApprove() {
    if (!approveId) return
    setApproveLoading(true)
    try {
      const res = await fetch(`/api/admin/props/${approveId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yesProb: approveYesProb }),
      })
      if (res.ok) {
        setApproveId(null)
        void fetchAllProps()
      }
    } finally {
      setApproveLoading(false)
    }
  }

  async function handleReject(propId: string) {
    const reason = prompt("Rejection reason:")
    if (!reason) return
    await fetch(`/api/admin/props/${propId}/void`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    })
    void fetchAllProps()
  }

  async function handleLockNow(propId: string) {
    await fetch(`/api/admin/props/${propId}/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "locked" }),
    })
    void fetchAllProps()
  }

  async function handleResolveSubmit() {
    if (!resolveId) return
    if (resolveNote.trim().length < 5) { setResolveError("Note must be at least 5 characters"); return }
    setResolveLoading(true)
    setResolveError(null)
    try {
      const res = await fetch(`/api/admin/props/${resolveId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution: resolveSide, note: resolveNote }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) { setResolveError(data.error ?? "Failed to resolve"); return }
      setResolveId(null)
      setResolveNote("")
      void fetchAllProps()
    } finally {
      setResolveLoading(false)
    }
  }

  async function handleVoidSubmit() {
    if (!voidId || !voidReason.trim()) return
    setVoidLoading(true)
    try {
      await fetch(`/api/admin/props/${voidId}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: voidReason }),
      })
      setVoidId(null)
      setVoidReason("")
      void fetchAllProps()
    } finally {
      setVoidLoading(false)
    }
  }

  const createOdds = calcPropOdds(createYesProb)

  const PROP_TABS: { key: PropTab; label: string }[] = [
    { key: "create", label: "Create New Prop" },
    { key: "pending", label: `Pending (${pendingProps.length})` },
    { key: "active", label: "Active Props" },
    { key: "resolved", label: "Resolved" },
  ]

  const categoryBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: "9px 16px", background: "transparent", border: "none",
    borderBottom: active ? `2px solid ${GOLD}` : "2px solid transparent",
    color: active ? GOLD : "var(--ev-muted)",
    fontSize: 11, fontFamily: "monospace", letterSpacing: 1, cursor: "pointer",
    textTransform: "uppercase" as const, marginBottom: -1,
  })

  function statusBadge(status: PropStatus) {
    const colors: Record<string, string> = {
      pending_approval: "#f59e0b",
      approved: "#22c55e",
      locked: "#f97316",
      resolved_yes: "#3b82f6",
      resolved_no: "#6b7280",
      void: "#4b5563",
    }
    const col = colors[status] ?? "var(--ev-muted)"
    return (
      <span style={{ fontSize: 9, fontFamily: "monospace", letterSpacing: 1, padding: "2px 7px", border: `1px solid ${col}`, borderRadius: 3, color: col, textTransform: "uppercase" as const }}>
        {status.replace(/_/g, " ")}
      </span>
    )
  }

  return (
    <div style={{ background: "var(--ev-card)", border: "0.5px solid var(--ev-border2)", borderRadius: 10, padding: 24, marginBottom: 24 }}>
      <h2 style={{ color: GOLD, fontSize: 12, fontFamily: "monospace", letterSpacing: 2, marginBottom: 20, fontWeight: 600 }}>
        🎲 PROPOSITION BET MANAGEMENT
      </h2>

      {/* Sub-tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)", marginBottom: 24 }}>
        {PROP_TABS.map((t) => (
          <button key={t.key} onClick={() => setPropTab(t.key)} style={categoryBtnStyle(propTab === t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Create New Prop */}
      {propTab === "create" && (
        <form onSubmit={(e) => void handleCreate(e)}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
            <div style={{ flex: 2, minWidth: 220 }}>
              <label style={labelStyle}>TITLE</label>
              <input type="text" value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder="e.g. Player X wins the tournament" required style={inputStyle} />
            </div>
            <div style={{ flex: 2, minWidth: 220 }}>
              <label style={labelStyle}>TOURNAMENT</label>
              <select value={createTournamentId} onChange={(e) => setCreateTournamentId(e.target.value)} required style={{ ...inputStyle, cursor: "pointer" }}>
                <option value="">Select tournament...</option>
                {activeTournaments.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>DESCRIPTION (OPTIONAL)</label>
            <textarea value={createDesc} onChange={(e) => setCreateDesc(e.target.value)} rows={2} placeholder="Flavor text or additional context..." style={{ ...inputStyle, resize: "vertical" as const }} />
          </div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label style={labelStyle}>CATEGORY</label>
              <select value={createCategory} onChange={(e) => setCreateCategory(e.target.value as PropCategory)} style={{ ...inputStyle, cursor: "pointer" }}>
                {VALID_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label style={labelStyle}>TARGET CHARACTER NAME</label>
              <input type="text" value={createTargetName} onChange={(e) => setCreateTargetName(e.target.value)} placeholder="Character name (optional)" style={inputStyle} />
            </div>
            <div style={{ minWidth: 140 }}>
              <label style={labelStyle}>TARGET CHARACTER ID</label>
              <input type="number" value={createTargetId} onChange={(e) => setCreateTargetId(e.target.value)} placeholder="EVE ID (optional)" style={inputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>RESOLUTION CONDITION</label>
            <input type="text" value={createResolution} onChange={(e) => setCreateResolution(e.target.value)} placeholder="e.g. Character must appear in the final match" style={inputStyle} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>YES PROBABILITY — {Math.round(createYesProb * 100)}%</label>
            <input type="range" min={0.1} max={0.9} step={0.05} value={createYesProb}
              onChange={(e) => setCreateYesProb(parseFloat(e.target.value))}
              style={{ width: "100%", accentColor: GOLD }} />
            <div style={{ fontSize: 10, fontFamily: "monospace", color: "var(--ev-muted)", marginTop: 4 }}>
              YES pays <span style={{ color: "#22c55e" }}>{createOdds.yes.fractional}</span>
              {" · "}
              NO pays <span style={{ color: "#c0392b" }}>{createOdds.no.fractional}</span>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={subHeadStyle}>AUTO-LOCK</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {(["none", "round", "time"] as const).map((mode) => (
                <label key={mode} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontFamily: "monospace", color: "var(--ev-muted)", cursor: "pointer" }}>
                  <input type="radio" name="lockMode" value={mode} checked={createLockMode === mode} onChange={() => setCreateLockMode(mode)} />
                  {mode === "none" ? "None" : mode === "round" ? "Lock at Round" : "Lock at Time"}
                </label>
              ))}
              {createLockMode === "round" && (
                <input type="number" min={1} value={createLockRound} onChange={(e) => setCreateLockRound(e.target.value)}
                  placeholder="Round #" style={{ ...inputStyle, width: 100 }} />
              )}
              {createLockMode === "time" && (
                <input type="datetime-local" value={createLockAt} onChange={(e) => setCreateLockAt(e.target.value)}
                  style={{ ...inputStyle, width: 220 }} />
              )}
            </div>
          </div>

          {createError && <div style={{ color: "#c0392b", fontSize: 12, fontFamily: "monospace", marginBottom: 12 }}>{createError}</div>}
          {createSuccess && <div style={{ color: "#22c55e", fontSize: 12, fontFamily: "monospace", marginBottom: 12 }}>✓ {createSuccess}</div>}

          <button type="submit" disabled={createLoading || !createTitle.trim() || !createTournamentId} style={{
            padding: "8px 24px",
            background: createLoading || !createTitle.trim() || !createTournamentId ? "rgba(240,192,64,0.15)" : GOLD,
            border: "none", borderRadius: 4,
            color: createLoading || !createTitle.trim() || !createTournamentId ? "var(--ev-muted)" : "var(--ev-bg)",
            fontSize: 12, fontWeight: 600,
            cursor: createLoading || !createTitle.trim() || !createTournamentId ? "not-allowed" : "pointer",
            fontFamily: "monospace",
          }}>{createLoading ? "Creating..." : "Create Prop"}</button>
        </form>
      )}

      {/* Pending Suggestions */}
      {propTab === "pending" && (
        <div>
          {propsLoading && <div style={{ color: "#444", fontFamily: "monospace", fontSize: 12 }}>Loading...</div>}
          {!propsLoading && pendingProps.length === 0 && (
            <div style={{ color: "#444", fontFamily: "monospace", fontSize: 12, padding: "20px 0" }}>No pending suggestions</div>
          )}
          {!propsLoading && pendingProps.map((p) => (
            <div key={p.id} style={{ padding: "12px 14px", marginBottom: 10, background: "var(--ev-card2)", border: "0.5px solid var(--ev-border2)", borderRadius: 6 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 13, color: "var(--ev-text)", fontWeight: 500, marginBottom: 4 }}>{p.title}</div>
                  <div style={{ fontSize: 10, fontFamily: "monospace", color: "var(--ev-muted)" }}>
                    By <span style={{ color: "var(--ev-champagne)" }}>{p.created_by_name}</span>
                    {" · "}{p.category.replace(/_/g, " ")}
                    {p.target_character_name && <span> · Target: {p.target_character_name}</span>}
                  </div>
                  {p.description && <div style={{ fontSize: 11, color: "var(--ev-muted)", marginTop: 4, fontStyle: "italic" }}>{p.description}</div>}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setApproveId(p.id); setApproveYesProb(0.5) }}
                    style={tinyBtnStyle("gold")}>Approve</button>
                  <button onClick={() => void handleReject(p.id)}
                    style={tinyBtnStyle("danger")}>Reject</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active Props */}
      {propTab === "active" && (
        <div>
          {propsLoading && <div style={{ color: "#444", fontFamily: "monospace", fontSize: 12 }}>Loading...</div>}
          {!propsLoading && activeProps.length === 0 && (
            <div style={{ color: "#444", fontFamily: "monospace", fontSize: 12, padding: "20px 0" }}>No active props</div>
          )}
          {!propsLoading && activeProps.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Title", "Category", "Target", "YES%", "Status", "Actions"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "6px 10px", fontSize: 9, fontFamily: "monospace", letterSpacing: 1, color: "var(--ev-muted)", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{h.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeProps.map((p, i) => (
                  <tr key={p.id} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                    <td style={{ padding: "8px 10px", fontSize: 12, color: "var(--ev-text)", maxWidth: 200 }}>{p.title}</td>
                    <td style={{ padding: "8px 10px", fontSize: 10, fontFamily: "monospace", color: "var(--ev-muted)" }}>{p.category.replace(/_/g, " ")}</td>
                    <td style={{ padding: "8px 10px", fontSize: 10, fontFamily: "monospace", color: "var(--ev-muted)" }}>{p.target_character_name ?? "—"}</td>
                    <td style={{ padding: "8px 10px", fontFamily: "monospace", fontSize: 11, color: GOLD }}>{Math.round(p.yes_prob * 100)}%</td>
                    <td style={{ padding: "8px 10px" }}>{statusBadge(p.status)}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {p.status === "approved" && (
                          <button onClick={() => void handleLockNow(p.id)} style={tinyBtnStyle("orange")}>Lock Now</button>
                        )}
                        <button onClick={() => { setResolveId(p.id); setResolveSide("yes"); setResolveNote(""); setResolveError(null) }}
                          style={tinyBtnStyle("gold")}>Resolve ✓/✗</button>
                        <button onClick={() => { setVoidId(p.id); setVoidReason("") }}
                          style={tinyBtnStyle("danger")}>Void</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Resolved */}
      {propTab === "resolved" && (
        <div>
          {propsLoading && <div style={{ color: "#444", fontFamily: "monospace", fontSize: 12 }}>Loading...</div>}
          {!propsLoading && resolvedProps.length === 0 && (
            <div style={{ color: "#444", fontFamily: "monospace", fontSize: 12, padding: "20px 0" }}>No resolved props yet</div>
          )}
          {!propsLoading && resolvedProps.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Title", "Category", "Status", "Resolved By", "Note"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "6px 10px", fontSize: 9, fontFamily: "monospace", letterSpacing: 1, color: "var(--ev-muted)", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{h.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resolvedProps.map((p, i) => (
                  <tr key={p.id} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                    <td style={{ padding: "8px 10px", fontSize: 12, color: "var(--ev-text)", maxWidth: 200 }}>{p.title}</td>
                    <td style={{ padding: "8px 10px", fontSize: 10, fontFamily: "monospace", color: "var(--ev-muted)" }}>{p.category.replace(/_/g, " ")}</td>
                    <td style={{ padding: "8px 10px" }}>{statusBadge(p.status)}</td>
                    <td style={{ padding: "8px 10px", fontSize: 10, fontFamily: "monospace", color: "var(--ev-muted)" }}>{p.resolved_by_name ?? "—"}</td>
                    <td style={{ padding: "8px 10px", fontSize: 10, fontFamily: "monospace", color: "var(--ev-muted)", maxWidth: 200 }}>{p.resolution_note ?? p.void_reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Approve Modal */}
      {approveId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--ev-card)", border: "1px solid var(--ev-border2)", borderRadius: 10, padding: 28, width: "100%", maxWidth: 400 }}>
            <h3 style={{ color: GOLD, fontFamily: "monospace", fontSize: 13, marginBottom: 20, fontWeight: 600 }}>APPROVE PROP</h3>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", color: "var(--ev-muted)", fontSize: 10, fontFamily: "monospace", letterSpacing: 1, marginBottom: 6 }}>
                YES PROBABILITY — {Math.round(approveYesProb * 100)}%
              </label>
              <input type="range" min={0.1} max={0.9} step={0.05} value={approveYesProb}
                onChange={(e) => setApproveYesProb(parseFloat(e.target.value))}
                style={{ width: "100%", accentColor: GOLD }} />
              <div style={{ fontSize: 10, fontFamily: "monospace", color: "var(--ev-muted)", marginTop: 4 }}>
                {(() => { const o = calcPropOdds(approveYesProb); return `YES pays ${o.yes.fractional} · NO pays ${o.no.fractional}` })()}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => void handleApprove()} disabled={approveLoading}
                style={{ padding: "7px 20px", background: approveLoading ? "rgba(240,192,64,0.15)" : GOLD, border: "none", borderRadius: 4, color: approveLoading ? "var(--ev-muted)" : "var(--ev-bg)", fontSize: 12, fontWeight: 600, fontFamily: "monospace", cursor: "pointer" }}>
                {approveLoading ? "···" : "Approve"}
              </button>
              <button onClick={() => setApproveId(null)}
                style={{ padding: "7px 16px", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4, color: "var(--ev-muted)", fontSize: 12, fontFamily: "monospace", cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Modal */}
      {resolveId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--ev-card)", border: "1px solid var(--ev-border2)", borderRadius: 10, padding: 28, width: "100%", maxWidth: 440 }}>
            <h3 style={{ color: GOLD, fontFamily: "monospace", fontSize: 13, marginBottom: 20, fontWeight: 600 }}>RESOLVE PROP</h3>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", color: "var(--ev-muted)", fontSize: 10, fontFamily: "monospace", letterSpacing: 1, marginBottom: 8 }}>RESOLUTION</label>
              <div style={{ display: "flex", gap: 8 }}>
                {(["yes", "no"] as const).map((side) => (
                  <button key={side} type="button" onClick={() => setResolveSide(side)} style={{
                    flex: 1, padding: "10px", background: resolveSide === side ? (side === "yes" ? "rgba(34,197,94,0.1)" : "rgba(192,57,43,0.1)") : "transparent",
                    border: `1px solid ${resolveSide === side ? (side === "yes" ? "#22c55e" : "#c0392b") : "rgba(255,255,255,0.12)"}`,
                    borderRadius: 4, color: side === "yes" ? "#22c55e" : "#c0392b",
                    fontSize: 12, fontWeight: 600, fontFamily: "monospace", cursor: "pointer",
                  }}>
                    {side === "yes" ? "✓ CAME TRUE" : "✗ DID NOT HAPPEN"}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", color: "var(--ev-muted)", fontSize: 10, fontFamily: "monospace", letterSpacing: 1, marginBottom: 6 }}>RESOLUTION NOTE (required)</label>
              <textarea value={resolveNote} onChange={(e) => setResolveNote(e.target.value)}
                placeholder="Explain the resolution..."
                rows={3}
                style={{ width: "100%", padding: "8px 12px", background: "var(--ev-card2)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4, color: "var(--ev-text)", fontSize: 13, fontFamily: "monospace", outline: "none", boxSizing: "border-box", resize: "vertical" as const }} />
            </div>
            {resolveError && <div style={{ color: "#c0392b", fontSize: 11, fontFamily: "monospace", marginBottom: 10 }}>{resolveError}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => void handleResolveSubmit()} disabled={resolveLoading || resolveNote.trim().length < 5}
                style={{ padding: "7px 20px", background: resolveLoading || resolveNote.trim().length < 5 ? "rgba(240,192,64,0.15)" : GOLD, border: "none", borderRadius: 4, color: resolveLoading || resolveNote.trim().length < 5 ? "var(--ev-muted)" : "var(--ev-bg)", fontSize: 12, fontWeight: 600, fontFamily: "monospace", cursor: "pointer" }}>
                {resolveLoading ? "···" : "Confirm Resolution"}
              </button>
              <button onClick={() => { setResolveId(null); setResolveError(null) }}
                style={{ padding: "7px 16px", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4, color: "var(--ev-muted)", fontSize: 12, fontFamily: "monospace", cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Void Modal */}
      {voidId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--ev-card)", border: "1px solid var(--ev-border2)", borderRadius: 10, padding: 28, width: "100%", maxWidth: 400 }}>
            <h3 style={{ color: "#c0392b", fontFamily: "monospace", fontSize: 13, marginBottom: 20, fontWeight: 600 }}>VOID PROP</h3>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", color: "var(--ev-muted)", fontSize: 10, fontFamily: "monospace", letterSpacing: 1, marginBottom: 6 }}>VOID REASON</label>
              <input type="text" value={voidReason} onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Why is this prop being voided?"
                style={{ width: "100%", padding: "8px 12px", background: "var(--ev-card2)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4, color: "var(--ev-text)", fontSize: 13, fontFamily: "monospace", outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => void handleVoidSubmit()} disabled={voidLoading || !voidReason.trim()}
                style={{ padding: "7px 20px", background: !voidReason.trim() ? "rgba(192,57,43,0.15)" : "rgba(192,57,43,0.8)", border: "none", borderRadius: 4, color: !voidReason.trim() ? "rgba(192,57,43,0.5)" : "#fff", fontSize: 12, fontWeight: 600, fontFamily: "monospace", cursor: !voidReason.trim() ? "not-allowed" : "pointer" }}>
                {voidLoading ? "···" : "Void Prop"}
              </button>
              <button onClick={() => setVoidId(null)}
                style={{ padding: "7px 16px", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4, color: "var(--ev-muted)", fontSize: 12, fontFamily: "monospace", cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
