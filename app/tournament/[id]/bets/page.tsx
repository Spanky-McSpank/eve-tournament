"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { createSupabaseClient } from "@/lib/supabase"
import type { BracketWithEntrants } from "@/lib/bracket"
import OddsCard from "@/components/bookie/OddsCard"
import RecordBoard from "@/components/bookie/RecordBoard"

const GOLD = "#f0c040"
type Tab = "matches" | "records"

interface Tournament { id: string; name: string; status: string }

export default function BetsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [openMatches, setOpenMatches] = useState<BracketWithEntrants[]>([])
  const [currentCharacterId, setCurrentCharacterId] = useState<number | undefined>(undefined)
  const [tab, setTab] = useState<Tab>("matches")
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    void (async () => {
      const [tRes, meRes, bRes] = await Promise.all([
        fetch(`/api/tournament//info`),
        fetch("/api/auth/me"),
        fetch(`/api/tournament//bracket`),
      ])
      if (tRes.ok) {
        const d = await tRes.json() as { tournament: Tournament }
        setTournament(d.tournament)
      }
      if (meRes.ok) {
        const d = await meRes.json() as { character?: { character_id: number } }
        if (d.character) setCurrentCharacterId(d.character.character_id)
      }
      if (bRes.ok) {
        const d = await bRes.json() as { brackets: BracketWithEntrants[] }
        setOpenMatches(deriveOpenMatches(d.brackets))
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    const supabase = createSupabaseClient()
    const channel = supabase
      .channel(`bets-page-`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "bets",
        filter: `tournament_id=eq.`,
      }, () => { setRefreshKey((k) => k + 1) })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

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
    }}>
      <div style={{
        borderBottom: "1px solid rgba(240,192,64,0.12)",
        padding: "16px 24px",
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
      }}>
        <h1 style={{ color: GOLD, fontSize: 18, fontFamily: "monospace", fontWeight: 600, margin: 0 }}>
          {tournament?.name ?? "…"} — Bookie Board 🎲
        </h1>
        <div style={{ marginLeft: "auto" }}>
          <Link href={`/tournament//bracket`} style={{
            fontSize: 12, color: "#c8c8c8", textDecoration: "none",
            padding: "5px 12px", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 4, fontFamily: "monospace",
          }}>⚔ View Bracket</Link>
        </div>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "0 24px" }}>
        {(["matches", "records"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "12px 20px", background: "transparent", border: "none",
            borderBottom: tab === t ? `2px solid ` : "2px solid transparent",
            color: tab === t ? GOLD : "#666",
            fontSize: 12, fontFamily: "monospace", letterSpacing: 1, cursor: "pointer",
            textTransform: "uppercase", marginBottom: -1,
          }}>
            {t === "matches" ? "Open Matches" : "Records"}
          </button>
        ))}
      </div>

      <div style={{ padding: 24 }}>
        {tab === "matches" && (
          openMatches.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#444", fontFamily: "monospace", fontSize: 13 }}>
              No open matches — check the bracket for results
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 16, maxWidth: 1100,
            }}>
              {openMatches.map((match) => (
                <OddsCard
                  key={match.id}
                  match={match}
                  tournamentId={id}
                  currentCharacterId={currentCharacterId}
                  onBetPlaced={() => setRefreshKey((k) => k + 1)}
                  refreshKey={refreshKey}
                />
              ))}
            </div>
          )
        )}
        {tab === "records" && <RecordBoard tournamentId={id} refreshKey={refreshKey} />}
      </div>
    </div>
  )
}

function deriveOpenMatches(brackets: BracketWithEntrants[]): BracketWithEntrants[] {
  const incomplete = brackets.filter((b) => !b.winner && !b.is_bye && b.entrant1 && b.entrant2)
  if (incomplete.length === 0) return []
  const maxRound = Math.max(...incomplete.map((b) => b.round))
  return incomplete
    .filter((b) => b.round === maxRound)
    .sort((a, b) => a.match_number - b.match_number)
}