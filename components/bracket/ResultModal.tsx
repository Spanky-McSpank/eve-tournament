"use client"

import Image from "next/image"
import { useState } from "react"
import type { BracketWithEntrants, Entrant } from "@/lib/bracket"

const GOLD = "#f0c040"
const ZKILL_RE = /^https?:\/\/(www\.)?zkillboard\.com\/kill\/\d+\/?$/

function CapsuleerSilhouette() {
  return (
    <svg width={56} height={56} viewBox="0 0 56 56" fill="none">
      <circle cx="28" cy="28" r="28" fill="#1a1a2e" />
      <circle cx="28" cy="21" r="10" fill="#2a2a3e" />
      <ellipse cx="28" cy="45" rx="14" ry="11" fill="#2a2a3e" />
    </svg>
  )
}

function FighterCard({
  entrant,
  selected,
  dimmed,
  onSelect,
}: {
  entrant: Entrant
  selected: boolean
  dimmed: boolean
  onSelect: () => void
}) {
  return (
    <button onClick={onSelect} style={{
      flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
      gap: 8, padding: "16px 12px",
      background: selected ? "rgba(240,192,64,0.08)" : "rgba(255,255,255,0.02)",
      border: `2px solid ${selected ? GOLD : "rgba(255,255,255,0.1)"}`,
      borderRadius: 6, cursor: "pointer",
      opacity: dimmed ? 0.35 : 1,
      transition: "all 0.15s",
    }}>
      <div style={{ borderRadius: "50%", overflow: "hidden", width: 56, height: 56 }}>
        {entrant.portrait_url ? (
          <Image src={entrant.portrait_url} alt={entrant.character_name} width={56} height={56}
            style={{ borderRadius: "50%", objectFit: "cover" }} />
        ) : <CapsuleerSilhouette />}
      </div>
      <div style={{ color: selected ? GOLD : "#c8c8c8", fontWeight: selected ? 600 : 400, fontSize: 13, textAlign: "center" }}>
        {entrant.character_name}
      </div>
    </button>
  )
}

export interface ResultModalProps {
  match: BracketWithEntrants
  onClose: () => void
  onConfirm: () => void
}

export default function ResultModal({ match, onClose, onConfirm }: ResultModalProps) {
  const [winnerId, setWinnerId] = useState<string | null>(null)
  const [killmailUrl, setKillmailUrl] = useState("")
  const [urlError, setUrlError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleUrlChange(val: string) {
    setKillmailUrl(val)
    setUrlError(val.length > 0 && !ZKILL_RE.test(val))
  }

  async function handleConfirm() {
    if (!winnerId || (killmailUrl && urlError)) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/tournament/${match.tournament_id}/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bracketId: match.id,
          winnerId,
          ...(killmailUrl ? { killmailUrl } : {}),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        setError(data.error ?? "Request failed")
        return
      }
      onConfirm()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.82)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div style={{
        background: "#0d0d1a",
        border: "1px solid rgba(240,192,64,0.22)",
        borderRadius: 8, padding: 24,
        width: "100%", maxWidth: 440, margin: "0 16px",
      }}>
        <h2 style={{ color: GOLD, fontSize: 14, fontFamily: "monospace", marginBottom: 20, letterSpacing: 2 }}>
          RECORD MATCH RESULT
        </h2>

        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          {match.entrant1 && (
            <FighterCard entrant={match.entrant1} selected={winnerId === match.entrant1.id}
              dimmed={Boolean(winnerId && winnerId !== match.entrant1.id)} onSelect={() => setWinnerId(match.entrant1!.id)} />
          )}
          {match.entrant2 && (
            <FighterCard entrant={match.entrant2} selected={winnerId === match.entrant2.id}
              dimmed={Boolean(winnerId && winnerId !== match.entrant2.id)} onSelect={() => setWinnerId(match.entrant2!.id)} />
          )}
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", color: "#666", fontSize: 10, fontFamily: "monospace", marginBottom: 6, letterSpacing: 1 }}>
            ZKILLBOARD URL (OPTIONAL)
          </label>
          <input
            type="text"
            value={killmailUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://zkillboard.com/kill/..."
            style={{
              width: "100%", padding: "8px 10px",
              background: "#080810",
              border: `1px solid ${urlError ? "#c0392b" : "rgba(255,255,255,0.12)"}`,
              borderRadius: 4, color: "#c8c8c8", fontSize: 12,
              fontFamily: "monospace", outline: "none", boxSizing: "border-box",
            }}
          />
          {urlError && (
            <div style={{ color: "#c0392b", fontSize: 11, marginTop: 4, fontFamily: "monospace" }}>
              Invalid zKillboard URL
            </div>
          )}
        </div>

        {error && (
          <div style={{
            color: "#c0392b", fontSize: 12, fontFamily: "monospace",
            marginBottom: 16, padding: "8px 10px",
            background: "rgba(192,57,43,0.08)",
            border: "1px solid rgba(192,57,43,0.25)", borderRadius: 4,
          }}>{error}</div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "7px 16px", background: "transparent",
            border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4,
            color: "#666", fontSize: 12, cursor: "pointer", fontFamily: "monospace",
          }}>Cancel</button>
          <button
            onClick={handleConfirm}
            disabled={!winnerId || loading}
            style={{
              padding: "7px 16px", minWidth: 130,
              background: winnerId && !loading ? GOLD : "rgba(240,192,64,0.15)",
              border: "none", borderRadius: 4,
              color: winnerId && !loading ? "#0a0a0f" : "#555",
              fontSize: 12, fontWeight: 600,
              cursor: winnerId && !loading ? "pointer" : "not-allowed",
              fontFamily: "monospace", transition: "all 0.15s",
            }}
          >
            {loading ? "···" : "Confirm Result"}
          </button>
        </div>
      </div>
    </div>
  )
}
