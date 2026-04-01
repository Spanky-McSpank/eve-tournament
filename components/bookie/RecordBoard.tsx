"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import { createSupabaseClient } from "@/lib/supabase"
import { formatISK } from "@/lib/utils"

const GOLD = "var(--ev-gold-light)"

interface BettorRecord {
  character_id: number
  character_name: string
  total_bets: number
  bets_won: number
  bets_lost: number
  total_isk_wagered: number
  total_isk_won: number
  total_isk_lost: number
}

type SortCol = "name" | "won" | "lost" | "winPct" | "wagered" | "iskWon" | "iskLost" | "net"
type SortDir = "asc" | "desc"

function winPct(r: BettorRecord) {
  return r.total_bets > 0 ? r.bets_won / r.total_bets : 0
}
function net(r: BettorRecord) {
  return r.total_isk_won - r.total_isk_lost
}

function WinPctCell({ value }: { value: number }) {
  const pct = value * 100
  const color = pct >= 60 ? "#27ae60" : pct >= 40 ? GOLD : "#c0392b"
  return <span style={{ color, fontFamily: "monospace" }}>{pct.toFixed(1)}%</span>
}

function ColHeader({
  label, col, sortCol, sortDir, onSort,
}: {
  label: string; col: SortCol; sortCol: SortCol; sortDir: SortDir; onSort: (c: SortCol) => void
}) {
  const active = sortCol === col
  return (
    <th
      onClick={() => onSort(col)}
      style={{
        padding: "8px 12px", textAlign: "right", cursor: "pointer",
        fontFamily: "monospace", fontSize: 10, letterSpacing: 1, fontWeight: 600,
        color: active ? GOLD : "var(--ev-muted)",
        borderBottom: `1px solid ${active ? "rgba(240,192,64,0.3)" : "rgba(255,255,255,0.06)"}`,
        whiteSpace: "nowrap", userSelect: "none",
      }}
    >
      {label.toUpperCase()}{active ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
    </th>
  )
}

export interface RecordBoardProps {
  tournamentId: string
  refreshKey?: number
}

export default function RecordBoard({ tournamentId, refreshKey }: RecordBoardProps) {
  const [records, setRecords] = useState<BettorRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [sortCol, setSortCol] = useState<SortCol>("winPct")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  async function fetchRecords() {
    try {
      const res = await fetch(`/api/tournament/${tournamentId}/bettor-records`)
      if (res.ok) {
        const data = await res.json() as { records: BettorRecord[] }
        setRecords(data.records ?? [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchRecords()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, refreshKey])

  useEffect(() => {
    const supabase = createSupabaseClient()
    const channel = supabase
      .channel(`records-bets-${tournamentId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "bets",
        filter: `tournament_id=eq.${tournamentId}`,
      }, () => { void fetchRecords() })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId])

  function handleSort(col: SortCol) {
    if (col === sortCol) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"))
    } else {
      setSortCol(col)
      setSortDir("desc")
    }
  }

  const sorted = [...records].sort((a, b) => {
    let diff = 0
    switch (sortCol) {
      case "name": diff = a.character_name.localeCompare(b.character_name); break
      case "won": diff = a.bets_won - b.bets_won; break
      case "lost": diff = a.bets_lost - b.bets_lost; break
      case "winPct": diff = winPct(a) - winPct(b); break
      case "wagered": diff = a.total_isk_wagered - b.total_isk_wagered; break
      case "iskWon": diff = a.total_isk_won - b.total_isk_won; break
      case "iskLost": diff = a.total_isk_lost - b.total_isk_lost; break
      case "net": diff = net(a) - net(b); break
    }
    return sortDir === "desc" ? -diff : diff
  })

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#444", fontFamily: "monospace", fontSize: 12 }}>
        Loading records...
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#444", fontFamily: "monospace", fontSize: 13 }}>
        No bets recorded yet
      </div>
    )
  }

  const nameTh = (
    <th
      onClick={() => handleSort("name")}
      style={{
        padding: "8px 12px", textAlign: "left", cursor: "pointer",
        fontFamily: "monospace", fontSize: 10, letterSpacing: 1, fontWeight: 600,
        color: sortCol === "name" ? GOLD : "var(--ev-muted)",
        borderBottom: `1px solid ${sortCol === "name" ? "rgba(240,192,64,0.3)" : "rgba(255,255,255,0.06)"}`,
        userSelect: "none",
      }}
    >
      NAME{sortCol === "name" ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
    </th>
  )

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
        <thead>
          <tr>
            <th style={{ width: 44, padding: "8px 8px 8px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }} />
            {nameTh}
            <ColHeader label="W" col="won" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
            <ColHeader label="L" col="lost" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
            <ColHeader label="Win%" col="winPct" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
            <ColHeader label="Wagered" col="wagered" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
            <ColHeader label="Won" col="iskWon" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
            <ColHeader label="Lost" col="iskLost" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
            <ColHeader label="Net" col="net" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => {
            const netVal = net(r)
            const portraitUrl = `https://images.evetech.net/characters/${r.character_id}/portrait?size=32`
            return (
              <tr key={r.character_id} style={{
                background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
              }}>
                <td style={{ padding: "8px 4px 8px 16px" }}>
                  <div style={{ borderRadius: "50%", overflow: "hidden", width: 32, height: 32 }}>
                    <Image src={portraitUrl} alt={r.character_name} width={32} height={32}
                      style={{ borderRadius: "50%", objectFit: "cover" }} />
                  </div>
                </td>
                <td style={{ padding: "8px 12px", color: "var(--ev-text)", fontSize: 13 }}>
                  {r.character_name}
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace", fontSize: 12, color: "#27ae60" }}>
                  {r.bets_won}
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace", fontSize: 12, color: "#c0392b" }}>
                  {r.bets_lost}
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right" }}>
                  <WinPctCell value={winPct(r)} />
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace", fontSize: 12, color: "var(--ev-muted)" }}>
                  {formatISK(r.total_isk_wagered)}
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace", fontSize: 12, color: "#27ae60" }}>
                  {formatISK(r.total_isk_won)}
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace", fontSize: 12, color: "#c0392b" }}>
                  {formatISK(r.total_isk_lost)}
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace", fontSize: 12,
                  color: netVal >= 0 ? "#27ae60" : "#c0392b" }}>
                  {netVal >= 0 ? "+" : ""}{formatISK(netVal)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
