import { cookies } from "next/headers"
import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { createSupabaseServerClient } from "@/lib/supabase"
import { getTournamentBracket } from "@/lib/bracket"
import BracketView from "@/components/bracket/BracketView"
import AdminBackButton from "@/components/admin/AdminBackButton"
import TournamentRulesCard from "@/components/tournament/TournamentRulesCard"

interface EveSession {
  character_id: number
  expires_at: number
}

interface Tournament {
  id: string
  name: string
  status: "registration" | "active" | "complete"
  entrant_count: number
  ship_class: string | null
  ship_restrictions: string | null
  banned_ships: string | null
  engagement_rules: string | null
  system_name: string | null
  system_id: number | null
  fitting_restrictions: string | null
  additional_rules: string | null
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
    .select("id, name, status, entrant_count, ship_class, ship_restrictions, banned_ships, engagement_rules, system_name, system_id, fitting_restrictions, additional_rules")
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
    active: "var(--ev-gold-light)",
    complete: "#27ae60",
  }[t.status]

  const entrantCount = initialBrackets
    .flatMap((b) => [b.entrant1?.id, b.entrant2?.id])
    .filter((v, i, a) => v && a.indexOf(v) === i).length

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
      {/* Header */}
      <div style={{
        borderBottom: "0.5px solid var(--ev-border2)",
        padding: "16px 24px",
        display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
      }}>
        <h1 style={{ color: "var(--ev-gold-light)", fontSize: 18, fontFamily: "monospace", fontWeight: 600, margin: 0 }}>
          {t.name}
        </h1>
        <span style={{
          fontSize: 10, fontFamily: "monospace", letterSpacing: 2,
          padding: "2px 8px", border: `1px solid ${statusColor}`,
          borderRadius: 3, color: statusColor, textTransform: "uppercase",
        }}>
          {t.status}
        </span>
        <span style={{ fontSize: 12, color: "var(--ev-muted)", fontFamily: "monospace" }}>
          ⚔ {entrantCount > 0 ? entrantCount : t.entrant_count} Entrants
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          {isAdmin && <AdminBackButton />}
          <Link href={`/tournament/${id}/bets`} style={{
            fontSize: 12, color: "var(--ev-text)", textDecoration: "none",
            padding: "5px 12px", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 4, fontFamily: "monospace",
          }}>
            🎲 Bookie Board
          </Link>
          <Link href={`/tournament/${id}`} style={{
            fontSize: 12, color: "var(--ev-text)", textDecoration: "none",
            padding: "5px 12px", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 4, fontFamily: "monospace",
          }}>
            ← Roster
          </Link>
        </div>
      </div>

      {/* Rules card — collapsible */}
      <div style={{ padding: "16px 24px 0" }}>
        <TournamentRulesCard tournament={t} collapsible />
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
                border: "1px solid var(--ev-border2)",
                borderRadius: 10,
                background: "rgba(240,192,64,0.04)",
                display: "flex", alignItems: "center", gap: 20,
              }}>
                <div style={{ borderRadius: "50%", overflow: "hidden", width: 64, height: 64, flexShrink: 0 }}>
                  {champion.portrait_url ? (
                    <Image src={champion.portrait_url} alt={champion.character_name}
                      width={64} height={64} style={{ borderRadius: "50%", objectFit: "cover" }} />
                  ) : (
                    <svg width={64} height={64} viewBox="0 0 64 64" fill="none">
                      <circle cx="32" cy="32" r="32" fill="var(--ev-steel)" />
                      <circle cx="32" cy="24" r="11" fill="var(--ev-card2)" />
                      <ellipse cx="32" cy="52" rx="16" ry="13" fill="var(--ev-card2)" />
                    </svg>
                  )}
                </div>
                <div>
                  <div style={{ color: "var(--ev-gold-light)", fontSize: 20, fontWeight: 700, fontFamily: "monospace" }}>
                    {champion.character_name}
                  </div>
                  {champion.corporation_name && (
                    <div style={{ color: "var(--ev-muted)", fontSize: 12, marginTop: 2 }}>{champion.corporation_name}</div>
                  )}
                </div>
                <div style={{ marginLeft: "auto", color: "var(--ev-gold-light)", fontSize: 24 }}>🏆 Champion</div>
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
