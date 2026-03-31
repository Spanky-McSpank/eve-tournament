import { cookies } from "next/headers"
import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { createSupabaseServerClient } from "@/lib/supabase"
import { getTournamentBracket } from "@/lib/bracket"
import BracketView from "@/components/bracket/BracketView"

interface EveSession {
  character_id: number
  expires_at: number
}

interface Tournament {
  id: string
  name: string
  status: "registration" | "active" | "complete"
  entrant_count: number
}

export default async function BracketPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const cookieStore = await cookies()

  // Determine admin status
  let isAdmin = false
  const rawSession = cookieStore.get("eve_session")?.value
  if (rawSession) {
    try {
      const session = JSON.parse(rawSession) as EveSession
      if (Date.now() <= session.expires_at) {
        const adminIds = (process.env.ADMIN_CHARACTER_IDS ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
        isAdmin = adminIds.includes(String(session.character_id))
      }
    } catch {
      // ignore invalid cookie
    }
  }

  // Fetch tournament
  const supabase = createSupabaseServerClient()
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name, status, entrant_count")
    .eq("id", id)
    .single()

  if (!tournament) notFound()

  const t = tournament as Tournament

  // Fetch bracket data if tournament is active or complete
  const initialBrackets =
    t.status === "registration"
      ? []
      : await getTournamentBracket(id)

  // Determine champion (final match winner)
  const finalMatch = initialBrackets
    .filter((b) => b.winner)
    .sort((a, b) => b.round - a.round || a.match_number - b.match_number)[0]
  const champion = finalMatch?.round === Math.max(...initialBrackets.map((b) => b.round), 0)
    ? finalMatch.winner
    : null

  const statusColor = {
    registration: "#4a9eff",
    active: "#f0c040",
    complete: "#27ae60",
  }[t.status]

  const entrantCount = initialBrackets
    .flatMap((b) => [b.entrant1?.id, b.entrant2?.id])
    .filter((v, i, a) => v && a.indexOf(v) === i).length

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
      {/* Header */}
      <div style={{
        borderBottom: "1px solid rgba(240,192,64,0.12)",
        padding: "16px 24px",
        display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
      }}>
        <h1 style={{ color: "#f0c040", fontSize: 18, fontFamily: "monospace", fontWeight: 600, margin: 0 }}>
          {t.name}
        </h1>
        <span style={{
          fontSize: 10, fontFamily: "monospace", letterSpacing: 2,
          padding: "2px 8px", border: `1px solid ${statusColor}`,
          borderRadius: 3, color: statusColor, textTransform: "uppercase",
        }}>
          {t.status}
        </span>
        <span style={{ fontSize: 12, color: "#555", fontFamily: "monospace" }}>
          ⚔ {entrantCount > 0 ? entrantCount : t.entrant_count} Entrants
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <Link href={`/tournament/${id}/bets`} style={{
            fontSize: 12, color: "#c8c8c8", textDecoration: "none",
            padding: "5px 12px", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 4, fontFamily: "monospace",
          }}>
            🎲 Bookie Board
          </Link>
          <Link href={`/tournament/${id}`} style={{
            fontSize: 12, color: "#c8c8c8", textDecoration: "none",
            padding: "5px 12px", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 4, fontFamily: "monospace",
          }}>
            ← Roster
          </Link>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "24px 0" }}>
        {t.status === "registration" ? (
          <div style={{
            textAlign: "center", padding: "80px 24px",
            color: "#444", fontFamily: "monospace", fontSize: 14,
          }}>
            Bracket will be generated when the tournament begins
          </div>
        ) : (
          <>
            {/* Champion banner */}
            {t.status === "complete" && champion && (
              <div style={{
                margin: "0 24px 24px",
                padding: "20px 24px",
                border: "1px solid rgba(240,192,64,0.5)",
                borderRadius: 8,
                background: "rgba(240,192,64,0.04)",
                display: "flex", alignItems: "center", gap: 20,
              }}>
                <div style={{ borderRadius: "50%", overflow: "hidden", width: 64, height: 64, flexShrink: 0 }}>
                  {champion.portrait_url ? (
                    <Image src={champion.portrait_url} alt={champion.character_name}
                      width={64} height={64} style={{ borderRadius: "50%", objectFit: "cover" }} />
                  ) : (
                    <svg width={64} height={64} viewBox="0 0 64 64" fill="none">
                      <circle cx="32" cy="32" r="32" fill="#1a1a2e" />
                      <circle cx="32" cy="24" r="11" fill="#2a2a3e" />
                      <ellipse cx="32" cy="52" rx="16" ry="13" fill="#2a2a3e" />
                    </svg>
                  )}
                </div>
                <div>
                  <div style={{ color: "#f0c040", fontSize: 20, fontWeight: 700, fontFamily: "monospace" }}>
                    {champion.character_name}
                  </div>
                  {champion.corporation_name && (
                    <div style={{ color: "#888", fontSize: 12, marginTop: 2 }}>{champion.corporation_name}</div>
                  )}
                </div>
                <div style={{ marginLeft: "auto", color: "#f0c040", fontSize: 24 }}>🏆 Champion</div>
              </div>
            )}

            <BracketView
              initialBrackets={initialBrackets}
              tournamentId={id}
              isAdmin={isAdmin}
            />
          </>
        )}
      </div>
    </div>
  )
}
