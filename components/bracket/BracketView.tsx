"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { BracketWithEntrants } from "@/lib/bracket"
import { createSupabaseClient } from "@/lib/supabase"
import BracketColumn from "./BracketColumn"
import BracketConnector from "./BracketConnector"

export interface BracketViewProps {
  initialBrackets: BracketWithEntrants[]
  tournamentId: string
  isAdmin: boolean
}

export default function BracketView({ initialBrackets, tournamentId, isAdmin }: BracketViewProps) {
  const [brackets, setBrackets] = useState<BracketWithEntrants[]>(initialBrackets)
  const [flashedIds, setFlashedIds] = useState<Set<string>>(new Set())
  const supabase = useRef(createSupabaseClient()).current
  const prevBrackets = useRef<BracketWithEntrants[]>(initialBrackets)

  async function refetch() {
    try {
      const res = await fetch(`/api/tournament/${tournamentId}/bracket`)
      if (!res.ok) return
      const data = await res.json() as { brackets: BracketWithEntrants[] }
      const next = data.brackets

      // Detect changed matches (newly completed)
      const prevMap = new Map(prevBrackets.current.map((b) => [b.id, b]))
      const changed = next
        .filter((b) => b.winner && !prevMap.get(b.id)?.winner)
        .map((b) => b.id)

      setBrackets(next)
      prevBrackets.current = next

      if (changed.length > 0) {
        setFlashedIds(new Set(changed))
        setTimeout(() => setFlashedIds(new Set()), 900)
      }
    } catch {
      // silently ignore
    }
  }

  useEffect(() => {
    const channel = supabase
      .channel(`brackets-${tournamentId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "brackets",
        filter: `tournament_id=eq.${tournamentId}`,
      }, () => { void refetch() })
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId])

  const roundGroups = useMemo(() => {
    const maxRound = brackets.reduce((max, b) => Math.max(max, b.round), 0)
    const groups: BracketWithEntrants[][] = []
    for (let r = 1; r <= maxRound; r++) {
      groups.push(
        brackets
          .filter((b) => b.round === r)
          .sort((a, b) => a.match_number - b.match_number)
      )
    }
    return groups
  }, [brackets])

  const totalRounds = roundGroups.length
  const maxMatches = roundGroups[0]?.length ?? 1
  const containerHeight = maxMatches * 116 + 48

  if (roundGroups.length === 0) {
    return (
      <div style={{ color: "#555", fontFamily: "monospace", fontSize: 12, padding: 24 }}>
        No bracket data available.
      </div>
    )
  }

  return (
    <>
      <style>{`
        @keyframes eveFlash {
          0%   { box-shadow: 0 0 0 0 rgba(240,192,64,0.7); }
          40%  { box-shadow: 0 0 0 8px rgba(240,192,64,0.3); }
          100% { box-shadow: 0 0 0 0 rgba(240,192,64,0); }
        }
        .eve-flash { animation: eveFlash 0.9s ease-out; }
      `}</style>

      <div style={{ overflowX: "auto", overflowY: "visible", paddingBottom: 24 }}>
        <div style={{
          display: "flex",
          alignItems: "stretch",
          height: containerHeight,
          padding: "0 24px",
          gap: 0,
          minWidth: "max-content",
        }}>
          {roundGroups.map((roundMatches, idx) => (
            <div key={idx + 1} style={{ display: "flex", alignItems: "stretch" }}>
              <BracketColumn
                matches={roundMatches}
                round={idx + 1}
                totalRounds={totalRounds}
                isAdmin={isAdmin}
                flashedIds={flashedIds}
                onResultEntered={() => { void refetch() }}
              />
              {idx < roundGroups.length - 1 && (
                <BracketConnector matchCount={roundMatches.length} />
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
