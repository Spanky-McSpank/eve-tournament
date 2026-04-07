"use client"

import Image from "next/image"
import { useState } from "react"
import type { BracketWithEntrants, Entrant } from "@/lib/bracket"

const GOLD = "var(--ev-gold-light)"
const ZKILL_RE = /^https?:\/\/(www\.)?zkillboard\.com\/kill\/\d+\/?$/

function CapsuleerSilhouette() {
  return (
    <svg width={56} height={56} viewBox="0 0 56 56" fill="none">
      <circle cx="28" cy="28" r="28" fill="var(--ev-steel)" />
      <circle cx="28" cy="21" r="10" fill="var(--ev-card2)" />
      <ellipse cx="28" cy="45" rx="14" ry="11" fill="var(--ev-card2)" />
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
      borderRadius: 10, cursor: "pointer",
      opacity: dimmed ? 0.35 : 1,
      transition: "all 0.15s",
    }}>
      <div style={{ borderRadius: "50%", overflow: "hidden", width: 56, height: 56 }}>
        {entrant.portrait_url ? (
          <Image src={entrant.portrait_url} alt={entrant.character_name} width={56} height={56}
            style={{ borderRadius: "50%", objectFit: "cover" }} />
        ) : <CapsuleerSilhouette />}
      </div>
      <div style={{ color: selected ? GOLD : "var(--ev-text)", fontWeight: selected ? 600 : 400, fontSize: 13, textAlign: "center" }}>
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
  // Auto-select if only one entrant is available
  const [winnerId, setWinnerId] = useState<string | null>(
    match.entrant1 && !match.entrant2 ? match.entrant1.id : null
  )
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
        background: "var(--ev-card)",
        border: "1px solid var(--ev-border2)",
        borderRadius: 10, padding: 24,
        width: "100%", maxWidth: 440, margin: "0 16px",
      }}>
        <h2 style={{ color: GOLD, fontSize: 14, fontFamily: "monospace", marginBottom: 20, letterSpacing: 2 }}>
          RECORD MATCH RESULT
        </h2>

        {match.entrant1 && !match.entrant2 && (
          <div style={{ marginBottom: 12, padding: "8px 12px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 6, fontSize: 11, color: "#f59e0b", fontFamily: "monospace" }}>
            ⚠ No opponent set — {match.entrant1.character_name} will advance by default
          </div>
        )}
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
          <label style={{ display: "block", color: "var(--ev-muted)", fontSize: 10, fontFamily: "monospace", marginBottom: 6, letterSpacing: 1 }}>
            ZKILLBOARD URL (OPTIONAL)
          </label>
          <input
            type="text"
            value={killmailUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://zkillboard.com/kill/..."
            style={{
              width: "100%", padding: "8px 10px",
              background: "var(--ev-card2)",
              border: `1px solid ${urlError ? "#c0392b" : "rgba(255,255,255,0.12)"}`,
              borderRadius: 4, color: "var(--ev-text)", fontSize: 12,
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
            color: "var(--ev-muted)", fontSize: 12, cursor: "pointer", fontFamily: "monospace",
          }}>Cancel</button>
          <button
            onClick={handleConfirm}
            disabled={!winnerId || loading}
            style={{
              padding: "7px 16px", minWidth: 130,
              background: winnerId && !loading ? GOLD : "rgba(240,192,64,0.15)",
              border: "none", borderRadius: 4,
              color: winnerId && !loading ? "var(--ev-bg)" : "var(--ev-muted)",
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
