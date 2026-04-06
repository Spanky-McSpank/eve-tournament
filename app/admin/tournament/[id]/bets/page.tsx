import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import Link from "next/link"
import { createSupabaseServerClient } from "@/lib/supabase"
import { isAdminCharacter } from "@/lib/auth"
import BetManagementClient from "@/components/admin/BetManagementClient"
import BackButton from "@/components/nav/BackButton"

export default async function AdminBetsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const cookieStore = await cookies()

  const rawSession = cookieStore.get("eve_session")?.value
  let isAdmin = false
  if (rawSession) {
    try {
      const sess = JSON.parse(rawSession) as { character_id: number; expires_at: number }
      if (Date.now() <= sess.expires_at) isAdmin = isAdminCharacter(sess.character_id)
    } catch { /* ignore */ }
  }
  if (!isAdmin) redirect("/")

  const supabase = createSupabaseServerClient()
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name, status")
    .eq("id", id)
    .single()

  if (!tournament) redirect("/admin")

  const t = tournament as { name: string; status: string }
  return (
    <div style={{ background: "var(--ev-bg)", minHeight: "100vh", color: "var(--ev-text)" }}>
      <div style={{ padding: "16px 24px", display: "flex", alignItems: "center", gap: 12, borderBottom: "0.5px solid rgba(200,150,12,0.2)" }}>
        <BackButton href={`/admin/tournament/${id}#betting`} label="Command Center" />
        <Link href={`/tournament/${id}`} style={{ fontSize: 11, color: "var(--ev-muted)", fontFamily: "monospace", textDecoration: "none" }}>
          👁 View Public Page
        </Link>
        <span style={{ fontSize: 13, color: "var(--ev-champagne)", fontFamily: "monospace", fontWeight: 700, marginLeft: "auto" }}>
          {t.name} — Bet Management
        </span>
      </div>
      <BetManagementClient
        tournamentId={id}
        tournamentName={t.name}
        tournamentStatus={t.status}
      />
    </div>
  )
}
