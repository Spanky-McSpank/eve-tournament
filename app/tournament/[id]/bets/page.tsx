"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { createSupabaseClient } from "@/lib/supabase"
import type { BracketWithEntrants } from "@/lib/bracket"
import { formatISK } from "@/lib/utils"
import OddsCard from "@/components/bookie/OddsCard"
import AdminBackButton from "@/components/admin/AdminBackButton"
import RecordBoard from "@/components/bookie/RecordBoard"
import SettlementBoard from "@/components/bookie/SettlementBoard"

const GOLD = "var(--ev-gold-light)"
type Tab = "board" | "settlements" | "records"

interface Tournament { id: string; name: string; status: string }
interface MeResponse {
  character?: { character_id: number; character_name: string }
  isAuthenticated: boolean
  isAdmin: boolean
}
interface PersonalSummary {
  openProposals: number
  matchedBets: number
  netPosition: number
}

export default function BetsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [openMatches, setOpenMatches] = useState<BracketWithEntrants[]>([])
  const [me, setMe] = useState<MeResponse>({ isAuthenticated: false, isAdmin: false })
  const [tab, setTab] = useState<Tab>("board")
  const [refreshKey, setRefreshKey] = useState(0)
  const [summary, setSummary] = useState<PersonalSummary | null>(null)

  useEffect(() => {
    void (async () => {
      const [tRes, meRes, bRes] = await Promise.all([
        fetch(`/api/tournament/${id}/info`),
        fetch("/api/auth/me"),
        fetch(`/api/tournament/${id}/bracket`),
      ])
      if (tRes.ok) {
        const d = await tRes.json() as { tournament: Tournament }
        setTournament(d.tournament)
      }
      if (meRes.ok) {
        const d = await meRes.json() as MeResponse
        setMe(d)
      }
      if (bRes.ok) {
        const d = await bRes.json() as { brackets: BracketWithEntrants[] }
        setOpenMatches(deriveOpenMatches(d.brackets))
      }
    })()
  }, [id])

  // Fetch personal summary once we know the character
  useEffect(() => {
    if (!me.character) return
    const charId = me.character.character_id
    void (async () => {
      const [propRes, recRes] = await Promise.all([
        fetch(`/api/tournament/${id}/proposals`),
        fetch(`/api/tournament/${id}/bettor-records`),
      ])
      let openProposals = 0
      if (propRes.ok) {
        const d = await propRes.json() as { proposals: Array<{ proposer_character_id: number }> }
        openProposals = (d.proposals ?? []).filter((p) => p.proposer_character_id === charId).length
      }
      let netPosition = 0
      if (recRes.ok) {
        const d = await recRes.json() as { records: Array<{ character_id: number; total_isk_won: number; total_isk_lost: number }> }
        const myRecord = (d.records ?? []).find((r) => r.character_id === charId)
        if (myRecord) netPosition = (myRecord.total_isk_won ?? 0) - (myRecord.total_isk_lost ?? 0)
      }
      setSummary({ openProposals, matchedBets: 0, netPosition })
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, me.character?.character_id])

  // Realtime for proposals and bracket changes
  useEffect(() => {
    const supabase = createSupabaseClient()
    const channels = [
      supabase
        .channel(`bets-proposals-${id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "bet_proposals", filter: `tournament_id=eq.${id}` },
          () => { setRefreshKey((k) => k + 1) })
        .subscribe(),
      supabase
        .channel(`bets-matches-${id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "bet_matches", filter: `tournament_id=eq.${id}` },
          () => { setRefreshKey((k) => k + 1) })
        .subscribe(),
    ]
    return () => { channels.forEach((c) => { void supabase.removeChannel(c) }) }
  }, [id])

  const TABS: { key: Tab; label: string }[] = [
    { key: "board", label: "Betting Board" },
    { key: "settlements", label: "Settlements" },
    { key: "records", label: "Records" },
  ]

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
      {/* Page header */}
      <div style={{
        borderBottom: "0.5px solid var(--ev-border2)",
        padding: "16px 24px",
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
      }}>
        <h1 style={{ color: GOLD, fontSize: 18, fontFamily: "monospace", fontWeight: 600, margin: 0 }}>
          {tournament?.name ?? "…"} — Bookie Board 🎲
        </h1>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          {me.isAdmin && <AdminBackButton />}
          <Link href={`/tournament/${id}/bracket`} style={{
            fontSize: 12, color: "var(--ev-text)", textDecoration: "none",
            padding: "5px 12px", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 4, fontFamily: "monospace",
          }}>⚔ View Bracket</Link>
        </div>
      </div>

      {/* Personal summary bar */}
      {me.isAuthenticated && summary && (
        <div style={{
          padding: "10px 24px",
          background: "rgba(240,192,64,0.03)",
          borderBottom: "0.5px solid var(--ev-border2)",
          display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center",
        }}>
          <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--ev-muted)" }}>
            Your open proposals: <span style={{ color: GOLD }}>{summary.openProposals}</span>
          </span>
          <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--ev-muted)" }}>
            Net position:{" "}
            <span style={{ color: summary.netPosition >= 0 ? "#27ae60" : "#c0392b" }}>
              {summary.netPosition >= 0 ? "+" : ""}{formatISK(summary.netPosition)}
            </span>
          </span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "0 24px" }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: "12px 20px", background: "transparent", border: "none",
            borderBottom: tab === t.key ? `2px solid ${GOLD}` : "2px solid transparent",
            color: tab === t.key ? GOLD : "var(--ev-muted)",
            fontSize: 12, fontFamily: "monospace", letterSpacing: 1, cursor: "pointer",
            textTransform: "uppercase", marginBottom: -1,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: 24 }}>
        {tab === "board" && (
          openMatches.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#444", fontFamily: "monospace", fontSize: 13 }}>
              No open matches — check the bracket for results
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: 16, maxWidth: 1100,
            }}>
              {openMatches.map((match) => (
                <OddsCard
                  key={match.id}
                  match={match}
                  tournamentId={id}
                  currentCharacterId={me.character?.character_id}
                  onBetPlaced={() => setRefreshKey((k) => k + 1)}
                  refreshKey={refreshKey}
                />
              ))}
            </div>
          )
        )}
        {tab === "settlements" && (
          <SettlementBoard
            tournamentId={id}
            isAdmin={me.isAdmin}
            refreshKey={refreshKey}
          />
        )}
        {tab === "records" && (
          <RecordBoard tournamentId={id} refreshKey={refreshKey} />
        )}
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

