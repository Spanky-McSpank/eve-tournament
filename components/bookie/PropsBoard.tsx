"use client"

import { useEffect, useState, useCallback } from "react"
import { createSupabaseClient } from "@/lib/supabase"
import type { PropWithProposals } from "@/lib/props"
import PropCard from "./PropCard"

const GOLD = "var(--ev-gold-light)"

type SubTab = "open" | "locked" | "resolved" | "suggest"

interface PropsBoardProps {
  tournamentId: string
  currentCharacterId?: number
}

interface Tournament {
  id: string
  name: string
}

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "open", label: "Open Props" },
  { key: "locked", label: "Locked" },
  { key: "resolved", label: "Resolved" },
  { key: "suggest", label: "Suggest a Prop" },
]

const VALID_CATEGORIES = [
  { value: "tournament_winner", label: "Tournament Winner" },
  { value: "reaches_final", label: "Reaches Final" },
  { value: "reaches_semifinal", label: "Reaches Semifinal" },
  { value: "reaches_top4", label: "Reaches Top 4" },
  { value: "round1_elimination", label: "Round 1 Elimination" },
  { value: "match_duration", label: "Match Duration" },
  { value: "isk_destroyed", label: "ISK Destroyed" },
  { value: "custom", label: "Custom Prop" },
]

export default function PropsBoard({ tournamentId, currentCharacterId }: PropsBoardProps) {
  const [subTab, setSubTab] = useState<SubTab>("open")
  const [props, setProps] = useState<PropWithProposals[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  // Suggestion form
  const [suggestTitle, setSuggestTitle] = useState("")
  const [suggestDesc, setSuggestDesc] = useState("")
  const [suggestCategory, setSuggestCategory] = useState("custom")
  const [suggestTarget, setSuggestTarget] = useState("")
  const [suggestName, setSuggestName] = useState("")
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [suggestError, setSuggestError] = useState<string | null>(null)
  const [suggestSuccess, setSuggestSuccess] = useState(false)

  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [suggestTournamentId, setSuggestTournamentId] = useState(tournamentId)

  const fetchProps = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tournament/${tournamentId}/props`)
      if (res.ok) {
        const data = await res.json() as { props: PropWithProposals[] }
        setProps(data.props ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [tournamentId])

  useEffect(() => {
    void fetchProps()
  }, [fetchProps, refreshKey])

  // Fetch tournament list for suggestion form
  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/tournament")
      if (res.ok) {
        const data = await res.json() as { tournaments?: Tournament[] }
        setTournaments(data.tournaments ?? [])
      }
    })()
  }, [])

  // Realtime subscription
  useEffect(() => {
    const supabase = createSupabaseClient()
    const channels = [
      supabase
        .channel(`props-${tournamentId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "prop_bets", filter: `tournament_id=eq.${tournamentId}` },
          () => { setRefreshKey((k) => k + 1) })
        .on("postgres_changes", { event: "*", schema: "public", table: "prop_proposals", filter: `tournament_id=eq.${tournamentId}` },
          () => { setRefreshKey((k) => k + 1) })
        .subscribe(),
    ]
    return () => { channels.forEach((c) => { void supabase.removeChannel(c) }) }
  }, [tournamentId])

  const openProps = props.filter((p) => p.status === "approved")
  const lockedProps = props.filter((p) => p.status === "locked")
  const resolvedProps = props.filter((p) => p.status === "resolved_yes" || p.status === "resolved_no")

  async function handleSuggest(e: React.FormEvent) {
    e.preventDefault()
    setSuggestLoading(true)
    setSuggestError(null)
    try {
      const res = await fetch("/api/admin/props/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId: suggestTournamentId,
          title: suggestTitle,
          description: suggestDesc || undefined,
          category: suggestCategory,
          targetCharacterName: suggestTarget || undefined,
          submitterName: suggestName || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        setSuggestError(data.error ?? "Failed to submit suggestion")
        return
      }
      setSuggestSuccess(true)
      setSuggestTitle("")
      setSuggestDesc("")
      setSuggestCategory("custom")
      setSuggestTarget("")
      setSuggestName("")
    } catch (err) {
      setSuggestError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setSuggestLoading(false)
    }
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

  return (
    <div>
      {/* Board header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          fontSize: 22, fontFamily: "monospace", fontWeight: 700, letterSpacing: 2,
          background: `linear-gradient(90deg, ${GOLD}, var(--ev-champagne), ${GOLD})`,
          backgroundSize: "200% auto",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}>
          🎲 PROPOSITION BETS
        </div>
        <div style={{ fontSize: 11, fontFamily: "monospace", color: "#f59e0b", marginTop: 4, letterSpacing: 1 }}>
          Side bets. Weird bets. The bets that matter.
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)", marginBottom: 20 }}>
        {SUB_TABS.map((t) => (
          <button key={t.key} onClick={() => setSubTab(t.key)} style={{
            padding: "10px 18px", background: "transparent", border: "none",
            borderBottom: subTab === t.key ? `2px solid ${GOLD}` : "2px solid transparent",
            color: subTab === t.key ? GOLD : "var(--ev-muted)",
            fontSize: 11, fontFamily: "monospace", letterSpacing: 1, cursor: "pointer",
            textTransform: "uppercase", marginBottom: -1,
          }}>
            {t.label}
            {t.key === "open" && openProps.length > 0 && (
              <span style={{ marginLeft: 6, fontSize: 9, background: "rgba(240,192,64,0.15)", padding: "1px 5px", borderRadius: 10 }}>
                {openProps.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#444", fontFamily: "monospace", fontSize: 12 }}>
          Loading props...
        </div>
      )}

      {!loading && subTab === "open" && (
        openProps.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#444", fontFamily: "monospace", fontSize: 12 }}>
            No open proposition bets yet
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 16,
          }}>
            {openProps.map((p) => (
              <PropCard
                key={p.id}
                prop={p}
                tournamentId={tournamentId}
                currentCharacterId={currentCharacterId}
                onBetPlaced={() => { setRefreshKey((k) => k + 1) }}
              />
            ))}
          </div>
        )
      )}

      {!loading && subTab === "locked" && (
        lockedProps.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#444", fontFamily: "monospace", fontSize: 12 }}>
            No locked props
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {lockedProps.map((p) => (
              <PropCard
                key={p.id}
                prop={p}
                tournamentId={tournamentId}
                currentCharacterId={currentCharacterId}
                onBetPlaced={() => { setRefreshKey((k) => k + 1) }}
              />
            ))}
          </div>
        )
      )}

      {!loading && subTab === "resolved" && (
        resolvedProps.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#444", fontFamily: "monospace", fontSize: 12 }}>
            No resolved props yet
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {resolvedProps.map((p) => (
              <PropCard
                key={p.id}
                prop={p}
                tournamentId={tournamentId}
                currentCharacterId={currentCharacterId}
                onBetPlaced={() => { setRefreshKey((k) => k + 1) }}
              />
            ))}
          </div>
        )
      )}

      {subTab === "suggest" && (
        <div style={{ maxWidth: 520 }}>
          {suggestSuccess ? (
            <div style={{
              padding: "20px 24px", background: "rgba(34,197,94,0.06)",
              border: "1px solid rgba(34,197,94,0.2)", borderRadius: 8,
              fontFamily: "monospace", color: "#22c55e", fontSize: 13,
            }}>
              ✓ Your suggestion is pending admin approval. Thanks for the prop idea!
              <div style={{ marginTop: 12 }}>
                <button onClick={() => setSuggestSuccess(false)} style={{
                  fontSize: 11, color: "var(--ev-muted)", fontFamily: "monospace",
                  background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4,
                  padding: "5px 12px", cursor: "pointer",
                }}>Suggest Another</button>
              </div>
            </div>
          ) : (
            <form onSubmit={(e) => void handleSuggest(e)}>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>WHAT'S THE BET?</label>
                <input
                  type="text" value={suggestTitle}
                  onChange={(e) => setSuggestTitle(e.target.value)}
                  placeholder="e.g. Player X wins the whole thing"
                  required style={inputStyle}
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>FLAVOR TEXT (OPTIONAL)</label>
                <textarea
                  value={suggestDesc}
                  onChange={(e) => setSuggestDesc(e.target.value)}
                  placeholder="Any extra context or notes..."
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical" as const }}
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>CATEGORY</label>
                <select value={suggestCategory} onChange={(e) => setSuggestCategory(e.target.value)}
                  style={{ ...inputStyle, cursor: "pointer" }}>
                  {VALID_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>TARGET CHARACTER NAME (OPTIONAL)</label>
                <input
                  type="text" value={suggestTarget}
                  onChange={(e) => setSuggestTarget(e.target.value)}
                  placeholder="Character name this bet is about"
                  style={inputStyle}
                />
              </div>
              {tournaments.length > 1 && (
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>TOURNAMENT</label>
                  <select value={suggestTournamentId} onChange={(e) => setSuggestTournamentId(e.target.value)}
                    style={{ ...inputStyle, cursor: "pointer" }}>
                    {tournaments.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {!currentCharacterId && (
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>YOUR NAME</label>
                  <input
                    type="text" value={suggestName}
                    onChange={(e) => setSuggestName(e.target.value)}
                    placeholder="Your in-game name"
                    style={inputStyle}
                  />
                </div>
              )}
              {suggestError && (
                <div style={{ color: "#c0392b", fontSize: 12, fontFamily: "monospace", marginBottom: 12 }}>
                  {suggestError}
                </div>
              )}
              <button type="submit" disabled={suggestLoading || !suggestTitle.trim()} style={{
                padding: "9px 24px",
                background: suggestLoading || !suggestTitle.trim() ? "rgba(240,192,64,0.15)" : GOLD,
                border: "none", borderRadius: 4,
                color: suggestLoading || !suggestTitle.trim() ? "var(--ev-muted)" : "var(--ev-bg)",
                fontSize: 12, fontWeight: 600,
                cursor: suggestLoading || !suggestTitle.trim() ? "not-allowed" : "pointer",
                fontFamily: "monospace",
              }}>{suggestLoading ? "Submitting..." : "Submit Suggestion"}</button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
