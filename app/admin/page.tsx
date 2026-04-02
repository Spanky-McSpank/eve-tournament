import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase"
import AdminClient from "@/components/admin/AdminClient"

interface EveSession {
  character_id: number
  expires_at: number
}

export default async function AdminPage() {
  const cookieStore = await cookies()
  const raw = cookieStore.get("eve_session")?.value

  let isAdmin = false
  if (raw) {
    try {
      const session = JSON.parse(raw) as EveSession
      if (Date.now() <= session.expires_at) {
        const ids = (process.env.ADMIN_CHARACTER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean)
        isAdmin = ids.includes(String(session.character_id))
      }
    } catch { /* ignore */ }
  }
  if (!isAdmin) redirect("/")

  const supabase = createSupabaseServerClient()
  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("id, name, status, entrant_count, created_at, paused, announcement")
    .order("created_at", { ascending: false })

  const tournamentList = tournaments ?? []

  // Fetch entrant counts for all tournaments in one query
  const { data: entrantRows } = await supabase
    .from("entrants")
    .select("tournament_id")
    .in("tournament_id", tournamentList.map((t) => t.id))

  const countMap = new Map<string, number>()
  for (const row of entrantRows ?? []) {
    const tid = row.tournament_id as string
    countMap.set(tid, (countMap.get(tid) ?? 0) + 1)
  }

  const enriched = tournamentList.map((t) => ({
    ...t,
    currentEntrants: countMap.get(t.id) ?? 0,
  }))

  return <AdminClient initialTournaments={enriched} />
}
