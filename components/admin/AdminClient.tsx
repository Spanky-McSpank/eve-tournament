"use client"

import Image from "next/image"
import Link from "next/link"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { formatISK } from "@/lib/utils"
import { calculateAcceptorStake } from "@/lib/odds"

const GOLD = "var(--ev-gold-light)"

interface Tournament {
  id: string
  name: string
  status: "registration" | "active" | "complete"
  entrant_count: number
  created_at: string
  paused?: boolean
  announcement?: string | null
  currentEntrants: number
}

interface AddedEntrant {
  character_name: string
  corporation_name: string | null
  portrait_url: string | null
}

interface AdminProposal {
  id: string
  bracket_id: string
  proposer_character_id: number
  proposer_name: string
  predicted_winner_id: string
  predictedWinnerName: string
  bracketLabel: string
  isk_amount: number
  implied_prob: number
  status: string
  is_proxy: boolean
  acceptorStake: number
}

interface AdminSettlement {
  id: string
  round: number
  from_character_name: string
  to_character_name: string
  isk_amount: number
  is_paid: boolean
}

interface MatchRow {
  id: string
  round: number
  match_number: number
  locked: boolean
  entrant1_name: string | null
  entrant2_name: string | null
  winner_id: string | null
}

interface EntrantRow {
  id: string
  character_id: number
  character_name: string
  corporation_name: string | null
  portrait_url: string | null
  seed: number | null
  kills_30d: number
  losses_30d: number
  efficiency: number
}

interface BracketAdminRow {
  id: string
  round: number
  match_number: number
  entrant1_id: string | null
  entrant2_id: string | null
  entrant1_name: string | null
  entrant2_name: string | null
  winner_id: string | null
  winner_name: string | null
  locked: boolean
  is_bye: boolean
  scheduled_time: string | null
  completed_at: string | null
}

const STATUS_COLOR: Record<string, string> = {
  registration: "#3b82f6",
  active: "#22c55e",
  complete: GOLD,
}

export default function AdminClient({ initialTournaments }: { initialTournaments: Tournament[] }) {
  const router = useRouter()
  const [tournaments, setTournaments] = useState(initialTournaments)

  // Create tournament form
  const [createName, setCreateName] = useState("")
  const [createCount, setCreateCount] = useState<16 | 32 | 64>(16)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Add entrant form
  const [addName, setAddName] = useState("")
  const [addTournamentId, setAddTournamentId] = useState("")
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [addedEntrant, setAddedEntrant] = useState<AddedEntrant | null>(null)

  // Generate bracket
  const [generateLoadingId, setGenerateLoadingId] = useState<string | null>(null)
  const [generateError, setGenerateError] = useState<string | null>(null)

  // ── Tournament Management (sections A–D) ──────────────────────────────────
  const [mgmtTid, setMgmtTid] = useState("")
  const [mgmtLoading, setMgmtLoading] = useState(false)
  const [mgmtEntrants, setMgmtEntrants] = useState<EntrantRow[]>([])
  const [mgmtBrackets, setMgmtBrackets] = useState<BracketAdminRow[]>([])
  const [mgmtSettlements, setMgmtSettlements] = useState<AdminSettlement[]>([])

  // Section A
  const [editTName, setEditTName] = useState("")
  const [editAnnouncement, setEditAnnouncement] = useState("")
  const [updateLoading, setUpdateLoading] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [statusLoading, setStatusLoading] = useState<string | null>(null)

  // Section B
  const [editEntrantId, setEditEntrantId] = useState<string | null>(null)
  const [editEntrantFields, setEditEntrantFields] = useState<Record<string, string>>({})
  const [entrantLoading, setEntrantLoading] = useState<string | null>(null)
  const [swapSeedModal, setSwapSeedModal] = useState(false)
  const [swapSeedId1, setSwapSeedId1] = useState("")
  const [swapSeedId2, setSwapSeedId2] = useState("")
  const [swapSeedLoading, setSwapSeedLoading] = useState(false)

  // Section C
  const [bracketLoading, setBracketLoading] = useState<string | null>(null)
  const [overrideBid, setOverrideBid] = useState<string | null>(null)
  const [overrideWinnerId, setOverrideWinnerId] = useState("")
  const [overrideReason, setOverrideReason] = useState("")
  const [overrideKillmail, setOverrideKillmail] = useState("")
  const [overrideLoading, setOverrideLoading] = useState(false)
  const [scheduleBid, setScheduleBid] = useState<string | null>(null)
  const [scheduleTime, setScheduleTime] = useState("")
  const [swapSlotsModal, setSwapSlotsModal] = useState(false)
  const [swapBid1, setSwapBid1] = useState("")
  const [swapSlot1, setSwapSlot1] = useState("entrant1")
  const [swapBid2, setSwapBid2] = useState("")
  const [swapSlot2, setSwapSlot2] = useState("entrant2")
  const [swapSlotsLoading, setSwapSlotsLoading] = useState(false)

  // Bet management
  const [betMgmtTid, setBetMgmtTid] = useState("")
  const [betProposals, setBetProposals] = useState<AdminProposal[]>([])
  const [betSettlements, setBetSettlements] = useState<AdminSettlement[]>([])
  const [betMatches, setBetMatches] = useState<MatchRow[]>([])
  const [betLoading, setBetLoading] = useState(false)

  // Proxy form
  const [proxyAction, setProxyAction] = useState<"propose" | "accept">("propose")
  const [proxyCharName, setProxyCharName] = useState("")
  const [proxyCharId, setProxyCharId] = useState("")
  const [proxyBracketId, setProxyBracketId] = useState("")
  const [proxyWinnerId, setProxyWinnerId] = useState("")
  const [proxyAmount, setProxyAmount] = useState("")
  const [proxyProposalId, setProxyProposalId] = useState("")
  const [proxyLoading, setProxyLoading] = useState(false)
  const [proxyError, setProxyError] = useState<string | null>(null)
  const [proxySuccess, setProxySuccess] = useState<string | null>(null)

  // Edit proposal
  const [editProposalId, setEditProposalId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState("")
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Lock loading
  const [lockLoading, setLockLoading] = useState<string | null>(null)

  // Settlement pay
  const [payingId, setPayingId] = useState<string | null>(null)

  const activeTournaments = tournaments.filter((t) => t.status === "active")
  const registrationTournaments = tournaments.filter((t) => t.status === "registration")
  const mgmtTournament = tournaments.find((t) => t.id === mgmtTid) ?? null

  // ── fetchMgmtData ──────────────────────────────────────────────────────────
  const fetchMgmtData = useCallback(async (tid: string) => {
    if (!tid) return
    setMgmtLoading(true)
    try {
      const [entrantsRes, bracketRes, settlRes] = await Promise.all([
        fetch(`/api/tournament/${tid}/entrants`),
        fetch(`/api/tournament/${tid}/bracket`),
        fetch(`/api/tournament/${tid}/settlements`),
      ])
      if (entrantsRes.ok) {
        const d = await entrantsRes.json() as { entrants: EntrantRow[] }
        setMgmtEntrants(d.entrants ?? [])
      }
      if (bracketRes.ok) {
        const d = await bracketRes.json() as {
          brackets: Array<{
            id: string; round: number; match_number: number
            entrant1?: { id: string; character_name: string } | null
            entrant2?: { id: string; character_name: string } | null
            winner?: { id: string; character_name: string } | null
            winner_id: string | null; locked?: boolean; is_bye?: boolean
            scheduled_time?: string | null; completed_at?: string | null
          }>
        }
        setMgmtBrackets(
          (d.brackets ?? []).map((b) => ({
            id: b.id,
            round: b.round,
            match_number: b.match_number,
            entrant1_id: b.entrant1?.id ?? null,
            entrant2_id: b.entrant2?.id ?? null,
            entrant1_name: b.entrant1?.character_name ?? null,
            entrant2_name: b.entrant2?.character_name ?? null,
            winner_id: b.winner_id,
            winner_name: b.winner?.character_name ?? null,
            locked: b.locked ?? false,
            is_bye: b.is_bye ?? false,
            scheduled_time: b.scheduled_time ?? null,
            completed_at: b.completed_at ?? null,
          }))
        )
      }
      if (settlRes.ok) {
        const d = await settlRes.json() as { settlements: AdminSettlement[] }
        setMgmtSettlements(d.settlements ?? [])
      }
    } finally {
      setMgmtLoading(false)
    }
  }, [])

  // Pre-fill section A when tournament changes
  useEffect(() => {
    if (mgmtTid && mgmtTournament) {
      setEditTName(mgmtTournament.name)
      setEditAnnouncement(mgmtTournament.announcement ?? "")
      setUpdateError(null)
      setUpdateSuccess(null)
      setDeleteConfirm("")
      setDeleteError(null)
    }
    if (mgmtTid) void fetchMgmtData(mgmtTid)
  }, [mgmtTid, fetchMgmtData]) // mgmtTournament intentionally excluded — pre-fill only on tid change

  // ── fetchBetData ───────────────────────────────────────────────────────────
  const fetchBetData = useCallback(async (tid: string) => {
    if (!tid) return
    setBetLoading(true)
    try {
      const [propRes, settlRes, bracketRes] = await Promise.all([
        fetch(`/api/tournament/${tid}/proposals`),
        fetch(`/api/tournament/${tid}/settlements`),
        fetch(`/api/tournament/${tid}/bracket`),
      ])
      if (propRes.ok) {
        const d = await propRes.json() as { proposals: AdminProposal[] }
        setBetProposals(d.proposals ?? [])
      }
      if (settlRes.ok) {
        const d = await settlRes.json() as { settlements: AdminSettlement[] }
        setBetSettlements(d.settlements ?? [])
      }
      if (bracketRes.ok) {
        const d = await bracketRes.json() as { brackets: Array<{ id: string; round: number; match_number: number; locked?: boolean; winner_id: string | null; entrant1?: { character_name: string } | null; entrant2?: { character_name: string } | null }> }
        setBetMatches(
          (d.brackets ?? [])
            .filter((b) => !b.winner_id && b.entrant1 && b.entrant2)
            .map((b) => ({
              id: b.id, round: b.round, match_number: b.match_number,
              locked: b.locked ?? false,
              entrant1_name: b.entrant1?.character_name ?? null,
              entrant2_name: b.entrant2?.character_name ?? null,
              winner_id: b.winner_id,
            }))
        )
      }
    } finally {
      setBetLoading(false)
    }
  }, [])

  useEffect(() => {
    if (betMgmtTid) void fetchBetData(betMgmtTid)
  }, [betMgmtTid, fetchBetData])

  // ── Handlers: Create / Add Entrant / Generate ──────────────────────────────

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateLoading(true)
    setCreateError(null)
    try {
      const res = await fetch("/api/admin/tournament", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createName, entrantCount: createCount }),
      })
      const data = await res.json() as { tournament?: Tournament; error?: string }
      if (!res.ok) { setCreateError(data.error ?? "Failed to create tournament"); return }
      setCreateName("")
      router.refresh()
      if (data.tournament) {
        setTournaments((prev) => [{ ...data.tournament!, currentEntrants: 0 }, ...prev])
      }
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setCreateLoading(false)
    }
  }

  async function handleAddEntrant(e: React.FormEvent) {
    e.preventDefault()
    setAddLoading(true)
    setAddError(null)
    setAddedEntrant(null)
    try {
      const res = await fetch("/api/admin/entrant/search-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterName: addName, tournamentId: addTournamentId }),
      })
      const data = await res.json() as { entrant?: AddedEntrant; error?: string }
      if (!res.ok) { setAddError(data.error ?? "Failed to add entrant"); return }
      setAddedEntrant(data.entrant ?? null)
      setAddName("")
      setTournaments((prev) =>
        prev.map((t) => t.id === addTournamentId ? { ...t, currentEntrants: t.currentEntrants + 1 } : t)
      )
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setAddLoading(false)
    }
  }

  async function handleGenerate(tournamentId: string) {
    if (!confirm("Generate bracket and start tournament? This cannot be undone.")) return
    setGenerateLoadingId(tournamentId)
    setGenerateError(null)
    try {
      const res = await fetch(`/api/admin/tournament/${tournamentId}/generate`, { method: "POST" })
      const data = await res.json() as { error?: string }
      if (!res.ok) { setGenerateError(data.error ?? "Failed to generate bracket"); return }
      setTournaments((prev) =>
        prev.map((t) => t.id === tournamentId ? { ...t, status: "active" } : t)
      )
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setGenerateLoadingId(null)
    }
  }

  // ── Section A handlers ─────────────────────────────────────────────────────

  async function handleUpdateTournament(e: React.FormEvent) {
    e.preventDefault()
    if (!mgmtTid) return
    setUpdateLoading(true)
    setUpdateError(null)
    setUpdateSuccess(null)
    try {
      const body: Record<string, unknown> = { name: editTName }
      if (editAnnouncement !== undefined) body.announcement = editAnnouncement || null
      const res = await fetch(`/api/admin/tournament/${mgmtTid}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json() as { tournament?: { name: string; announcement?: string | null }; error?: string }
      if (!res.ok) { setUpdateError(data.error ?? "Failed to update"); return }
      setUpdateSuccess("Saved")
      if (data.tournament) {
        setTournaments((prev) => prev.map((t) => t.id === mgmtTid ? { ...t, name: data.tournament!.name, announcement: data.tournament!.announcement ?? null } : t))
      }
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setUpdateLoading(false)
    }
  }

  async function handlePauseToggle() {
    if (!mgmtTid || !mgmtTournament) return
    setStatusLoading("pause")
    try {
      const res = await fetch(`/api/admin/tournament/${mgmtTid}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused: !mgmtTournament.paused }),
      })
      if (res.ok) {
        setTournaments((prev) => prev.map((t) => t.id === mgmtTid ? { ...t, paused: !t.paused } : t))
      }
    } finally {
      setStatusLoading(null)
    }
  }

  async function handleStatusChange(newStatus: string) {
    if (!mgmtTid) return
    if (!confirm(`Change tournament status to "${newStatus}"?`)) return
    setStatusLoading(newStatus)
    try {
      const res = await fetch(`/api/admin/tournament/${mgmtTid}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json() as { tournament?: { status: string }; error?: string }
      if (res.ok && data.tournament) {
        setTournaments((prev) => prev.map((t) => t.id === mgmtTid ? { ...t, status: data.tournament!.status as Tournament["status"] } : t))
      }
    } finally {
      setStatusLoading(null)
    }
  }

  async function handleDeleteTournament() {
    if (!mgmtTid || deleteConfirm !== "DELETE") return
    setDeleteLoading(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/admin/tournament/${mgmtTid}/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) { setDeleteError(data.error ?? "Failed to delete"); return }
      setTournaments((prev) => prev.filter((t) => t.id !== mgmtTid))
      setMgmtTid("")
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setDeleteLoading(false)
    }
  }

  // ── Section B handlers ─────────────────────────────────────────────────────

  async function handleEntrantUpdate(entrantId: string) {
    setEntrantLoading(entrantId)
    try {
      const res = await fetch(`/api/admin/entrant/${entrantId}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editEntrantFields),
      })
      const data = await res.json() as { entrant?: EntrantRow; error?: string }
      if (!res.ok) { alert(data.error ?? "Failed to update"); return }
      if (data.entrant) {
        setMgmtEntrants((prev) => prev.map((e) => e.id === entrantId ? { ...e, ...data.entrant } : e))
      }
      setEditEntrantId(null)
      setEditEntrantFields({})
    } finally {
      setEntrantLoading(null)
    }
  }

  async function handleRefreshStats(entrantId: string) {
    setEntrantLoading(entrantId + "_refresh")
    try {
      const res = await fetch(`/api/admin/entrant/${entrantId}/refresh-stats`, { method: "POST" })
      const data = await res.json() as { entrant?: EntrantRow; error?: string }
      if (!res.ok) { alert(data.error ?? "Failed to refresh"); return }
      if (data.entrant) {
        setMgmtEntrants((prev) => prev.map((e) => e.id === entrantId ? { ...e, ...data.entrant } : e))
      }
    } finally {
      setEntrantLoading(null)
    }
  }

  async function handleRemoveEntrant(entrantId: string, name: string) {
    if (!confirm(`Remove ${name} from the tournament? This cannot be undone.`)) return
    setEntrantLoading(entrantId + "_remove")
    try {
      const res = await fetch(`/api/admin/entrant/${entrantId}/remove`, { method: "DELETE" })
      if (!res.ok) { const d = await res.json() as { error?: string }; alert(d.error ?? "Failed to remove"); return }
      setMgmtEntrants((prev) => prev.filter((e) => e.id !== entrantId))
      setTournaments((prev) => prev.map((t) => t.id === mgmtTid ? { ...t, currentEntrants: t.currentEntrants - 1 } : t))
      void fetchMgmtData(mgmtTid)
    } finally {
      setEntrantLoading(null)
    }
  }

  async function handleSwapSeeds() {
    if (!swapSeedId1 || !swapSeedId2) return
    setSwapSeedLoading(true)
    try {
      const res = await fetch("/api/admin/entrant/swap-seeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entrantId1: swapSeedId1, entrantId2: swapSeedId2 }),
      })
      const data = await res.json() as { entrants?: EntrantRow[]; error?: string }
      if (!res.ok) { alert(data.error ?? "Failed to swap"); return }
      if (data.entrants) {
        for (const updated of data.entrants) {
          setMgmtEntrants((prev) => prev.map((e) => e.id === updated.id ? { ...e, seed: updated.seed } : e))
        }
      }
      setSwapSeedModal(false)
      setSwapSeedId1(""); setSwapSeedId2("")
    } finally {
      setSwapSeedLoading(false)
    }
  }

  // ── Section C handlers ─────────────────────────────────────────────────────

  async function handleBracketLock(bracketId: string, currentLocked: boolean) {
    setBracketLoading(bracketId)
    try {
      const res = await fetch(`/api/admin/bracket/${bracketId}/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locked: !currentLocked }),
      })
      if (res.ok) {
        setMgmtBrackets((prev) => prev.map((b) => b.id === bracketId ? { ...b, locked: !currentLocked } : b))
      }
    } finally {
      setBracketLoading(null)
    }
  }

  async function handleBracketReset(bracketId: string) {
    if (!confirm("Reset this match to pending? All associated bet outcomes will be reopened.")) return
    setBracketLoading(bracketId + "_reset")
    try {
      const res = await fetch(`/api/admin/bracket/${bracketId}/reset`, { method: "POST" })
      if (res.ok) void fetchMgmtData(mgmtTid)
      else { const d = await res.json() as { error?: string }; alert(d.error ?? "Failed to reset") }
    } finally {
      setBracketLoading(null)
    }
  }

  async function handleScheduleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!scheduleBid) return
    setBracketLoading(scheduleBid + "_sched")
    try {
      const res = await fetch(`/api/admin/bracket/${scheduleBid}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledTime: scheduleTime || null }),
      })
      if (res.ok) {
        const d = await res.json() as { bracket?: { scheduled_time: string | null } }
        setMgmtBrackets((prev) => prev.map((b) => b.id === scheduleBid ? { ...b, scheduled_time: d.bracket?.scheduled_time ?? null } : b))
        setScheduleBid(null)
        setScheduleTime("")
      } else {
        const d = await res.json() as { error?: string }; alert(d.error ?? "Failed to schedule")
      }
    } finally {
      setBracketLoading(null)
    }
  }

  async function handleOverrideSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!overrideBid || !overrideWinnerId) return
    setOverrideLoading(true)
    try {
      const res = await fetch(`/api/admin/bracket/${overrideBid}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newWinnerId: overrideWinnerId,
          overrideReason: overrideReason || undefined,
          killmailUrl: overrideKillmail || undefined,
        }),
      })
      if (res.ok) {
        setOverrideBid(null)
        setOverrideWinnerId(""); setOverrideReason(""); setOverrideKillmail("")
        void fetchMgmtData(mgmtTid)
      } else {
        const d = await res.json() as { error?: string }; alert(d.error ?? "Override failed")
      }
    } finally {
      setOverrideLoading(false)
    }
  }

  async function handleSwapSlots(e: React.FormEvent) {
    e.preventDefault()
    setSwapSlotsLoading(true)
    try {
      const res = await fetch("/api/admin/bracket/swap-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bracketId1: swapBid1, slot1: swapSlot1, bracketId2: swapBid2, slot2: swapSlot2 }),
      })
      if (res.ok) {
        setSwapSlotsModal(false)
        setSwapBid1(""); setSwapBid2("")
        void fetchMgmtData(mgmtTid)
      } else {
        const d = await res.json() as { error?: string }; alert(d.error ?? "Swap failed")
      }
    } finally {
      setSwapSlotsLoading(false)
    }
  }

  // ── Bet management handlers ────────────────────────────────────────────────

  async function handleProxySubmit(e: React.FormEvent) {
    e.preventDefault()
    setProxyLoading(true)
    setProxyError(null)
    setProxySuccess(null)
    try {
      const iskNum = parseInt(proxyAmount.replace(/,/g, ""), 10)
      const body =
        proxyAction === "propose"
          ? { action: "propose", characterName: proxyCharName, characterId: parseInt(proxyCharId, 10), bracketId: proxyBracketId, predictedWinnerId: proxyWinnerId, iskAmount: iskNum }
          : { action: "accept", characterName: proxyCharName, characterId: parseInt(proxyCharId, 10), proposalId: proxyProposalId }

      const res = await fetch("/api/admin/bet/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) { setProxyError(data.error ?? "Failed"); return }
      setProxySuccess(`${proxyAction === "propose" ? "Proposal posted" : "Bet accepted"} for ${proxyCharName}`)
      setProxyCharName(""); setProxyCharId(""); setProxyBracketId("")
      setProxyWinnerId(""); setProxyAmount(""); setProxyProposalId("")
      void fetchBetData(betMgmtTid)
    } catch (e) {
      setProxyError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setProxyLoading(false)
    }
  }

  async function handleVoid(proposalId: string) {
    const reason = prompt("Void reason (optional):", "Admin voided")
    if (reason === null) return
    const res = await fetch("/api/admin/bet/void", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proposalId, reason }),
    })
    if (res.ok) void fetchBetData(betMgmtTid)
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editProposalId) return
    setEditLoading(true)
    setEditError(null)
    try {
      const res = await fetch("/api/admin/bet/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId: editProposalId, newIskAmount: parseInt(editAmount.replace(/,/g, ""), 10) }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) { setEditError(data.error ?? "Failed"); return }
      setEditProposalId(null)
      setEditAmount("")
      void fetchBetData(betMgmtTid)
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setEditLoading(false)
    }
  }

  async function handleLockToggle(bracketId: string, currentLocked: boolean) {
    setLockLoading(bracketId)
    try {
      const res = await fetch(`/api/admin/bracket/${bracketId}/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locked: !currentLocked }),
      })
      if (res.ok) {
        setBetMatches((prev) => prev.map((m) => m.id === bracketId ? { ...m, locked: !currentLocked } : m))
      }
    } finally {
      setLockLoading(null)
    }
  }

  async function handleMarkPaid(settlementId: string) {
    setPayingId(settlementId)
    try {
      const res = await fetch(`/api/tournament/${betMgmtTid}/settlement/${settlementId}/pay`, { method: "POST" })
      if (res.ok) void fetchBetData(betMgmtTid)
    } finally {
      setPayingId(null)
    }
  }

  // ── Shared styles ──────────────────────────────────────────────────────────

  const cardStyle: React.CSSProperties = {
    background: "var(--ev-card)",
    border: "0.5px solid var(--ev-border2)",
    borderRadius: 10,
    padding: 24,
    marginBottom: 24,
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 12px",
    background: "var(--ev-card2)", border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 4, color: "var(--ev-text)", fontSize: 13, fontFamily: "monospace",
    outline: "none", boxSizing: "border-box",
  }

  const labelStyle: React.CSSProperties = {
    display: "block", color: "var(--ev-muted)", fontSize: 10,
    fontFamily: "monospace", letterSpacing: 1, marginBottom: 6,
  }

  const subHeadStyle: React.CSSProperties = {
    color: "var(--ev-muted)", fontSize: 10, fontFamily: "monospace",
    letterSpacing: 1, marginBottom: 10, marginTop: 20, fontWeight: 600,
  }

  const tinyBtnStyle = (variant?: "danger" | "gold" | "orange"): React.CSSProperties => ({
    padding: "3px 8px", fontSize: 10, fontFamily: "monospace", cursor: "pointer",
    background: "transparent", borderRadius: 3,
    border: `1px solid ${variant === "danger" ? "rgba(192,57,43,0.5)" : variant === "gold" ? GOLD : variant === "orange" ? "rgba(249,115,22,0.5)" : "rgba(255,255,255,0.12)"}`,
    color: variant === "danger" ? "#c0392b" : variant === "gold" ? GOLD : variant === "orange" ? "#f97316" : "var(--ev-muted)",
  })

  const overrideBracket = mgmtBrackets.find((b) => b.id === overrideBid)
  const pendingMgmtSettlements = mgmtSettlements.filter((s) => !s.is_paid)
  const currentRound = pendingMgmtSettlements.length > 0 ? pendingMgmtSettlements[0].round : null

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
      padding: 24,
    }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <h1 style={{ color: GOLD, fontSize: 22, fontFamily: "monospace", fontWeight: 700, margin: 0 }}>
            ADMIN PANEL
          </h1>
          <Link href="/" style={{ marginLeft: "auto", fontSize: 12, color: "var(--ev-muted)", fontFamily: "monospace", textDecoration: "none" }}>
            ← Home
          </Link>
        </div>

        {/* ── Create Tournament ── */}
        <div style={cardStyle}>
          <h2 style={{ color: GOLD, fontSize: 12, fontFamily: "monospace", letterSpacing: 2, marginBottom: 20, fontWeight: 600 }}>CREATE TOURNAMENT</h2>
          <form onSubmit={(e) => void handleCreate(e)}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 2, minWidth: 200 }}>
                <label style={labelStyle}>TOURNAMENT NAME</label>
                <input type="text" value={createName} onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Alliance Championship Season 1" required style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>ENTRANT COUNT</label>
                <div style={{ display: "flex", gap: 1 }}>
                  {([16, 32, 64] as const).map((n) => (
                    <button key={n} type="button" onClick={() => setCreateCount(n)} style={{
                      padding: "8px 20px",
                      background: createCount === n ? GOLD : "transparent",
                      border: `1px solid ${createCount === n ? GOLD : "rgba(255,255,255,0.12)"}`,
                      borderRadius: n === 16 ? "4px 0 0 4px" : n === 64 ? "0 4px 4px 0" : "0",
                      color: createCount === n ? "var(--ev-bg)" : "var(--ev-muted)",
                      fontSize: 13, fontWeight: createCount === n ? 700 : 400,
                      cursor: "pointer", fontFamily: "monospace",
                    }}>{n}</button>
                  ))}
                </div>
              </div>
            </div>
            {createError && <div style={{ color: "#c0392b", fontSize: 12, fontFamily: "monospace", marginTop: 12 }}>{createError}</div>}
            <button type="submit" disabled={createLoading || !createName.trim()} style={{
              marginTop: 16, padding: "8px 24px",
              background: createLoading || !createName.trim() ? "rgba(240,192,64,0.15)" : GOLD,
              border: "none", borderRadius: 4,
              color: createLoading || !createName.trim() ? "var(--ev-muted)" : "var(--ev-bg)",
              fontSize: 12, fontWeight: 600, cursor: createLoading || !createName.trim() ? "not-allowed" : "pointer",
              fontFamily: "monospace",
            }}>{createLoading ? "Creating..." : "Create Tournament"}</button>
          </form>
        </div>

        {/* ── Add Entrant ── */}
        <div style={cardStyle}>
          <h2 style={{ color: GOLD, fontSize: 12, fontFamily: "monospace", letterSpacing: 2, marginBottom: 20, fontWeight: 600 }}>MANUAL ENTRANT ADD</h2>
          <form onSubmit={(e) => void handleAddEntrant(e)}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 2, minWidth: 200 }}>
                <label style={labelStyle}>CHARACTER NAME</label>
                <input type="text" value={addName} onChange={(e) => setAddName(e.target.value)}
                  placeholder="Exact character name" required style={inputStyle} />
              </div>
              <div style={{ flex: 2, minWidth: 200 }}>
                <label style={labelStyle}>TOURNAMENT</label>
                <select value={addTournamentId} onChange={(e) => setAddTournamentId(e.target.value)}
                  required style={{ ...inputStyle, cursor: "pointer" }}>
                  <option value="">Select tournament...</option>
                  {registrationTournaments.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.currentEntrants}/{t.entrant_count})</option>
                  ))}
                </select>
              </div>
            </div>
            {addError && <div style={{ color: "#c0392b", fontSize: 12, fontFamily: "monospace", marginTop: 12 }}>{addError}</div>}
            {addedEntrant && (
              <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 4 }}>
                {addedEntrant.portrait_url && (
                  <div style={{ borderRadius: "50%", overflow: "hidden", width: 36, height: 36, flexShrink: 0 }}>
                    <Image src={addedEntrant.portrait_url} alt={addedEntrant.character_name} width={36} height={36} style={{ borderRadius: "50%", objectFit: "cover" }} />
                  </div>
                )}
                <div>
                  <div style={{ color: "#22c55e", fontSize: 13, fontWeight: 600 }}>Added: {addedEntrant.character_name}</div>
                  {addedEntrant.corporation_name && <div style={{ color: "var(--ev-muted)", fontSize: 11 }}>{addedEntrant.corporation_name}</div>}
                </div>
              </div>
            )}
            <button type="submit" disabled={addLoading || !addName.trim() || !addTournamentId} style={{
              marginTop: 16, padding: "8px 24px",
              background: addLoading || !addName.trim() || !addTournamentId ? "rgba(240,192,64,0.15)" : GOLD,
              border: "none", borderRadius: 4,
              color: addLoading || !addName.trim() || !addTournamentId ? "var(--ev-muted)" : "var(--ev-bg)",
              fontSize: 12, fontWeight: 600,
              cursor: addLoading || !addName.trim() || !addTournamentId ? "not-allowed" : "pointer",
              fontFamily: "monospace",
            }}>{addLoading ? "Searching..." : "Search & Add"}</button>
          </form>
        </div>

        {/* ── Tournament List ── */}
        <div style={cardStyle}>
          <h2 style={{ color: GOLD, fontSize: 12, fontFamily: "monospace", letterSpacing: 2, marginBottom: 20, fontWeight: 600 }}>TOURNAMENTS</h2>
          {generateError && <div style={{ color: "#c0392b", fontSize: 12, fontFamily: "monospace", marginBottom: 12 }}>{generateError}</div>}
          {tournaments.length === 0 ? (
            <div style={{ color: "#444", fontFamily: "monospace", fontSize: 12, padding: "20px 0" }}>No tournaments yet</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Name", "Status", "Entrants", "Created", "Actions"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "6px 12px", fontSize: 10, fontFamily: "monospace", letterSpacing: 1, color: "var(--ev-muted)", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{h.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tournaments.map((t, i) => {
                  const canGenerate = t.status === "registration" && t.currentEntrants >= 4
                  return (
                    <tr key={t.id} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                      <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--ev-text)" }}>{t.name}{t.paused && <span style={{ marginLeft: 6, fontSize: 9, color: "#f97316", border: "1px solid #f97316", borderRadius: 3, padding: "1px 4px", fontFamily: "monospace" }}>PAUSED</span>}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ fontSize: 10, fontFamily: "monospace", letterSpacing: 1, padding: "2px 8px", border: `1px solid ${STATUS_COLOR[t.status] ?? "var(--ev-muted)"}`, borderRadius: 3, color: STATUS_COLOR[t.status] ?? "var(--ev-muted)", textTransform: "uppercase" }}>{t.status}</span>
                      </td>
                      <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 12, color: "var(--ev-muted)" }}>{t.currentEntrants} / {t.entrant_count}</td>
                      <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 11, color: "var(--ev-muted)" }}>{new Date(t.created_at).toLocaleDateString()}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <Link href={`/tournament/${t.id}`} style={{ fontSize: 11, color: "var(--ev-text)", textDecoration: "none", padding: "3px 10px", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 3, fontFamily: "monospace" }}>View</Link>
                          {t.status === "registration" && (
                            <button onClick={() => void handleGenerate(t.id)}
                              disabled={!canGenerate || generateLoadingId === t.id}
                              title={!canGenerate ? "Requires at least 4 entrants" : undefined}
                              style={{ fontSize: 11, fontFamily: "monospace", padding: "3px 10px", background: "transparent", border: `1px solid ${canGenerate ? GOLD : "rgba(255,255,255,0.08)"}`, borderRadius: 3, color: canGenerate ? GOLD : "#444", cursor: canGenerate ? "pointer" : "not-allowed" }}>
                              {generateLoadingId === t.id ? "Generating..." : "Generate & Start"}
                            </button>
                          )}
                          {t.status === "active" && (
                            <Link href={`/tournament/${t.id}/bracket`} style={{ fontSize: 11, color: GOLD, textDecoration: "none", padding: "3px 10px", border: `1px solid rgba(240,192,64,0.3)`, borderRadius: 3, fontFamily: "monospace" }}>View Bracket</Link>
                          )}
                          <button onClick={() => setMgmtTid(t.id)} style={{ fontSize: 11, fontFamily: "monospace", padding: "3px 10px", background: mgmtTid === t.id ? "rgba(240,192,64,0.1)" : "transparent", border: `1px solid ${mgmtTid === t.id ? GOLD : "rgba(255,255,255,0.08)"}`, borderRadius: 3, color: mgmtTid === t.id ? GOLD : "var(--ev-muted)", cursor: "pointer" }}>
                            Manage
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Tournament Management (Sections A–D) ── */}
        {mgmtTid && (
          <div style={cardStyle}>
            <h2 style={{ color: GOLD, fontSize: 12, fontFamily: "monospace", letterSpacing: 2, marginBottom: 4, fontWeight: 600 }}>
              TOURNAMENT MANAGEMENT
            </h2>
            <div style={{ fontSize: 11, color: "var(--ev-muted)", fontFamily: "monospace", marginBottom: 20 }}>
              {mgmtTournament?.name}
              <button onClick={() => setMgmtTid("")} style={{ marginLeft: 12, fontSize: 10, background: "transparent", border: "none", color: "var(--ev-muted)", cursor: "pointer", fontFamily: "monospace" }}>✕ close</button>
            </div>

            {mgmtLoading && <div style={{ color: "#444", fontFamily: "monospace", fontSize: 12, padding: "12px 0" }}>Loading...</div>}

            {!mgmtLoading && (
              <>
                {/* ── Section A: Tournament Controls ── */}
                <div style={subHeadStyle}>A · TOURNAMENT CONTROLS</div>
                <form onSubmit={(e) => void handleUpdateTournament(e)}>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                    <div style={{ flex: 2, minWidth: 220 }}>
                      <label style={labelStyle}>NAME</label>
                      <input type="text" value={editTName} onChange={(e) => setEditTName(e.target.value)} required style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={labelStyle}>ANNOUNCEMENT (shown on tournament page)</label>
                    <textarea value={editAnnouncement} onChange={(e) => setEditAnnouncement(e.target.value)} rows={3}
                      placeholder="Optional announcement text..." style={{ ...inputStyle, resize: "vertical", height: "auto" }} />
                  </div>
                  {updateError && <div style={{ color: "#c0392b", fontSize: 11, fontFamily: "monospace", marginBottom: 8 }}>{updateError}</div>}
                  {updateSuccess && <div style={{ color: "#22c55e", fontSize: 11, fontFamily: "monospace", marginBottom: 8 }}>{updateSuccess}</div>}
                  <button type="submit" disabled={updateLoading} style={{ padding: "6px 18px", background: updateLoading ? "rgba(240,192,64,0.15)" : GOLD, border: "none", borderRadius: 4, color: updateLoading ? "var(--ev-muted)" : "var(--ev-bg)", fontSize: 11, fontWeight: 600, fontFamily: "monospace", cursor: updateLoading ? "not-allowed" : "pointer" }}>
                    {updateLoading ? "Saving..." : "Save Name & Announcement"}
                  </button>
                </form>

                {/* Status controls */}
                <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap", alignItems: "center" }}>
                  {mgmtTournament?.status === "active" && (
                    <>
                      <button onClick={() => void handlePauseToggle()} disabled={statusLoading === "pause"} style={tinyBtnStyle("orange")}>
                        {statusLoading === "pause" ? "···" : mgmtTournament.paused ? "Resume Tournament" : "Pause Tournament"}
                      </button>
                      <button onClick={() => void handleStatusChange("registration")} disabled={!!statusLoading} style={tinyBtnStyle()}>
                        {statusLoading === "registration" ? "···" : "Return to Registration"}
                      </button>
                      <button onClick={() => void handleStatusChange("complete")} disabled={!!statusLoading} style={tinyBtnStyle("gold")}>
                        {statusLoading === "complete" ? "···" : "Mark Complete"}
                      </button>
                    </>
                  )}
                  {mgmtTournament?.status === "complete" && (
                    <button onClick={() => void handleStatusChange("active")} disabled={!!statusLoading} style={tinyBtnStyle("gold")}>
                      {statusLoading === "active" ? "···" : "Reopen Tournament"}
                    </button>
                  )}
                </div>

                {/* Delete */}
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(192,57,43,0.15)" }}>
                  <div style={{ fontSize: 10, color: "#c0392b", fontFamily: "monospace", letterSpacing: 1, marginBottom: 8 }}>DANGER: DELETE TOURNAMENT</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <input type="text" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)}
                      placeholder='Type "DELETE" to confirm' style={{ ...inputStyle, width: 200, fontSize: 12 }} />
                    <button onClick={() => void handleDeleteTournament()} disabled={deleteConfirm !== "DELETE" || deleteLoading}
                      style={{ padding: "6px 16px", background: "transparent", border: "1px solid rgba(192,57,43,0.6)", borderRadius: 4, color: deleteConfirm === "DELETE" ? "#c0392b" : "#444", fontSize: 11, fontFamily: "monospace", cursor: deleteConfirm === "DELETE" ? "pointer" : "not-allowed" }}>
                      {deleteLoading ? "Deleting..." : "Delete Tournament"}
                    </button>
                    {deleteError && <span style={{ color: "#c0392b", fontSize: 11, fontFamily: "monospace" }}>{deleteError}</span>}
                  </div>
                </div>

                {/* ── Section B: Entrant Management ── */}
                <div style={{ ...subHeadStyle, marginTop: 28 }}>B · ENTRANT MANAGEMENT ({mgmtEntrants.length})</div>
                {mgmtEntrants.length === 0 ? (
                  <div style={{ color: "#444", fontFamily: "monospace", fontSize: 11 }}>No entrants</div>
                ) : (
                  <>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                        <thead>
                          <tr>
                            {["", "Name / Corp", "Seed", "Kills", "Losses", "Eff%", "Actions"].map((h) => (
                              <th key={h} style={{ textAlign: "left", padding: "4px 8px", fontSize: 9, fontFamily: "monospace", letterSpacing: 1, color: "var(--ev-muted)", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.06)", whiteSpace: "nowrap" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {mgmtEntrants.map((e, i) => (
                            <tr key={e.id} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                              <td style={{ padding: "6px 8px" }}>
                                {e.portrait_url && (
                                  <div style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
                                    <Image src={e.portrait_url} alt={e.character_name} width={28} height={28} style={{ objectFit: "cover" }} />
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: "6px 8px" }}>
                                {editEntrantId === e.id ? (
                                  <input type="text" value={editEntrantFields.character_name ?? e.character_name} onChange={(ev) => setEditEntrantFields((f) => ({ ...f, character_name: ev.target.value }))}
                                    style={{ ...inputStyle, width: 140, fontSize: 11 }} />
                                ) : (
                                  <>
                                    <div style={{ fontSize: 12, color: "var(--ev-text)" }}>{e.character_name}</div>
                                    <div style={{ fontSize: 10, color: "var(--ev-muted)" }}>{e.corporation_name}</div>
                                  </>
                                )}
                              </td>
                              <td style={{ padding: "6px 8px", fontFamily: "monospace", fontSize: 11, color: "var(--ev-muted)" }}>
                                {editEntrantId === e.id ? (
                                  <input type="number" value={editEntrantFields.seed ?? String(e.seed ?? "")} onChange={(ev) => setEditEntrantFields((f) => ({ ...f, seed: ev.target.value }))}
                                    style={{ ...inputStyle, width: 60, fontSize: 11 }} />
                                ) : (e.seed ?? "—")}
                              </td>
                              <td style={{ padding: "6px 8px", fontFamily: "monospace", fontSize: 11, color: "var(--ev-muted)" }}>{e.kills_30d}</td>
                              <td style={{ padding: "6px 8px", fontFamily: "monospace", fontSize: 11, color: "var(--ev-muted)" }}>{e.losses_30d}</td>
                              <td style={{ padding: "6px 8px", fontFamily: "monospace", fontSize: 11, color: "var(--ev-muted)" }}>{(e.efficiency * 100).toFixed(0)}%</td>
                              <td style={{ padding: "6px 8px" }}>
                                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                  {editEntrantId === e.id ? (
                                    <>
                                      <button onClick={() => void handleEntrantUpdate(e.id)} disabled={entrantLoading === e.id} style={tinyBtnStyle("gold")}>Save</button>
                                      <button onClick={() => { setEditEntrantId(null); setEditEntrantFields({}) }} style={tinyBtnStyle()}>Cancel</button>
                                    </>
                                  ) : (
                                    <>
                                      <button onClick={() => { setEditEntrantId(e.id); setEditEntrantFields({}) }} style={tinyBtnStyle()}>Edit</button>
                                      <button onClick={() => void handleRefreshStats(e.id)} disabled={entrantLoading === e.id + "_refresh"} style={tinyBtnStyle()}>{entrantLoading === e.id + "_refresh" ? "···" : "Refresh"}</button>
                                      <button onClick={() => void handleRemoveEntrant(e.id, e.character_name)} disabled={entrantLoading === e.id + "_remove"} style={tinyBtnStyle("danger")}>{entrantLoading === e.id + "_remove" ? "···" : "Remove"}</button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {mgmtTournament?.status === "registration" && (
                      <button onClick={() => setSwapSeedModal(true)} style={{ marginTop: 10, ...tinyBtnStyle("gold") }}>Swap Seeds…</button>
                    )}
                  </>
                )}

                {/* ── Section C: Bracket Management ── */}
                {mgmtBrackets.length > 0 && (
                  <>
                    <div style={{ ...subHeadStyle, marginTop: 28, display: "flex", alignItems: "center", gap: 12 }}>
                      <span>C · BRACKET MANAGEMENT</span>
                      <button onClick={() => setSwapSlotsModal(true)} style={tinyBtnStyle()}>Swap Slots…</button>
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                        <thead>
                          <tr>
                            {["Rd", "Match", "Fighter 1", "Fighter 2", "Winner", "Scheduled", "Status", "Actions"].map((h) => (
                              <th key={h} style={{ textAlign: "left", padding: "4px 8px", fontSize: 9, fontFamily: "monospace", letterSpacing: 1, color: "var(--ev-muted)", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.06)", whiteSpace: "nowrap" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {mgmtBrackets.map((b, i) => (
                            <tr key={b.id} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                              <td style={{ padding: "5px 8px", fontFamily: "monospace", fontSize: 11, color: "var(--ev-muted)" }}>{b.round}</td>
                              <td style={{ padding: "5px 8px", fontFamily: "monospace", fontSize: 11, color: "var(--ev-muted)" }}>{b.match_number}</td>
                              <td style={{ padding: "5px 8px", fontSize: 11, color: b.winner_id === b.entrant1_id ? GOLD : "var(--ev-text)" }}>{b.entrant1_name ?? "—"}</td>
                              <td style={{ padding: "5px 8px", fontSize: 11, color: b.winner_id === b.entrant2_id ? GOLD : "var(--ev-text)" }}>{b.entrant2_name ?? "—"}</td>
                              <td style={{ padding: "5px 8px", fontSize: 11, color: GOLD }}>{b.winner_name ?? "—"}</td>
                              <td style={{ padding: "5px 8px", fontSize: 10, color: "var(--ev-muted)", fontFamily: "monospace" }}>
                                {scheduleBid === b.id ? (
                                  <form onSubmit={(e) => void handleScheduleSubmit(e)} style={{ display: "flex", gap: 4 }}>
                                    <input type="datetime-local" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)}
                                      style={{ ...inputStyle, fontSize: 10, width: 150, padding: "2px 4px" }} />
                                    <button type="submit" style={tinyBtnStyle("gold")}>OK</button>
                                    <button type="button" onClick={() => setScheduleBid(null)} style={tinyBtnStyle()}>✕</button>
                                  </form>
                                ) : (
                                  b.scheduled_time ? new Date(b.scheduled_time).toLocaleString() : "—"
                                )}
                              </td>
                              <td style={{ padding: "5px 8px" }}>
                                {b.is_bye ? (
                                  <span style={{ fontSize: 9, color: "var(--ev-muted)", fontFamily: "monospace" }}>BYE</span>
                                ) : b.winner_id ? (
                                  <span style={{ fontSize: 9, color: "#22c55e", fontFamily: "monospace" }}>DONE</span>
                                ) : b.locked ? (
                                  <span style={{ fontSize: 9, color: "#f97316", fontFamily: "monospace" }}>LOCKED</span>
                                ) : (
                                  <span style={{ fontSize: 9, color: "#3b82f6", fontFamily: "monospace" }}>PENDING</span>
                                )}
                              </td>
                              <td style={{ padding: "5px 8px" }}>
                                {!b.is_bye && (
                                  <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                                    <button onClick={() => { setScheduleBid(b.id); setScheduleTime(b.scheduled_time ?? "") }} style={tinyBtnStyle()}>Sched</button>
                                    <button onClick={() => void handleBracketLock(b.id, b.locked)} disabled={bracketLoading === b.id} style={tinyBtnStyle(b.locked ? "orange" : undefined)}>
                                      {bracketLoading === b.id ? "···" : b.locked ? "Unlock" : "Lock"}
                                    </button>
                                    <button onClick={() => { setOverrideBid(b.id); setOverrideWinnerId(""); setOverrideReason(""); setOverrideKillmail("") }} style={tinyBtnStyle("gold")}>Override</button>
                                    {b.winner_id && (
                                      <button onClick={() => void handleBracketReset(b.id)} disabled={bracketLoading === b.id + "_reset"} style={tinyBtnStyle("danger")}>
                                        {bracketLoading === b.id + "_reset" ? "···" : "Reset"}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {/* ── Section D: Quick Settlement View ── */}
                {pendingMgmtSettlements.length > 0 && (
                  <>
                    <div style={{ ...subHeadStyle, marginTop: 28, display: "flex", alignItems: "center", gap: 12 }}>
                      <span>D · PENDING SETTLEMENTS {currentRound ? `(Round ${currentRound})` : ""}</span>
                      <Link href={`/tournament/${mgmtTid}/bets`} style={{ fontSize: 10, color: GOLD, fontFamily: "monospace", textDecoration: "none" }}>Full Bookie Board →</Link>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {pendingMgmtSettlements.map((s) => (
                        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "7px 12px", background: "var(--ev-card2)", border: "0.5px solid var(--ev-border2)", borderRadius: 6 }}>
                          <span style={{ fontFamily: "monospace", fontSize: 10, color: "var(--ev-muted)", minWidth: 40 }}>R{s.round}</span>
                          <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--ev-text)", flex: 1 }}>
                            <span style={{ color: "#c0392b" }}>{s.from_character_name}</span>
                            {" owes "}
                            <span style={{ color: "#27ae60" }}>{s.to_character_name}</span>
                            {" — "}
                            <span style={{ color: GOLD }}>{formatISK(s.isk_amount)}</span>
                          </span>
                          <button onClick={async () => {
                            setPayingId(s.id)
                            const res = await fetch(`/api/tournament/${mgmtTid}/settlement/${s.id}/pay`, { method: "POST" })
                            if (res.ok) setMgmtSettlements((prev) => prev.map((x) => x.id === s.id ? { ...x, is_paid: true } : x))
                            setPayingId(null)
                          }} disabled={payingId === s.id} style={tinyBtnStyle()}>
                            {payingId === s.id ? "···" : "Mark Paid"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Bet Management ── */}
        {activeTournaments.length > 0 && (
          <div style={cardStyle}>
            <h2 style={{ color: GOLD, fontSize: 12, fontFamily: "monospace", letterSpacing: 2, marginBottom: 20, fontWeight: 600 }}>BET MANAGEMENT</h2>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>SELECT ACTIVE TOURNAMENT</label>
              <select value={betMgmtTid} onChange={(e) => setBetMgmtTid(e.target.value)} style={{ ...inputStyle, maxWidth: 400 }}>
                <option value="">Select tournament...</option>
                {activeTournaments.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {betMgmtTid && (
              <>
                {betLoading && <div style={{ color: "#444", fontFamily: "monospace", fontSize: 12, padding: "12px 0" }}>Loading...</div>}
                {!betLoading && (
                  <>
                    {betMatches.length > 0 && (
                      <div style={{ marginBottom: 24 }}>
                        <div style={subHeadStyle}>MATCH LOCKS</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {betMatches.map((m) => (
                            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", background: "var(--ev-card2)", border: "0.5px solid var(--ev-border2)", borderRadius: 6 }}>
                              <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--ev-muted)", minWidth: 60 }}>R{m.round} M{m.match_number}</span>
                              <span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--ev-text)", flex: 1 }}>{m.entrant1_name} vs {m.entrant2_name}</span>
                              <button onClick={() => void handleLockToggle(m.id, m.locked)} disabled={lockLoading === m.id}
                                style={{ padding: "3px 10px", fontSize: 10, fontFamily: "monospace", background: "transparent", border: `1px solid ${m.locked ? "#f97316" : "rgba(255,255,255,0.12)"}`, borderRadius: 3, color: m.locked ? "#f97316" : "var(--ev-muted)", cursor: lockLoading === m.id ? "not-allowed" : "pointer" }}>
                                {lockLoading === m.id ? "···" : m.locked ? "🔒 Locked" : "Unlocked"}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ marginBottom: 24 }}>
                      <div style={subHeadStyle}>OPEN PROPOSALS ({betProposals.length})</div>
                      {betProposals.length === 0 ? (
                        <div style={{ color: "#444", fontFamily: "monospace", fontSize: 11 }}>No open proposals</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {betProposals.map((p) => (
                            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 12px", background: "var(--ev-card2)", border: "0.5px solid var(--ev-border2)", borderRadius: 6 }}>
                              <span style={{ fontFamily: "monospace", fontSize: 10, color: "var(--ev-muted)", minWidth: 50 }}>{p.bracketLabel}</span>
                              <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--ev-text)", flex: 1 }}>
                                <span style={{ color: GOLD }}>{p.proposer_name}</span>
                                {p.is_proxy && <span style={{ marginLeft: 4, fontSize: 8, color: "#f97316", border: "1px solid #f97316", borderRadius: 3, padding: "0 3px" }}>PROXY</span>}
                                {" backs "}{p.predictedWinnerName}
                                {" · "}<span style={{ color: GOLD }}>{formatISK(p.isk_amount)}</span>
                                {" vs "}{formatISK(calculateAcceptorStake(p.isk_amount, p.implied_prob))}
                              </span>
                              {editProposalId === p.id ? (
                                <form onSubmit={(e) => void handleEditSubmit(e)} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                  <input type="text" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} placeholder="New ISK amount" autoFocus
                                    style={{ padding: "3px 8px", background: "var(--ev-card)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 3, color: "var(--ev-text)", fontSize: 11, fontFamily: "monospace", width: 120 }} />
                                  <button type="submit" disabled={editLoading} style={{ padding: "3px 8px", background: GOLD, border: "none", borderRadius: 3, color: "var(--ev-bg)", fontSize: 10, fontFamily: "monospace", cursor: "pointer" }}>Save</button>
                                  <button type="button" onClick={() => { setEditProposalId(null); setEditError(null) }} style={{ padding: "3px 8px", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 3, color: "var(--ev-muted)", fontSize: 10, fontFamily: "monospace", cursor: "pointer" }}>Cancel</button>
                                  {editError && <span style={{ color: "#c0392b", fontSize: 10, fontFamily: "monospace" }}>{editError}</span>}
                                </form>
                              ) : (
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button onClick={() => { setEditProposalId(p.id); setEditAmount(String(p.isk_amount)) }} style={{ padding: "3px 8px", background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 3, color: "var(--ev-muted)", fontSize: 10, fontFamily: "monospace", cursor: "pointer" }}>Edit</button>
                                  <button onClick={() => void handleVoid(p.id)} style={{ padding: "3px 8px", background: "transparent", border: "1px solid rgba(192,57,43,0.4)", borderRadius: 3, color: "#c0392b", fontSize: 10, fontFamily: "monospace", cursor: "pointer" }}>Void</button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ marginBottom: 24 }}>
                      <div style={subHeadStyle}>PROXY BET</div>
                      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                        {(["propose", "accept"] as const).map((a) => (
                          <button key={a} type="button" onClick={() => setProxyAction(a)} style={{ padding: "5px 16px", background: proxyAction === a ? GOLD : "transparent", border: `1px solid ${proxyAction === a ? GOLD : "rgba(255,255,255,0.12)"}`, borderRadius: 4, fontFamily: "monospace", fontSize: 11, color: proxyAction === a ? "var(--ev-bg)" : "var(--ev-muted)", cursor: "pointer" }}>{a.toUpperCase()}</button>
                        ))}
                      </div>
                      <form onSubmit={(e) => void handleProxySubmit(e)}>
                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                          <div style={{ flex: 1, minWidth: 180 }}>
                            <label style={labelStyle}>CHARACTER NAME</label>
                            <input type="text" value={proxyCharName} onChange={(e) => setProxyCharName(e.target.value)} required placeholder="EVE character name" style={inputStyle} />
                          </div>
                          <div style={{ flex: 1, minWidth: 140 }}>
                            <label style={labelStyle}>CHARACTER ID</label>
                            <input type="number" value={proxyCharId} onChange={(e) => setProxyCharId(e.target.value)} required placeholder="EVE character ID" style={inputStyle} />
                          </div>
                        </div>
                        {proxyAction === "propose" && (
                          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                            <div style={{ flex: 1, minWidth: 180 }}>
                              <label style={labelStyle}>MATCH</label>
                              <select value={proxyBracketId} onChange={(e) => setProxyBracketId(e.target.value)} required style={{ ...inputStyle, cursor: "pointer" }}>
                                <option value="">Select match...</option>
                                {betMatches.map((m) => (
                                  <option key={m.id} value={m.id}>R{m.round} M{m.match_number}: {m.entrant1_name} vs {m.entrant2_name}</option>
                                ))}
                              </select>
                            </div>
                            <div style={{ flex: 1, minWidth: 180 }}>
                              <label style={labelStyle}>BACK FIGHTER (entrant ID)</label>
                              <input type="text" value={proxyWinnerId} onChange={(e) => setProxyWinnerId(e.target.value)} required placeholder="Entrant UUID" style={inputStyle} />
                            </div>
                            <div style={{ flex: 1, minWidth: 140 }}>
                              <label style={labelStyle}>ISK AMOUNT</label>
                              <input type="text" value={proxyAmount} onChange={(e) => setProxyAmount(e.target.value)} required placeholder="e.g. 500000000" style={inputStyle} />
                            </div>
                          </div>
                        )}
                        {proxyAction === "accept" && (
                          <div style={{ marginBottom: 12 }}>
                            <label style={labelStyle}>PROPOSAL</label>
                            <select value={proxyProposalId} onChange={(e) => setProxyProposalId(e.target.value)} required style={{ ...inputStyle, cursor: "pointer" }}>
                              <option value="">Select open proposal...</option>
                              {betProposals.map((p) => (
                                <option key={p.id} value={p.id}>{p.bracketLabel} · {p.proposer_name} backs {p.predictedWinnerName} · {formatISK(p.isk_amount)}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        {proxyError && <div style={{ color: "#c0392b", fontSize: 11, fontFamily: "monospace", marginBottom: 8 }}>{proxyError}</div>}
                        {proxySuccess && <div style={{ color: "#22c55e", fontSize: 11, fontFamily: "monospace", marginBottom: 8 }}>{proxySuccess}</div>}
                        <button type="submit" disabled={proxyLoading} style={{ padding: "7px 20px", background: proxyLoading ? "rgba(240,192,64,0.15)" : GOLD, border: "none", borderRadius: 4, color: proxyLoading ? "var(--ev-muted)" : "var(--ev-bg)", fontSize: 11, fontWeight: 600, fontFamily: "monospace", cursor: proxyLoading ? "not-allowed" : "pointer" }}>
                          {proxyLoading ? "···" : `Proxy ${proxyAction === "propose" ? "Proposal" : "Accept"}`}
                        </button>
                      </form>
                    </div>

                    {betSettlements.length > 0 && (
                      <div>
                        <div style={subHeadStyle}>SETTLEMENTS</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {betSettlements.map((s) => (
                            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", background: "var(--ev-card2)", border: "0.5px solid var(--ev-border2)", borderRadius: 6 }}>
                              <span style={{ fontFamily: "monospace", fontSize: 10, color: "var(--ev-muted)", minWidth: 50 }}>R{s.round}</span>
                              <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--ev-text)", flex: 1 }}>
                                <span style={{ color: "#c0392b" }}>{s.from_character_name}</span>
                                {" owes "}
                                <span style={{ color: "#27ae60" }}>{s.to_character_name}</span>
                                {" — "}
                                <span style={{ color: GOLD }}>{formatISK(s.isk_amount)}</span>
                              </span>
                              {s.is_paid ? (
                                <span style={{ fontSize: 10, fontFamily: "monospace", color: "#22c55e" }}>PAID ✓</span>
                              ) : (
                                <button onClick={() => void handleMarkPaid(s.id)} disabled={payingId === s.id} style={{ padding: "3px 8px", background: "transparent", border: "1px solid rgba(34,197,94,0.4)", borderRadius: 3, color: "#22c55e", fontSize: 10, fontFamily: "monospace", cursor: payingId === s.id ? "not-allowed" : "pointer" }}>
                                  {payingId === s.id ? "···" : "Mark Paid"}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Override Modal ── */}
      {overrideBid && overrideBracket && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--ev-card)", border: "1px solid var(--ev-border2)", borderRadius: 10, padding: 28, width: "100%", maxWidth: 420 }}>
            <h3 style={{ color: GOLD, fontFamily: "monospace", fontSize: 13, marginBottom: 20, fontWeight: 600 }}>
              OVERRIDE RESULT — R{overrideBracket.round} M{overrideBracket.match_number}
            </h3>
            <form onSubmit={(e) => void handleOverrideSubmit(e)}>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>NEW WINNER</label>
                <select value={overrideWinnerId} onChange={(e) => setOverrideWinnerId(e.target.value)} required style={{ ...inputStyle, cursor: "pointer" }}>
                  <option value="">Select winner...</option>
                  {overrideBracket.entrant1_id && <option value={overrideBracket.entrant1_id}>{overrideBracket.entrant1_name}</option>}
                  {overrideBracket.entrant2_id && <option value={overrideBracket.entrant2_id}>{overrideBracket.entrant2_name}</option>}
                </select>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>OVERRIDE REASON</label>
                <input type="text" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="e.g. No-show, rule violation..." style={inputStyle} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>KILLMAIL URL (optional)</label>
                <input type="text" value={overrideKillmail} onChange={(e) => setOverrideKillmail(e.target.value)} placeholder="https://zkillboard.com/kill/..." style={inputStyle} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" disabled={overrideLoading || !overrideWinnerId} style={{ padding: "7px 20px", background: overrideLoading || !overrideWinnerId ? "rgba(240,192,64,0.15)" : GOLD, border: "none", borderRadius: 4, color: overrideLoading || !overrideWinnerId ? "var(--ev-muted)" : "var(--ev-bg)", fontSize: 12, fontWeight: 600, fontFamily: "monospace", cursor: overrideLoading || !overrideWinnerId ? "not-allowed" : "pointer" }}>
                  {overrideLoading ? "Applying..." : "Apply Override"}
                </button>
                <button type="button" onClick={() => setOverrideBid(null)} style={{ padding: "7px 16px", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4, color: "var(--ev-muted)", fontSize: 12, fontFamily: "monospace", cursor: "pointer" }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Swap Slots Modal ── */}
      {swapSlotsModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--ev-card)", border: "1px solid var(--ev-border2)", borderRadius: 10, padding: 28, width: "100%", maxWidth: 460 }}>
            <h3 style={{ color: GOLD, fontFamily: "monospace", fontSize: 13, marginBottom: 20, fontWeight: 600 }}>SWAP BRACKET SLOTS</h3>
            <form onSubmit={(e) => void handleSwapSlots(e)}>
              <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>BRACKET 1</label>
                  <select value={swapBid1} onChange={(e) => setSwapBid1(e.target.value)} required style={{ ...inputStyle, cursor: "pointer" }}>
                    <option value="">Select match...</option>
                    {mgmtBrackets.filter((b) => !b.winner_id && !b.is_bye).map((b) => (
                      <option key={b.id} value={b.id}>R{b.round} M{b.match_number}: {b.entrant1_name} vs {b.entrant2_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>SLOT</label>
                  <select value={swapSlot1} onChange={(e) => setSwapSlot1(e.target.value)} style={{ ...inputStyle, width: 100, cursor: "pointer" }}>
                    <option value="entrant1">Fighter 1</option>
                    <option value="entrant2">Fighter 2</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>BRACKET 2</label>
                  <select value={swapBid2} onChange={(e) => setSwapBid2(e.target.value)} required style={{ ...inputStyle, cursor: "pointer" }}>
                    <option value="">Select match...</option>
                    {mgmtBrackets.filter((b) => !b.winner_id && !b.is_bye).map((b) => (
                      <option key={b.id} value={b.id}>R{b.round} M{b.match_number}: {b.entrant1_name} vs {b.entrant2_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>SLOT</label>
                  <select value={swapSlot2} onChange={(e) => setSwapSlot2(e.target.value)} style={{ ...inputStyle, width: 100, cursor: "pointer" }}>
                    <option value="entrant1">Fighter 1</option>
                    <option value="entrant2">Fighter 2</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" disabled={swapSlotsLoading || !swapBid1 || !swapBid2} style={{ padding: "7px 20px", background: swapSlotsLoading || !swapBid1 || !swapBid2 ? "rgba(240,192,64,0.15)" : GOLD, border: "none", borderRadius: 4, color: swapSlotsLoading || !swapBid1 || !swapBid2 ? "var(--ev-muted)" : "var(--ev-bg)", fontSize: 12, fontWeight: 600, fontFamily: "monospace", cursor: "pointer" }}>
                  {swapSlotsLoading ? "Swapping..." : "Swap"}
                </button>
                <button type="button" onClick={() => setSwapSlotsModal(false)} style={{ padding: "7px 16px", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4, color: "var(--ev-muted)", fontSize: 12, fontFamily: "monospace", cursor: "pointer" }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Swap Seeds Modal ── */}
      {swapSeedModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--ev-card)", border: "1px solid var(--ev-border2)", borderRadius: 10, padding: 28, width: "100%", maxWidth: 420 }}>
            <h3 style={{ color: GOLD, fontFamily: "monospace", fontSize: 13, marginBottom: 20, fontWeight: 600 }}>SWAP SEEDS</h3>
            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>ENTRANT 1</label>
                <select value={swapSeedId1} onChange={(e) => setSwapSeedId1(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                  <option value="">Select entrant...</option>
                  {mgmtEntrants.map((e) => (
                    <option key={e.id} value={e.id}>{e.character_name} (seed {e.seed ?? "?"})</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>ENTRANT 2</label>
                <select value={swapSeedId2} onChange={(e) => setSwapSeedId2(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                  <option value="">Select entrant...</option>
                  {mgmtEntrants.map((e) => (
                    <option key={e.id} value={e.id}>{e.character_name} (seed {e.seed ?? "?"})</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => void handleSwapSeeds()} disabled={swapSeedLoading || !swapSeedId1 || !swapSeedId2 || swapSeedId1 === swapSeedId2}
                style={{ padding: "7px 20px", background: swapSeedLoading || !swapSeedId1 || !swapSeedId2 ? "rgba(240,192,64,0.15)" : GOLD, border: "none", borderRadius: 4, color: swapSeedLoading || !swapSeedId1 || !swapSeedId2 ? "var(--ev-muted)" : "var(--ev-bg)", fontSize: 12, fontWeight: 600, fontFamily: "monospace", cursor: "pointer" }}>
                {swapSeedLoading ? "Swapping..." : "Swap Seeds"}
              </button>
              <button onClick={() => { setSwapSeedModal(false); setSwapSeedId1(""); setSwapSeedId2("") }} style={{ padding: "7px 16px", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4, color: "var(--ev-muted)", fontSize: 12, fontFamily: "monospace", cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
