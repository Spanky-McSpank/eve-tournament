import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase"
import { isAdminCharacter } from "@/lib/auth"
import BetManagementClient from "@/components/admin/BetManagementClient"

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

  return (
    <BetManagementClient
      tournamentId={id}
      tournamentName={(tournament as { name: string }).name}
      tournamentStatus={(tournament as { status: string }).status}
    />
  )
}
