"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"

const GOLD = "#f0c040"

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
      // Optimistic update
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
      // Increment count in tournament list
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

  const registrationTournaments = tournaments.filter((t) => t.status === "registration")

  const cardStyle: React.CSSProperties = {
    background: "#0d0d1a",
    border: "1px solid rgba(240,192,64,0.12)",
    borderRadius: 6,
    padding: 24,
    marginBottom: 24,
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 12px",
    background: "#080810", border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 4, color: "#c8c8c8", fontSize: 13, fontFamily: "monospace",
    outline: "none", boxSizing: "border-box",
  }

  const labelStyle: React.CSSProperties = {
    display: "block", color: "#666", fontSize: 10,
    fontFamily: "monospace", letterSpacing: 1, marginBottom: 6,
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0f",
      backgroundImage: [
        "linear-gradient(rgba(240,192,64,0.03) 1px, transparent 1px)",
        "linear-gradient(90deg, rgba(240,192,64,0.03) 1px, transparent 1px)",
      ].join(", "),
      backgroundSize: "32px 32px",
      color: "#c8c8c8",
      fontFamily: "system-ui, sans-serif",
      padding: 24,
    }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <h1 style={{ color: GOLD, fontSize: 22, fontFamily: "monospace", fontWeight: 700, margin: 0 }}>
            ADMIN PANEL
          </h1>
          <Link href="/" style={{ marginLeft: "auto", fontSize: 12, color: "#555", fontFamily: "monospace", textDecoration: "none" }}>
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
                    <button
                      key={n}
                      type="button"
                      onClick={() => setCreateCount(n)}
                      style={{
                        padding: "8px 20px",
                        background: createCount === n ? GOLD : "transparent",
                        border: `1px solid ${createCount === n ? GOLD : "rgba(255,255,255,0.12)"}`,
                        borderRadius: n === 16 ? "4px 0 0 4px" : n === 64 ? "0 4px 4px 0" : "0",
                        color: createCount === n ? "#0a0a0f" : "#888",
                        fontSize: 13, fontWeight: createCount === n ? 700 : 400,
                        cursor: "pointer", fontFamily: "monospace",
                      }}
                    >{n}</button>
                  ))}
                </div>
              </div>
            </div>
            {createError && (
              <div style={{ color: "#c0392b", fontSize: 12, fontFamily: "monospace", marginTop: 12 }}>
                {createError}
              </div>
            )}
            <button
              type="submit"
              disabled={createLoading || !createName.trim()}
              style={{
                marginTop: 16, padding: "8px 24px",
                background: createLoading || !createName.trim() ? "rgba(240,192,64,0.15)" : GOLD,
                border: "none", borderRadius: 4,
                color: createLoading || !createName.trim() ? "#555" : "#0a0a0f",
                fontSize: 12, fontWeight: 600, cursor: createLoading || !createName.trim() ? "not-allowed" : "pointer",
                fontFamily: "monospace",
              }}
            >
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
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="Exact character name"
                  required
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 2, minWidth: 200 }}>
                <label style={labelStyle}>TOURNAMENT</label>
                <select
                  value={addTournamentId}
                  onChange={(e) => setAddTournamentId(e.target.value)}
                  required
                  style={{ ...inputStyle, cursor: "pointer" }}
                >
                  <option value="">Select tournament...</option>
                  {registrationTournaments.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.currentEntrants}/{t.entrant_count})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {addError && (
              <div style={{ color: "#c0392b", fontSize: 12, fontFamily: "monospace", marginTop: 12 }}>
                {addError}
              </div>
            )}
            {addedEntrant && (
              <div style={{
                marginTop: 12, display: "flex", alignItems: "center", gap: 12,
                padding: "10px 14px", background: "rgba(34,197,94,0.06)",
                border: "1px solid rgba(34,197,94,0.2)", borderRadius: 4,
              }}>
                {addedEntrant.portrait_url && (
                  <div style={{ borderRadius: "50%", overflow: "hidden", width: 36, height: 36, flexShrink: 0 }}>
                    <Image src={addedEntrant.portrait_url} alt={addedEntrant.character_name} width={36} height={36}
                      style={{ borderRadius: "50%", objectFit: "cover" }} />
                  </div>
                )}
                <div>
                  <div style={{ color: "#22c55e", fontSize: 13, fontWeight: 600 }}>Added: {addedEntrant.character_name}</div>
                  {addedEntrant.corporation_name && (
                    <div style={{ color: "#555", fontSize: 11 }}>{addedEntrant.corporation_name}</div>
                  )}
                </div>
              </div>
            )}
            <button
              type="submit"
              disabled={addLoading || !addName.trim() || !addTournamentId}
              style={{
                marginTop: 16, padding: "8px 24px",
                background: addLoading || !addName.trim() || !addTournamentId ? "rgba(240,192,64,0.15)" : GOLD,
                border: "none", borderRadius: 4,
                color: addLoading || !addName.trim() || !addTournamentId ? "#555" : "#0a0a0f",
                fontSize: 12, fontWeight: 600,
                cursor: addLoading || !addName.trim() || !addTournamentId ? "not-allowed" : "pointer",
                fontFamily: "monospace",
              }}
            >
              {addLoading ? "Searching..." : "Search & Add"}
            </button>
          </form>
        </div>

        {/* Tournament List */}
        <div style={cardStyle}>
          <h2 style={{ color: GOLD, fontSize: 12, fontFamily: "monospace", letterSpacing: 2, marginBottom: 20, fontWeight: 600 }}>
            TOURNAMENTS
          </h2>
          {generateError && (
            <div style={{ color: "#c0392b", fontSize: 12, fontFamily: "monospace", marginBottom: 12 }}>
              {generateError}
            </div>
          )}
          {tournaments.length === 0 ? (
            <div style={{ color: "#444", fontFamily: "monospace", fontSize: 12, padding: "20px 0" }}>
              No tournaments yet
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Name", "Status", "Entrants", "Created", "Actions"].map((h) => (
                    <th key={h} style={{
                      textAlign: "left", padding: "6px 12px",
                      fontSize: 10, fontFamily: "monospace", letterSpacing: 1,
                      color: "#555", fontWeight: 600,
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
                      <td style={{ padding: "10px 12px", fontSize: 13, color: "#c8c8c8" }}>{t.name}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{
                          fontSize: 10, fontFamily: "monospace", letterSpacing: 1,
                          padding: "2px 8px", border: `1px solid ${STATUS_COLOR[t.status] ?? "#555"}`,
                          borderRadius: 3, color: STATUS_COLOR[t.status] ?? "#555",
                          textTransform: "uppercase",
                        }}>{t.status}</span>
                      </td>
                      <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 12, color: "#888" }}>
                        {t.currentEntrants} / {t.entrant_count}
                      </td>
                      <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 11, color: "#555" }}>
                        {new Date(t.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <Link href={`/tournament/${t.id}`} style={{
                            fontSize: 11, color: "#c8c8c8", textDecoration: "none",
                            padding: "3px 10px", border: "1px solid rgba(255,255,255,0.12)",
                            borderRadius: 3, fontFamily: "monospace",
                          }}>View</Link>
                          {t.status === "registration" && (
                            <button
                              onClick={() => handleGenerate(t.id)}
                              disabled={!canGenerate || generateLoadingId === t.id}
                              title={!canGenerate ? "Requires at least 4 entrants" : undefined}
                              style={{
                                fontSize: 11, fontFamily: "monospace",
                                padding: "3px 10px",
                                background: "transparent",
                                border: `1px solid ${canGenerate ? GOLD : "rgba(255,255,255,0.08)"}`,
                                borderRadius: 3,
                                color: canGenerate ? GOLD : "#444",
                                cursor: canGenerate ? "pointer" : "not-allowed",
                              }}
                            >
                              {generateLoadingId === t.id ? "Generating..." : "Generate Bracket & Start"}
                            </button>
                          )}
                          {t.status === "active" && (
                            <Link href={`/tournament/${t.id}/bracket`} style={{
                              fontSize: 11, color: GOLD, textDecoration: "none",
                              padding: "3px 10px", border: `1px solid rgba(240,192,64,0.3)`,
                              borderRadius: 3, fontFamily: "monospace",
                            }}>View Bracket</Link>
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
      </div>
    </div>
  )
}
