"use client"

import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { formatISK } from "@/lib/utils"
import AdminBackButton from "@/components/admin/AdminBackButton"
import BetManagementClient from "@/components/admin/BetManagementClient"
import PropManagementSection from "@/components/admin/PropManagementSection"

// ── Types ──────────────────────────────────────────────────────────────────

type MatchStatus = "pending" | "checkin" | "live" | "complete"

interface TFull {
  id: string
  name: string
  status: string
  entrant_count: number
  current_round: number | null
  scheduled_start: string | null
  minutes_per_match: number | null
  announcement: string | null
  paused: boolean | null
  discord_webhook_url: string | null
  ship_class: string | null
  ship_restrictions: string | null
  banned_ships: string | null
  engagement_rules: string | null
  system_name: string | null
  system_id: number | null
  fitting_restrictions: string | null
  additional_rules: string | null
}

interface EntrantFull {
  id: string
  character_id: number
  character_name: string
  corporation_name: string | null
  alliance_name: string | null
  portrait_url: string | null
  kills_30d: number
  losses_30d: number
  isk_destroyed_30d: number
  isk_lost_30d: number
  efficiency: number
  seed: number | null
  checked_in?: boolean
  eliminated_round?: number | null
  final_placement?: number | null
}

interface BracketFull {
  id: string
  round: number
  match_number: number
  entrant1_id: string | null
  entrant2_id: string | null
  winner_id: string | null
  is_bye: boolean
  is_third_place: boolean
  locked: boolean
  killmail_url: string | null
  scheduled_time: string | null
  completed_at: string | null
  match_status?: string | null
  entrant1: EntrantFull | null
  entrant2: EntrantFull | null
  winner: EntrantFull | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

const GOLD = "var(--ev-gold-light)"
const AMBER = "#f59e0b"

function derivedStatus(b: BracketFull, local?: MatchStatus): MatchStatus {
  if (b.winner_id || b.is_bye) return "complete"
  if (local) return local
  if (b.match_status) return b.match_status as MatchStatus
  return "pending"
}

function Portrait({ url, name, size = 40 }: { url: string | null; name: string; size?: number }) {
  return url ? (
    <Image
      src={url}
      alt={name}
      width={size}
      height={size}
      style={{ borderRadius: "50%", objectFit: "cover" }}
    />
  ) : (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--ev-steel)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.4,
        color: "var(--ev-muted)",
      }}
    >
      👤
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    registration: { bg: "#0A1535", color: "#60A5FA", label: "Registration" },
    active: { bg: "#052010", color: "#22C55E", label: "Active" },
    complete: { bg: "#1A1508", color: GOLD, label: "Complete" },
  }
  const s = map[status] ?? { bg: "#1a1a1a", color: "var(--ev-muted)", label: status }
  return (
    <span
      style={{
        fontSize: 10,
        fontFamily: "monospace",
        letterSpacing: 1.5,
        padding: "2px 10px",
        background: s.bg,
        border: `1px solid ${s.color}44`,
        borderRadius: 3,
        color: s.color,
        textTransform: "uppercase",
      }}
    >
      {s.label}
    </span>
  )
}

function MatchStatusBadge({ status }: { status: MatchStatus }) {
  const map: Record<MatchStatus, { color: string; label: string }> = {
    pending: { color: "var(--ev-muted)", label: "PENDING" },
    checkin: { color: AMBER, label: "CHECK-IN" },
    live: { color: "#22C55E", label: "⚡ LIVE" },
    complete: { color: GOLD, label: "✓ COMPLETE" },
  }
  const s = map[status]
  return (
    <span style={{ fontSize: 9, fontFamily: "monospace", letterSpacing: 1, color: s.color }}>
      {s.label}
    </span>
  )
}

function SmBtn({
  onClick,
  children,
  disabled,
  variant = "ghost",
}: {
  onClick: () => void
  children: React.ReactNode
  disabled?: boolean
  variant?: "ghost" | "gold" | "danger" | "green" | "amber"
}) {
  const colors: Record<string, { bg: string; border: string; color: string }> = {
    ghost: { bg: "transparent", border: "rgba(255,255,255,0.12)", color: "var(--ev-muted)" },
    gold: { bg: "var(--ev-gold)", border: "var(--ev-gold)", color: "#080500" },
    danger: { bg: "transparent", border: "#ef444466", color: "#ef4444" },
    green: { bg: "transparent", border: "#22c55e66", color: "#22c55e" },
    amber: { bg: "transparent", border: "#f59e0b66", color: AMBER },
  }
  const c = colors[variant]
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 6,
        color: c.color,
        fontFamily: "monospace",
        fontSize: 11,
        padding: "4px 10px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  )
}

// ── QueueMatchCard ─────────────────────────────────────────────────────────

function QueueMatchCard({
  bracket,
  matchStatus,
  onStatusChange,
  onResultEnter,
  onForfeit,
  onCheckin,
  onSchedule,
}: {
  bracket: BracketFull
  matchStatus: MatchStatus
  onStatusChange: (id: string, status: MatchStatus) => void
  onResultEnter: (bracketId: string) => void
  onForfeit: (bracketId: string, loserId: string, loserName: string) => void
  onCheckin: (bracketId: string, entrantId: string, checked: boolean) => void
  onSchedule: (bracketId: string) => void
}) {
  const [forfeitExpanded, setForfeitExpanded] = useState(false)
  const [forfeitConfirm, setForfeitConfirm] = useState<{ id: string; name: string } | null>(null)

  const e1 = bracket.entrant1
  const e2 = bracket.entrant2

  if (bracket.is_bye) {
    return (
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--ev-muted)", fontSize: 12 }}>
          <span style={{ fontFamily: "monospace" }}>
            R{bracket.round}·M{bracket.match_number}
          </span>
          <span>BYE — {e1?.character_name ?? "?"} advances automatically</span>
        </div>
      </div>
    )
  }

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ fontFamily: "monospace", fontSize: 10, color: "var(--ev-muted)", letterSpacing: 1 }}>
          R{bracket.round}·M{bracket.match_number}
        </span>
        <MatchStatusBadge status={matchStatus} />
        {bracket.locked && (
          <span style={{ fontSize: 9, color: AMBER, fontFamily: "monospace" }}>🔒 BETTING LOCKED</span>
        )}
        {bracket.scheduled_time && (
          <span style={{ fontSize: 10, color: "var(--ev-muted)", fontFamily: "monospace", marginLeft: "auto" }}>
            {new Date(bracket.scheduled_time).toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "UTC",
            })}{" "}
            EVE
          </span>
        )}
        <button
          onClick={() => onSchedule(bracket.id)}
          style={{ marginLeft: bracket.scheduled_time ? 4 : "auto", background: "none", border: "none", cursor: "pointer", color: "var(--ev-muted)", fontSize: 11 }}
        >
          📅
        </button>
      </div>

      {/* Fighter rows */}
      {[e1, e2].map((e, i) => {
        if (!e) return (
          <div key={i} style={{ ...fighterRow, color: "var(--ev-muted)", fontStyle: "italic", fontSize: 12 }}>
            — TBD —
          </div>
        )
        const checkedIn = e.checked_in ?? false
        const isWinner = bracket.winner_id === e.id
        return (
          <div key={e.id} style={{
            ...fighterRow,
            background: isWinner ? "rgba(240,192,64,0.06)" : "transparent",
            border: isWinner ? "0.5px solid rgba(240,192,64,0.2)" : "0.5px solid transparent",
            borderRadius: 6,
            padding: "6px 8px",
            marginBottom: i === 0 ? 4 : 0,
            opacity: matchStatus === "complete" && !isWinner ? 0.45 : 1,
          }}>
            <Portrait url={e.portrait_url} name={e.character_name} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: isWinner ? GOLD : "var(--ev-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {e.character_name}
                {isWinner && <span style={{ color: GOLD, marginLeft: 8 }}>🏆</span>}
              </div>
              <div style={{ fontSize: 10, color: "var(--ev-muted)" }}>
                {e.corporation_name ?? "—"} · seed {e.seed ?? "?"}
              </div>
            </div>
            {matchStatus !== "complete" && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {checkedIn ? (
                  <span style={{ fontSize: 9, color: "#22c55e", fontFamily: "monospace" }}>✓ READY</span>
                ) : (
                  <span style={{ fontSize: 9, color: AMBER, fontFamily: "monospace" }}>AWAITING</span>
                )}
                <SmBtn
                  onClick={() => onCheckin(bracket.id, e.id, !checkedIn)}
                  variant={checkedIn ? "ghost" : "amber"}
                >
                  {checkedIn ? "Undo" : "✓ Ready"}
                </SmBtn>
              </div>
            )}
          </div>
        )
      })}

      {/* VS divider */}
      {matchStatus !== "complete" && (
        <div style={{ textAlign: "center", color: GOLD, fontSize: 11, fontFamily: "monospace", fontWeight: 700, margin: "4px 0" }}>
          VS
        </div>
      )}

      {/* Action bar */}
      {matchStatus !== "complete" && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {matchStatus === "pending" && (
            <>
              <SmBtn onClick={() => onStatusChange(bracket.id, "checkin")} variant="amber">
                ⏳ Open Check-in
              </SmBtn>
              <SmBtn onClick={() => onSchedule(bracket.id)} variant="ghost">
                📅 Schedule
              </SmBtn>
            </>
          )}
          {matchStatus === "checkin" && (
            <>
              <SmBtn
                onClick={() => {
                  const bothReady = (e1?.checked_in ?? false) && (e2?.checked_in ?? false)
                  if (!bothReady) {
                    if (!confirm("Not both fighters ready. Mark live anyway?")) return
                  }
                  onStatusChange(bracket.id, "live")
                }}
                variant="green"
              >
                ⚡ Mark Live
              </SmBtn>
              <SmBtn onClick={() => onStatusChange(bracket.id, "pending")} variant="ghost">
                ← Back
              </SmBtn>
            </>
          )}
          {matchStatus === "live" && (
            <>
              <SmBtn onClick={() => onResultEnter(bracket.id)} variant="gold">
                🏆 ENTER RESULT
              </SmBtn>
              {!forfeitExpanded && (
                <SmBtn onClick={() => setForfeitExpanded(true)} variant="danger">
                  ☠️ Forfeit
                </SmBtn>
              )}
              <SmBtn onClick={() => onStatusChange(bracket.id, "pending")} variant="ghost">
                🔄 Reset
              </SmBtn>
            </>
          )}
        </div>
      )}

      {/* Forfeit inline expansion */}
      {forfeitExpanded && matchStatus === "live" && !forfeitConfirm && (
        <div style={{ marginTop: 10, padding: "10px 12px", background: "rgba(239,68,68,0.06)", border: "1px solid #ef444433", borderRadius: 6 }}>
          <div style={{ fontSize: 11, color: "#ef4444", fontFamily: "monospace", marginBottom: 8 }}>Who is forfeiting?</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[e1, e2].map((e) => e && (
              <SmBtn key={e.id} onClick={() => setForfeitConfirm({ id: e.id, name: e.character_name })} variant="danger">
                {e.character_name}
              </SmBtn>
            ))}
            <SmBtn onClick={() => setForfeitExpanded(false)} variant="ghost">Cancel</SmBtn>
          </div>
        </div>
      )}
      {forfeitConfirm && (
        <div style={{ marginTop: 10, padding: "10px 12px", background: "rgba(239,68,68,0.06)", border: "1px solid #ef444433", borderRadius: 6 }}>
          <div style={{ fontSize: 12, color: "#ef4444", marginBottom: 8 }}>
            Confirm forfeit for <strong>{forfeitConfirm.name}</strong>? All bets will be voided.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <SmBtn onClick={() => { onForfeit(bracket.id, forfeitConfirm.id, forfeitConfirm.name); setForfeitExpanded(false); setForfeitConfirm(null) }} variant="danger">
              Yes ☠️
            </SmBtn>
            <SmBtn onClick={() => { setForfeitExpanded(false); setForfeitConfirm(null) }} variant="ghost">
              Cancel
            </SmBtn>
          </div>
        </div>
      )}

      {/* Complete state — killmail / override */}
      {matchStatus === "complete" && bracket.winner_id && (
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          {bracket.killmail_url ? (
            <a href={bracket.killmail_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: GOLD, textDecoration: "none", fontFamily: "monospace" }}>
              ⚔ View Kill
            </a>
          ) : (
            <SmBtn onClick={() => onResultEnter(bracket.id)} variant="ghost">🔗 Add Kill Link</SmBtn>
          )}
          <SmBtn onClick={() => onResultEnter(bracket.id)} variant="ghost">✏️ Override</SmBtn>
        </div>
      )}
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "0.5px solid rgba(200,150,12,0.2)",
  borderRadius: 8,
  padding: "12px 14px",
  marginBottom: 10,
}

const fighterRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
}

// ── MiniBracket ────────────────────────────────────────────────────────────

function MiniBracket({
  brackets,
  selectedBracketId,
  onSelect,
}: {
  brackets: BracketFull[]
  selectedBracketId: string | null
  onSelect: (id: string) => void
}) {
  const rounds = [...new Set(brackets.map((b) => b.round))].sort((a, b) => a - b)

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "flex", gap: 12 }}>
        {rounds.map((r) => (
          <div key={r} style={{ minWidth: 140 }}>
            <div style={{ fontSize: 9, color: "var(--ev-muted)", fontFamily: "monospace", letterSpacing: 1, marginBottom: 6, textAlign: "center" }}>
              ROUND {r}
            </div>
            {brackets.filter((b) => b.round === r).map((b) => {
              const complete = !!b.winner_id || b.is_bye
              const selected = b.id === selectedBracketId
              return (
                <div
                  key={b.id}
                  onClick={() => onSelect(b.id)}
                  style={{
                    background: selected ? "rgba(200,150,12,0.12)" : "rgba(255,255,255,0.03)",
                    border: `0.5px solid ${selected ? "var(--ev-gold)" : "rgba(200,150,12,0.15)"}`,
                    borderRadius: 6,
                    padding: "6px 8px",
                    marginBottom: 6,
                    cursor: "pointer",
                    opacity: complete && !selected ? 0.6 : 1,
                  }}
                >
                  {b.is_third_place && (
                    <div style={{ fontSize: 8, color: AMBER, fontFamily: "monospace", marginBottom: 2 }}>3RD PLACE</div>
                  )}
                  <div style={{ fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: b.winner_id === b.entrant1_id ? GOLD : "var(--ev-text)" }}>
                    {b.entrant1?.character_name ?? "TBD"}
                  </div>
                  <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "3px 0" }} />
                  <div style={{ fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: b.winner_id === b.entrant2_id ? GOLD : "var(--ev-text)" }}>
                    {b.entrant2?.character_name ?? b.is_bye ? "BYE" : "TBD"}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── ResultModal ────────────────────────────────────────────────────────────

function ResultModal({
  bracket,
  onClose,
  onSubmit,
}: {
  bracket: BracketFull
  onClose: () => void
  onSubmit: (winnerId: string, killmailUrl: string) => Promise<void>
}) {
  const [winnerId, setWinnerId] = useState(bracket.winner_id ?? "")
  const [killmailUrl, setKillmailUrl] = useState(bracket.killmail_url ?? "")
  const [loading, setLoading] = useState(false)
  const [noSelectionError, setNoSelectionError] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!winnerId) { setNoSelectionError(true); return }
    setNoSelectionError(false)
    setSubmitError(null)
    setLoading(true)
    try {
      await onSubmit(winnerId, killmailUrl)
      onClose()
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : "Failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#111", border: "1px solid var(--ev-gold)", borderRadius: 10, padding: 28, width: "100%", maxWidth: 420 }}>
        <div style={{ fontSize: 14, fontFamily: "monospace", fontWeight: 700, color: GOLD, marginBottom: 20 }}>
          Enter Match Result
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "var(--ev-muted)", marginBottom: 8, fontFamily: "monospace" }}>WINNER</div>
          {[bracket.entrant1, bracket.entrant2].map((e) => e && (
            <div
              key={e.id}
              onClick={() => { setWinnerId(e.id); setNoSelectionError(false) }}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", cursor: "pointer", borderRadius: 6,
                background: winnerId === e.id ? "rgba(240,192,64,0.08)" : "transparent",
                border: `1px solid ${winnerId === e.id ? "rgba(240,192,64,0.4)" : "transparent"}`,
                marginBottom: 6, transition: "all 0.12s",
              }}
            >
              <input type="radio" name="winner" value={e.id} checked={winnerId === e.id} onChange={() => { setWinnerId(e.id); setNoSelectionError(false) }} style={{ accentColor: GOLD }} />
              <Portrait url={e.portrait_url} name={e.character_name} size={28} />
              <span style={{ color: winnerId === e.id ? GOLD : "var(--ev-text)", fontSize: 13, fontWeight: winnerId === e.id ? 600 : 400 }}>{e.character_name}</span>
            </div>
          ))}
          {noSelectionError && (
            <div style={{ color: AMBER, fontSize: 11, fontFamily: "monospace", marginTop: 4 }}>Please select a winner</div>
          )}
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "var(--ev-muted)", marginBottom: 6, fontFamily: "monospace" }}>KILLMAIL URL (optional)</div>
          <input
            value={killmailUrl}
            onChange={(e) => setKillmailUrl(e.target.value)}
            placeholder="https://zkillboard.com/kill/..."
            style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(200,150,12,0.3)", borderRadius: 6, padding: "8px 10px", color: "var(--ev-text)", fontSize: 12, fontFamily: "monospace" }}
          />
        </div>
        {submitError && <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 12 }}>{submitError}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={handleSubmit} disabled={loading} style={{ flex: 1, background: "var(--ev-gold)", border: "none", borderRadius: 6, padding: "10px 0", fontFamily: "monospace", fontWeight: 700, fontSize: 13, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1, color: "#080500" }}>
            {loading ? "Saving..." : "Confirm Result"}
          </button>
          <button onClick={onClose} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, padding: "10px 16px", color: "var(--ev-muted)", cursor: "pointer", fontFamily: "monospace" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ScheduleModal ──────────────────────────────────────────────────────────

function ScheduleModal({
  bracketId,
  current,
  onClose,
  onSave,
}: {
  bracketId: string
  current: string | null
  onClose: () => void
  onSave: (time: string) => Promise<void>
}) {
  const toLocalInput = (utc: string | null) => {
    if (!utc) return ""
    const d = new Date(utc)
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
  }
  const [value, setValue] = useState(toLocalInput(current))
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    setLoading(true)
    try {
      await onSave(new Date(value + "Z").toISOString())
      onClose()
    } catch { /* ignore */ } finally { setLoading(false) }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#111", border: "1px solid var(--ev-gold)", borderRadius: 10, padding: 24, maxWidth: 360, width: "100%" }}>
        <div style={{ fontSize: 13, fontFamily: "monospace", color: GOLD, marginBottom: 16 }}>Schedule Match (EVE/UTC)</div>
        <input
          type="datetime-local"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(200,150,12,0.3)", borderRadius: 6, padding: "8px 10px", color: "var(--ev-text)", fontSize: 13 }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={handleSave} disabled={loading} style={{ flex: 1, background: "var(--ev-gold)", border: "none", borderRadius: 6, padding: "9px 0", fontFamily: "monospace", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", color: "#080500", opacity: loading ? 0.5 : 1 }}>
            {loading ? "Saving..." : "Save"}
          </button>
          <button onClick={onClose} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, padding: "9px 14px", color: "var(--ev-muted)", cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Props passed from server ───────────────────────────────────────────────

interface CommandCenterProps {
  tournament: Record<string, unknown>
  entrants: Record<string, unknown>[]
  brackets: Record<string, unknown>[]
  totalIskInPlay: number
  openPropCount: number
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function CommandCenterClient({
  tournament: initialTournament,
  entrants: initialEntrants,
  brackets: initialBrackets,
  totalIskInPlay,
  openPropCount,
}: CommandCenterProps) {
  const tournament = initialTournament as unknown as TFull
  const [entrants, setEntrants] = useState<EntrantFull[]>(initialEntrants as unknown as EntrantFull[])
  const [brackets, setBrackets] = useState<BracketFull[]>(initialBrackets as unknown as BracketFull[])

  // Match queue state — reads initial tab from URL hash
  function tabFromHash(): "queue" | "roster" | "betting" | "settings" {
    if (typeof window === "undefined") return tournament.status === "registration" ? "roster" : "queue"
    const h = window.location.hash.replace("#", "")
    if (h === "roster" || h === "betting" || h === "settings" || h === "queue") return h
    return tournament.status === "registration" ? "roster" : "queue"
  }
  const [activeTab, setActiveTab] = useState<"queue" | "roster" | "betting" | "settings">(tabFromHash)

  function changeTab(tab: "queue" | "roster" | "betting" | "settings") {
    setActiveTab(tab)
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${tab}`)
    }
  }
  const [selectedRound, setSelectedRound] = useState(tournament.current_round ?? 1)
  const [localStatuses, setLocalStatuses] = useState<Map<string, MatchStatus>>(new Map())
  const [selectedBracketId, setSelectedBracketId] = useState<string | null>(null)
  const [resultModal, setResultModal] = useState<BracketFull | null>(null)
  const [scheduleModal, setScheduleModal] = useState<{ bracketId: string; current: string | null } | null>(null)

  // Tournament meta state
  const [announcement, setAnnouncement] = useState(tournament.announcement ?? "")
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(tournament.name)

  // Roster add state
  const [addMode, setAddMode] = useState<"esi" | "manual">("esi")
  const [addName, setAddName] = useState("")
  const [addManualId, setAddManualId] = useState("")
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [addSuccess, setAddSuccess] = useState<string | null>(null)

  // Bracket preview / generate state
  const [generateLoading, setGenerateLoading] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [generateConfirm, setGenerateConfirm] = useState(false)
  const [drawType, setDrawType] = useState<"seeded" | "random">("seeded")

  // Manual bracket assignment state
  type SlotAssignment = { slotKey: string; entrantId: string | null }
  const [manualAssignment, setManualAssignment] = useState(false)
  const [slots, setSlots] = useState<SlotAssignment[]>([])
  const [slotPickerOpen, setSlotPickerOpen] = useState<string | null>(null)

  function initSlots() {
    const n = entrants.length
    const nextPow2 = (x: number) => { let p = 1; while (p < x) p *= 2; return p }
    const bracketSize = nextPow2(n)
    const matchCount = bracketSize / 2
    const byes = bracketSize - n
    const newSlots: SlotAssignment[] = []
    for (let m = 1; m <= matchCount; m++) {
      newSlots.push({ slotKey: `${m}-A`, entrantId: null })
      newSlots.push({ slotKey: `${m}-B`, entrantId: null })
    }
    // Top byes seeds auto-assigned as BYE
    for (let i = 0; i < byes; i++) {
      newSlots[i * 2].entrantId = "BYE"
    }
    setSlots(newSlots)
  }

  function assignSlot(slotKey: string, entrantId: string | null) {
    setSlots((prev) => prev.map((s) =>
      s.slotKey === slotKey ? { ...s, entrantId } :
      // Clear from other slot if same entrant was there
      (entrantId && entrantId !== "BYE" && s.entrantId === entrantId) ? { ...s, entrantId: null } : s
    ))
  }

  const assignedIds = slots.map((s) => s.entrantId).filter((id) => id && id !== "BYE")
  const unassignedEntrants = entrants.filter((e) => !assignedIds.includes(e.id))

  // Settings state
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null)
  const [settingFields, setSettingFields] = useState({
    name: tournament.name,
    announcement: tournament.announcement ?? "",
    scheduled_start: tournament.scheduled_start ?? "",
    minutes_per_match: tournament.minutes_per_match ?? 15,
    ship_class: tournament.ship_class ?? "",
    ship_restrictions: tournament.ship_restrictions ?? "",
    banned_ships: tournament.banned_ships ?? "",
    engagement_rules: tournament.engagement_rules ?? "",
    system_name: tournament.system_name ?? "",
    system_id: tournament.system_id ?? "",
    fitting_restrictions: tournament.fitting_restrictions ?? "",
    additional_rules: tournament.additional_rules ?? "",
    discord_webhook_url: tournament.discord_webhook_url ?? "",
  })

  // ── Derived ──────────────────────────────────────────────────────────────

  const rounds = [...new Set(brackets.map((b) => b.round))].sort((a, b) => a - b)
  const totalRounds = rounds.length > 0 ? Math.max(...rounds) : 0
  const roundBrackets = brackets.filter(
    (b) => b.round === selectedRound && !b.is_third_place
  )
  const roundComplete = roundBrackets.length > 0 &&
    roundBrackets.every((b) => b.winner_id || b.is_bye)

  const completedMatches = brackets.filter((b) => b.winner_id || b.is_bye).length
  const totalMatches = brackets.filter((b) => !b.is_third_place).length
  const roundTotal = roundBrackets.length
  const roundCompleted = roundBrackets.filter((b) => b.winner_id || b.is_bye).length

  // ── API helpers ──────────────────────────────────────────────────────────

  const refetchBrackets = useCallback(async () => {
    try {
      const res = await fetch(`/api/tournament/${tournament.id}/bracket`)
      if (!res.ok) return
      const data = await res.json() as { brackets: BracketFull[] }
      setBrackets(data.brackets)
      setLocalStatuses(new Map())
    } catch { /* non-critical — realtime will sync */ }
  }, [tournament.id])

  const handleStatusChange = useCallback(async (bracketId: string, status: MatchStatus) => {
    setLocalStatuses((prev) => new Map(prev).set(bracketId, status))
    // Update match_status in DB (requires schema migration)
    try {
      await fetch(`/api/admin/bracket/${bracketId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_status: status }),
      })
    } catch { /* non-fatal, local state persists */ }
  }, [])

  const handleResultEnter = useCallback((bracketId: string) => {
    const b = brackets.find((br) => br.id === bracketId)
    if (b) setResultModal(b)
  }, [brackets])

  const handleResultSubmit = useCallback(async (bracketId: string, winnerId: string, killmailUrl: string) => {
    console.log('Submitting result to API:', {
      url: `/api/tournament/${tournament.id}/advance`,
      bracketId,
      winnerId,
    })
    const res = await fetch(`/api/tournament/${tournament.id}/advance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bracketId, winnerId, ...(killmailUrl ? { killmailUrl } : {}) }),
    })
    if (!res.ok) {
      const d = await res.json() as { error?: string }
      throw new Error(d.error ?? "Failed to set result")
    }
    // Refetch from server — round advancement happens server-side in advanceWinner
    await refetchBrackets()
  }, [tournament.id, refetchBrackets])

  const handleForfeit = useCallback(async (bracketId: string, loserId: string) => {
    const b = brackets.find((br) => br.id === bracketId)
    if (!b) return
    const winnerId = b.entrant1_id === loserId ? b.entrant2_id : b.entrant1_id
    if (!winnerId) return
    await handleResultSubmit(bracketId, winnerId, "")
  }, [brackets, handleResultSubmit])

  const handleCheckin = useCallback(async (bracketId: string, entrantId: string, checked: boolean) => {
    // Optimistically update local entrant checked_in state
    setEntrants((prev) =>
      prev.map((e) => e.id === entrantId ? { ...e, checked_in: checked } : e)
    )
    // Also update in brackets
    setBrackets((prev) =>
      prev.map((b) => {
        if (b.id !== bracketId) return b
        return {
          ...b,
          entrant1: b.entrant1?.id === entrantId ? { ...b.entrant1, checked_in: checked } : b.entrant1,
          entrant2: b.entrant2?.id === entrantId ? { ...b.entrant2, checked_in: checked } : b.entrant2,
        }
      })
    )
    await fetch(`/api/admin/bracket/${bracketId}/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entrantId, checkedIn: checked }),
    })
  }, [])

  const handleScheduleSave = useCallback(async (bracketId: string, time: string) => {
    const res = await fetch(`/api/admin/bracket/${bracketId}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduled_time: time }),
    })
    if (!res.ok) throw new Error("Failed to schedule")
    setBrackets((prev) =>
      prev.map((b) => b.id === bracketId ? { ...b, scheduled_time: time } : b)
    )
  }, [])

  const handleAddEntrant = useCallback(async () => {
    setAddLoading(true)
    setAddError(null)
    setAddSuccess(null)
    try {
      const body = addMode === "esi"
        ? { characterName: addName, tournamentId: tournament.id }
        : { characterName: addName, characterId: parseInt(addManualId), tournamentId: tournament.id, manual: true }
      const res = await fetch("/api/admin/entrant/search-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const d = await res.json() as { entrant?: EntrantFull; error?: string }
      if (!res.ok) throw new Error(d.error ?? "Failed")
      const addedName = addName
      if (d.entrant) setEntrants((prev) => [...prev, d.entrant!])
      setAddName("")
      setAddManualId("")
      setAddSuccess(`✓ ${addedName} added`)
      setTimeout(() => setAddSuccess(null), 2000)
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : "Failed")
    } finally {
      setAddLoading(false) }
  }, [addMode, addName, addManualId, tournament.id])

  const handleRemoveEntrant = useCallback(async (entrantId: string, name: string) => {
    if (!confirm(`Remove ${name}?`)) return
    const res = await fetch(`/api/admin/entrant/${entrantId}/remove`, { method: "POST" })
    if (res.ok) setEntrants((prev) => prev.filter((e) => e.id !== entrantId))
  }, [])

  const handleRefreshStats = useCallback(async (entrantId: string) => {
    const res = await fetch(`/api/admin/entrant/${entrantId}/refresh-stats`, { method: "POST" })
    if (res.ok) {
      const d = await res.json() as { entrant?: EntrantFull }
      if (d.entrant) setEntrants((prev) => prev.map((e) => e.id === entrantId ? d.entrant! : e))
    }
  }, [])

  const handleRandomizeSeedOrder = useCallback(() => {
    const shuffled = [...entrants].sort(() => Math.random() - 0.5)
      .map((e, i) => ({ ...e, seed: i + 1 }))
    setEntrants(shuffled)
  }, [entrants])

  const handleSortByEfficiency = useCallback(() => {
    const sorted = [...entrants]
      .sort((a, b) => b.efficiency - a.efficiency)
      .map((e, i) => ({ ...e, seed: i + 1 }))
    setEntrants(sorted)
  }, [entrants])

  const handleGenerateBracket = useCallback(async () => {
    setGenerateLoading(true)
    setGenerateError(null)
    try {
      const res = await fetch(`/api/admin/tournament/${tournament.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draw_type: drawType }),
      })
      const d = await res.json() as { error?: string }
      if (!res.ok) throw new Error(d.error ?? "Generate failed")
      window.location.reload()
    } catch (e: unknown) {
      setGenerateError(e instanceof Error ? e.message : "Generate failed")
    } finally {
      setGenerateLoading(false)
      setGenerateConfirm(false)
    }
  }, [tournament.id, drawType])


  const handleSaveSettings = useCallback(async () => {
    setSettingsLoading(true)
    setSettingsError(null)
    setSettingsSuccess(null)
    try {
      const res = await fetch(`/api/admin/tournament/${tournament.id}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settingFields,
          system_id: settingFields.system_id ? Number(settingFields.system_id) : null,
          scheduled_start: settingFields.scheduled_start || null,
        }),
      })
      const d = await res.json() as { error?: string }
      if (!res.ok) throw new Error(d.error ?? "Save failed")
      setSettingsSuccess("Settings saved.")
    } catch (e: unknown) {
      setSettingsError(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSettingsLoading(false)
    }
  }, [settingFields, tournament.id])

  const handleAutoSchedule = useCallback(async () => {
    if (!settingFields.scheduled_start) { alert("Set a start time first"); return }
    const res = await fetch(`/api/admin/tournament/${tournament.id}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scheduledStart: new Date(settingFields.scheduled_start).toISOString(),
        minutesPerMatch: Number(settingFields.minutes_per_match) || 15,
      }),
    })
    if (res.ok) {
      const d = await res.json() as { updated?: number }
      alert(`Scheduled ${d.updated ?? 0} matches.`)
    }
  }, [settingFields, tournament.id])

  // ── Tab styles ───────────────────────────────────────────────────────────

  function tabStyle(t: string): React.CSSProperties {
    const active = activeTab === t
    return {
      background: active ? "rgba(200,150,12,0.12)" : "transparent",
      border: "none",
      borderBottom: active ? `2px solid var(--ev-gold)` : "2px solid transparent",
      color: active ? GOLD : "var(--ev-muted)",
      fontFamily: "monospace",
      fontSize: 12,
      fontWeight: active ? 700 : 400,
      letterSpacing: 1,
      padding: "10px 16px",
      cursor: "pointer",
      whiteSpace: "nowrap",
    }
  }

  function inputStyle(): React.CSSProperties {
    return {
      background: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(200,150,12,0.25)",
      borderRadius: 6,
      color: "var(--ev-text)",
      fontFamily: "monospace",
      fontSize: 12,
      padding: "7px 10px",
      width: "100%",
    }
  }

  function labelStyle(): React.CSSProperties {
    return {
      fontSize: 10,
      color: "var(--ev-muted)",
      fontFamily: "monospace",
      letterSpacing: 1,
      textTransform: "uppercase" as const,
      marginBottom: 4,
      display: "block",
    }
  }

  function section(title: string, children: React.ReactNode) {
    return (
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, color: AMBER, fontFamily: "monospace", letterSpacing: 2, textTransform: "uppercase", marginBottom: 14, paddingBottom: 6, borderBottom: "0.5px solid rgba(200,150,12,0.2)" }}>
          {title}
        </div>
        {children}
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ background: "var(--ev-bg)", minHeight: "100vh", color: "var(--ev-text)", fontFamily: "system-ui, sans-serif" }}>
      {/* TOP BAR */}
      <div style={{ padding: "20px 24px 0", maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <AdminBackButton />
          <Link href={`/tournament/${tournament.id}`} style={{ fontSize: 11, color: "var(--ev-muted)", fontFamily: "monospace", textDecoration: "none" }}>
            👁 View Public Page
          </Link>
        </div>

        {/* Tournament name */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 10 }}>
          {editingName ? (
            <input
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={async () => {
                setEditingName(false)
                await fetch(`/api/admin/tournament/${tournament.id}/update`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: nameValue }),
                })
              }}
              autoFocus
              style={{ ...inputStyle(), fontSize: 20, fontWeight: 700, fontFamily: "monospace", width: 320, color: GOLD }}
            />
          ) : (
            <h1
              onClick={() => setEditingName(true)}
              style={{ color: GOLD, fontSize: 20, fontFamily: "monospace", fontWeight: 700, margin: 0, cursor: "pointer" }}
              title="Click to edit"
            >
              {nameValue} ✏️
            </h1>
          )}
          <StatusBadge status={tournament.status} />
          {tournament.status !== "registration" && (
            <span style={{ fontSize: 11, color: "var(--ev-muted)", fontFamily: "monospace" }}>
              Round {selectedRound} of {totalRounds}
            </span>
          )}
        </div>

        {/* Quick stats */}
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 14, fontSize: 11, fontFamily: "monospace", color: "var(--ev-muted)" }}>
          <span>Pilots: {entrants.length}/{tournament.entrant_count}</span>
          {tournament.status === "active" && (
            <>
              <span>Matches (R{selectedRound}): {roundCompleted}/{roundTotal}</span>
              <span>ISK in Play: {formatISK(totalIskInPlay)}</span>
              <span>Open Props: {openPropCount}</span>
            </>
          )}
        </div>

        {/* Announcement banner */}
        {tournament.announcement && (
          <div style={{ background: "rgba(200,150,12,0.1)", border: "1px solid rgba(200,150,12,0.35)", borderRadius: 6, padding: "10px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 13, color: GOLD }}>📢 {tournament.announcement}</span>
            <button
              onClick={async () => {
                await fetch(`/api/admin/tournament/${tournament.id}/update`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ announcement: null }) })
                setAnnouncement("")
              }}
              style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--ev-muted)", cursor: "pointer", fontSize: 14 }}
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* TABS — always show all 4 */}
      <div style={{ borderBottom: "1px solid rgba(200,150,12,0.2)", padding: "0 24px", maxWidth: 1400, margin: "0 auto", display: "flex", gap: 0, overflowX: "auto" }}>
        <button style={tabStyle("queue")} onClick={() => changeTab("queue")}>⚔ MATCH QUEUE</button>
        <button style={tabStyle("roster")} onClick={() => changeTab("roster")}>👥 ROSTER</button>
        <button style={tabStyle("betting")} onClick={() => changeTab("betting")}>🎲 BETTING</button>
        <button style={tabStyle("settings")} onClick={() => changeTab("settings")}>⚙ SETTINGS</button>
      </div>

      <div style={{ padding: "24px", maxWidth: 1400, margin: "0 auto" }}>

        {/* ── TAB 1: MATCH QUEUE ─────────────────────────────────────────── */}
        {activeTab === "queue" && (
          <div>
            {tournament.status !== "active" ? (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <div style={{ fontSize: 14, color: "var(--ev-muted)", fontFamily: "monospace", marginBottom: 20 }}>
                  Tournament is in {tournament.status} state. Generate a bracket to start.
                </div>
                {tournament.status === "registration" && (
                  <button onClick={() => changeTab("roster")} style={{ background: "var(--ev-gold)", border: "none", borderRadius: 8, padding: "12px 28px", fontFamily: "monospace", fontWeight: 700, fontSize: 14, cursor: "pointer", color: "#080500" }}>
                    ⚔ Go to Roster Builder
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24 }}>

                {/* Left: Match Queue */}
                <div>
                  {/* Round tabs */}
                  <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
                    {rounds.filter((r) => {
                      const hasNonThirdPlace = brackets.some((b) => b.round === r && !b.is_third_place)
                      return hasNonThirdPlace
                    }).map((r) => {
                      const rComplete = brackets.filter((b) => b.round === r && !b.is_third_place).every((b) => b.winner_id || b.is_bye)
                      return (
                        <button
                          key={r}
                          onClick={() => setSelectedRound(r)}
                          style={{
                            background: selectedRound === r ? "rgba(200,150,12,0.15)" : "transparent",
                            border: `1px solid ${selectedRound === r ? "var(--ev-gold)" : "rgba(200,150,12,0.2)"}`,
                            borderRadius: 6,
                            color: selectedRound === r ? GOLD : "var(--ev-muted)",
                            fontFamily: "monospace",
                            fontSize: 11,
                            padding: "5px 12px",
                            cursor: "pointer",
                          }}
                        >
                          Round {r} {rComplete ? "✓" : ""}
                        </button>
                      )
                    })}
                  </div>

                  {/* Match cards */}
                  {roundBrackets.map((b) => (
                    <QueueMatchCard
                      key={b.id}
                      bracket={b}
                      matchStatus={derivedStatus(b, localStatuses.get(b.id))}
                      onStatusChange={handleStatusChange}
                      onResultEnter={handleResultEnter}
                      onForfeit={handleForfeit}
                      onCheckin={handleCheckin}
                      onSchedule={(id) => setScheduleModal({ bracketId: id, current: brackets.find((br) => br.id === id)?.scheduled_time ?? null })}
                    />
                  ))}

                  {/* Third place */}
                  {brackets.filter((b) => b.round === totalRounds && b.is_third_place).map((b) => (
                    <div key={b.id} style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 10, color: AMBER, fontFamily: "monospace", marginBottom: 6 }}>— 3RD PLACE MATCH —</div>
                      <QueueMatchCard
                        bracket={b}
                        matchStatus={derivedStatus(b, localStatuses.get(b.id))}
                        onStatusChange={handleStatusChange}
                        onResultEnter={handleResultEnter}
                        onForfeit={handleForfeit}
                        onCheckin={handleCheckin}
                        onSchedule={(id) => setScheduleModal({ bracketId: id, current: brackets.find((br) => br.id === id)?.scheduled_time ?? null })}
                      />
                    </div>
                  ))}

                  {/* Round complete indicator */}
                  {roundComplete && selectedRound < totalRounds && (
                    <div style={{ marginTop: 16, padding: "10px 16px", background: "rgba(34,197,94,0.06)", border: "1px solid #22c55e44", borderRadius: 8 }}>
                      <div style={{ fontSize: 12, color: "#22c55e", fontFamily: "monospace" }}>
                        ✓ All Round {selectedRound} matches complete — next round ready
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Mini bracket + round summary */}
                <div>
                  <div style={{ fontSize: 10, color: "var(--ev-muted)", fontFamily: "monospace", letterSpacing: 1, marginBottom: 10 }}>BRACKET OVERVIEW</div>
                  <MiniBracket
                    brackets={brackets}
                    selectedBracketId={selectedBracketId}
                    onSelect={(id) => {
                      setSelectedBracketId(id)
                      const b = brackets.find((br) => br.id === id)
                      if (b) setSelectedRound(b.round)
                    }}
                  />

                  {/* Round summary */}
                  <div style={{ marginTop: 16, padding: 14, background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(200,150,12,0.2)", borderRadius: 8 }}>
                    <div style={{ fontSize: 10, color: "var(--ev-muted)", fontFamily: "monospace", letterSpacing: 1, marginBottom: 10 }}>ROUND {selectedRound} SUMMARY</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontFamily: "monospace" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--ev-muted)" }}>Complete</span>
                        <span style={{ color: "#22c55e" }}>{roundCompleted}/{roundTotal}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--ev-muted)" }}>Pending</span>
                        <span>{roundTotal - roundCompleted}</span>
                      </div>
                    </div>
                  </div>

                  {/* Overall progress */}
                  <div style={{ marginTop: 10, padding: "8px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 6, fontSize: 11, fontFamily: "monospace", color: "var(--ev-muted)" }}>
                    Tournament: {completedMatches}/{totalMatches} matches complete
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: ROSTER BUILDER ──────────────────────────────────────── */}
        {activeTab === "roster" && (
          <div>
            {/* Add pilots section */}
            {section("Add Pilots", (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {/* Method A: ESI Search */}
                <div style={{ padding: 16, background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(200,150,12,0.2)", borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: GOLD, fontFamily: "monospace", letterSpacing: 1, marginBottom: 12 }}>ESI SEARCH</div>
                  <label style={labelStyle()}>Character Name</label>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <input
                      value={addMode === "esi" ? addName : ""}
                      onChange={(e) => { setAddMode("esi"); setAddName(e.target.value) }}
                      placeholder="Search character..."
                      style={inputStyle()}
                    />
                    <button
                      onClick={() => { setAddMode("esi"); handleAddEntrant() }}
                      disabled={addLoading || addMode !== "esi"}
                      style={{ background: "var(--ev-gold)", border: "none", borderRadius: 6, padding: "7px 14px", fontFamily: "monospace", fontWeight: 700, fontSize: 12, cursor: addLoading ? "not-allowed" : "pointer", color: "#080500", whiteSpace: "nowrap" }}
                    >
                      {addLoading && addMode === "esi" ? "Adding..." : "Search & Add"}
                    </button>
                  </div>
                  {addMode === "esi" && addError && <div style={{ color: "#ef4444", fontSize: 11 }}>{addError}</div>}
                  {addMode === "esi" && addSuccess && <div style={{ color: "#22c55e", fontSize: 11 }}>{addSuccess}</div>}
                </div>

                {/* Method B: Manual */}
                <div style={{ padding: 16, background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(200,150,12,0.2)", borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: AMBER, fontFamily: "monospace", letterSpacing: 1, marginBottom: 12 }}>MANUAL ENTRY</div>
                  <label style={labelStyle()}>Character Name</label>
                  <input value={addMode === "manual" ? addName : ""} onChange={(e) => { setAddMode("manual"); setAddName(e.target.value) }} placeholder="Character name" style={{ ...inputStyle(), marginBottom: 8 }} />
                  <label style={labelStyle()}>Character ID</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={addManualId} onChange={(e) => { setAddMode("manual"); setAddManualId(e.target.value) }} placeholder="EVE character ID" style={inputStyle()} />
                    <button
                      onClick={() => { setAddMode("manual"); handleAddEntrant() }}
                      disabled={addLoading || addMode !== "manual"}
                      style={{ background: "transparent", border: `1px solid ${AMBER}`, borderRadius: 6, padding: "7px 14px", fontFamily: "monospace", fontWeight: 700, fontSize: 12, cursor: addLoading ? "not-allowed" : "pointer", color: AMBER, whiteSpace: "nowrap" }}
                    >
                      {addLoading && addMode === "manual" ? "Adding..." : "Add Manually"}
                    </button>
                  </div>
                  {addMode === "manual" && addError && <div style={{ color: "#ef4444", fontSize: 11, marginTop: 8 }}>{addError}</div>}
                  {addMode === "manual" && addSuccess && <div style={{ color: "#22c55e", fontSize: 11, marginTop: 8 }}>{addSuccess}</div>}
                </div>
              </div>
            ))}

            {/* Pilot roster */}
            {section(`Registered Pilots (${entrants.length}/${tournament.entrant_count})`, (
              <div>
                {/* Sort controls */}
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <SmBtn onClick={handleRandomizeSeedOrder} variant="ghost">🎲 Randomize Order</SmBtn>
                  <SmBtn onClick={handleSortByEfficiency} variant="ghost">📊 Sort by Efficiency</SmBtn>
                </div>

                {/* Table */}
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: "0.5px solid rgba(200,150,12,0.2)" }}>
                        {["#", "Pilot", "Corp", "Seed", "30d K", "30d L", "Efficiency", "Actions"].map((h) => (
                          <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontFamily: "monospace", fontSize: 10, color: "var(--ev-muted)", letterSpacing: 1, whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {entrants.map((e, i) => (
                        <tr key={e.id} style={{ borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ padding: "8px 10px", color: "var(--ev-muted)", fontFamily: "monospace" }}>{i + 1}</td>
                          <td style={{ padding: "8px 10px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <Portrait url={e.portrait_url} name={e.character_name} size={28} />
                              <span style={{ color: "var(--ev-text)" }}>{e.character_name}</span>
                            </div>
                          </td>
                          <td style={{ padding: "8px 10px", color: "var(--ev-muted)", fontSize: 11 }}>{e.corporation_name ?? "—"}</td>
                          <td style={{ padding: "8px 10px", fontFamily: "monospace", color: GOLD }}>{e.seed ?? "—"}</td>
                          <td style={{ padding: "8px 10px", fontFamily: "monospace", color: "#22c55e" }}>{e.kills_30d}</td>
                          <td style={{ padding: "8px 10px", fontFamily: "monospace", color: "#ef4444" }}>{e.losses_30d}</td>
                          <td style={{ padding: "8px 10px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ width: 48, height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
                                <div style={{ width: `${(e.efficiency * 100).toFixed(0)}%`, height: "100%", background: e.efficiency >= 0.5 ? "#22c55e" : "#f59e0b" }} />
                              </div>
                              <span style={{ fontFamily: "monospace", color: "var(--ev-muted)" }}>{(e.efficiency * 100).toFixed(0)}%</span>
                            </div>
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            <div style={{ display: "flex", gap: 4 }}>
                              <SmBtn onClick={() => handleRefreshStats(e.id)} variant="ghost">🔄</SmBtn>
                              <SmBtn onClick={() => handleRemoveEntrant(e.id, e.character_name)} variant="danger">🗑️</SmBtn>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {/* Bracket generation */}
            {section("Generate Bracket", (
              <div>
                {tournament.status !== "registration" ? (
                  <div style={{ color: "var(--ev-muted)", fontSize: 12, fontFamily: "monospace" }}>
                    Bracket already generated — tournament is {tournament.status}.
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: 16 }}>
                      {(() => {
                        const n = entrants.length
                        const nextPow2 = (x: number) => { let p = 1; while (p < x) p *= 2; return p }
                        const bracketSize = nextPow2(n)
                        const byes = bracketSize - n
                        return (
                          <div style={{ fontSize: 12, color: "var(--ev-muted)", fontFamily: "monospace" }}>
                            {n} pilots registered · bracket size {bracketSize} · {byes} bye{byes !== 1 ? "s" : ""} will be assigned to top seeds
                          </div>
                        )
                      })()}
                    </div>
                    <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
                      <span style={{ fontSize: 11, color: "var(--ev-muted)", fontFamily: "monospace" }}>DRAW TYPE:</span>
                      {(["seeded", "random"] as const).map((dt) => (
                        <button
                          key={dt}
                          onClick={() => setDrawType(dt)}
                          style={{ background: drawType === dt ? "rgba(200,150,12,0.15)" : "transparent", border: `1px solid ${drawType === dt ? "var(--ev-gold)" : "rgba(200,150,12,0.2)"}`, borderRadius: 6, color: drawType === dt ? GOLD : "var(--ev-muted)", fontFamily: "monospace", fontSize: 11, padding: "5px 12px", cursor: "pointer", textTransform: "uppercase" }}
                        >
                          {dt}
                        </button>
                      ))}
                    </div>
                    {generateError && <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 10 }}>{generateError}</div>}
                    {!generateConfirm ? (
                      <button
                        onClick={() => { if (entrants.length < 4) { alert("Minimum 4 pilots required"); return } setGenerateConfirm(true) }}
                        disabled={entrants.length < 4}
                        style={{ background: "var(--ev-gold)", border: "none", borderRadius: 8, padding: "12px 28px", fontFamily: "monospace", fontWeight: 700, fontSize: 14, cursor: entrants.length < 4 ? "not-allowed" : "pointer", color: "#080500", opacity: entrants.length < 4 ? 0.4 : 1, width: "100%" }}
                      >
                        ⚔ GENERATE BRACKET & START TOURNAMENT
                      </button>
                    ) : (
                      <div style={{ padding: 16, background: "rgba(200,150,12,0.07)", border: "1px solid rgba(200,150,12,0.3)", borderRadius: 8 }}>
                        <div style={{ fontSize: 13, color: "var(--ev-text)", marginBottom: 14 }}>
                          Generate bracket for {entrants.length} pilots ({drawType})? This cannot be undone.
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                          <button onClick={handleGenerateBracket} disabled={generateLoading} style={{ background: "var(--ev-gold)", border: "none", borderRadius: 6, padding: "10px 20px", fontFamily: "monospace", fontWeight: 700, fontSize: 13, cursor: generateLoading ? "not-allowed" : "pointer", color: "#080500" }}>
                            {generateLoading ? "Generating..." : "Generate ⚔"}
                          </button>
                          <button onClick={() => setGenerateConfirm(false)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, padding: "10px 16px", color: "var(--ev-muted)", cursor: "pointer" }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}

            {/* Manual Bracket Slot Assignment */}
            {tournament.status === "registration" && section("Bracket Slot Assignment", (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <span style={{ fontSize: 11, color: "var(--ev-muted)", fontFamily: "monospace" }}>ASSIGNMENT MODE:</span>
                  {(["Auto (seed order)", "Manual assignment"] as const).map((label, i) => (
                    <button
                      key={label}
                      onClick={() => {
                        const isManual = i === 1
                        setManualAssignment(isManual)
                        if (isManual && slots.length === 0) initSlots()
                      }}
                      style={{ background: (i === 1) === manualAssignment ? "rgba(200,150,12,0.15)" : "transparent", border: `1px solid ${(i === 1) === manualAssignment ? "var(--ev-gold)" : "rgba(200,150,12,0.2)"}`, borderRadius: 6, color: (i === 1) === manualAssignment ? GOLD : "var(--ev-muted)", fontFamily: "monospace", fontSize: 11, padding: "5px 12px", cursor: "pointer" }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {manualAssignment && (
                  <div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 16 }}>
                      {/* Slot grid */}
                      <div>
                        <div style={{ fontSize: 10, color: "var(--ev-muted)", fontFamily: "monospace", letterSpacing: 1, marginBottom: 8 }}>
                          BRACKET SLOTS — drag pilots into position
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {Array.from({ length: slots.length / 2 }, (_, i) => i).map((m) => {
                            const slotA = slots.find((s) => s.slotKey === `${m + 1}-A`)
                            const slotB = slots.find((s) => s.slotKey === `${m + 1}-B`)
                            const entrantForSlot = (id: string | null | undefined) => {
                              if (!id) return null
                              if (id === "BYE") return null
                              return entrants.find((e) => e.id === id) ?? null
                            }
                            return (
                              <div key={m} style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(200,150,12,0.15)", borderRadius: 6, padding: "8px 12px" }}>
                                <div style={{ fontSize: 9, color: "var(--ev-muted)", fontFamily: "monospace", marginBottom: 6 }}>MATCH {m + 1}</div>
                                {[slotA, slotB].map((slot) => {
                                  if (!slot) return null
                                  const entrant = entrantForSlot(slot.entrantId)
                                  const isBye = slot.entrantId === "BYE"
                                  return (
                                    <div
                                      key={slot.slotKey}
                                      onClick={() => !isBye && setSlotPickerOpen(slot.slotKey)}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        padding: "5px 8px",
                                        marginBottom: 3,
                                        background: isBye ? "rgba(255,255,255,0.02)" : entrant ? "rgba(200,150,12,0.05)" : "rgba(255,255,255,0.01)",
                                        border: `0.5px solid ${slotPickerOpen === slot.slotKey ? "var(--ev-gold)" : "rgba(200,150,12,0.1)"}`,
                                        borderRadius: 4,
                                        cursor: isBye ? "default" : "pointer",
                                      }}
                                    >
                                      {isBye ? (
                                        <span style={{ fontSize: 10, color: "var(--ev-muted)", fontFamily: "monospace" }}>BYE</span>
                                      ) : entrant ? (
                                        <>
                                          <Portrait url={entrant.portrait_url} name={entrant.character_name} size={20} />
                                          <span style={{ fontSize: 11, color: "var(--ev-text)" }}>{entrant.character_name}</span>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); assignSlot(slot.slotKey, null) }}
                                            style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--ev-muted)", cursor: "pointer", fontSize: 12 }}
                                          >
                                            ×
                                          </button>
                                        </>
                                      ) : (
                                        <span style={{ fontSize: 10, color: "var(--ev-muted)", fontStyle: "italic" }}>— Empty Slot (click to assign) —</span>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Unassigned pilots sidebar */}
                      <div>
                        <div style={{ fontSize: 10, color: "var(--ev-muted)", fontFamily: "monospace", letterSpacing: 1, marginBottom: 8 }}>
                          UNASSIGNED ({unassignedEntrants.length})
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {unassignedEntrants.map((e) => (
                            <div
                              key={e.id}
                              onClick={() => { if (slotPickerOpen) { assignSlot(slotPickerOpen, e.id); setSlotPickerOpen(null) } }}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "5px 8px",
                                background: slotPickerOpen ? "rgba(200,150,12,0.08)" : "rgba(255,255,255,0.03)",
                                border: `0.5px solid ${slotPickerOpen ? "rgba(200,150,12,0.3)" : "rgba(255,255,255,0.06)"}`,
                                borderRadius: 4,
                                cursor: slotPickerOpen ? "pointer" : "default",
                                fontSize: 11,
                                color: "var(--ev-text)",
                              }}
                            >
                              <Portrait url={e.portrait_url} name={e.character_name} size={18} />
                              <span>{e.character_name}</span>
                            </div>
                          ))}
                          {unassignedEntrants.length === 0 && (
                            <div style={{ fontSize: 11, color: "#22c55e", fontFamily: "monospace" }}>✓ All pilots assigned</div>
                          )}
                        </div>
                        {slotPickerOpen && (
                          <div style={{ marginTop: 8, fontSize: 10, color: AMBER, fontFamily: "monospace" }}>
                            Selecting for slot {slotPickerOpen} — click a pilot above
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── TAB 3: BETTING ─────────────────────────────────────────────── */}
        {activeTab === "betting" && (
          <div>
            <BetManagementClient
              tournamentId={tournament.id}
              tournamentName={tournament.name}
              tournamentStatus={tournament.status}
            />
            <div style={{ marginTop: 32, borderTop: "0.5px solid rgba(200,150,12,0.15)", paddingTop: 24 }}>
              <div style={{ fontSize: 11, color: AMBER, fontFamily: "monospace", letterSpacing: 2, marginBottom: 16 }}>PROPOSITION BETS</div>
              <PropManagementSection
                tournaments={[{
                  id: tournament.id,
                  name: tournament.name,
                  status: tournament.status,
                }]}
                inputStyle={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(200,150,12,0.25)", borderRadius: 6, color: "var(--ev-text)", fontFamily: "monospace", fontSize: 12, padding: "7px 10px", width: "100%" }}
                labelStyle={{ fontSize: 10, color: "var(--ev-muted)", fontFamily: "monospace", letterSpacing: 1, textTransform: "uppercase" as const, marginBottom: 4, display: "block" }}
                subHeadStyle={{ fontSize: 11, color: AMBER, fontFamily: "monospace", letterSpacing: 1, textTransform: "uppercase" as const, marginBottom: 10 }}
                tinyBtnStyle={() => ({ background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4, padding: "3px 8px", fontSize: 10, color: "var(--ev-muted)", cursor: "pointer", fontFamily: "monospace" })}
              />
            </div>
          </div>
        )}

        {/* ── TAB 4: SETTINGS ────────────────────────────────────────────── */}
        {activeTab === "settings" && (
          <div style={{ maxWidth: 680 }}>
            {section("Basic Info", (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={labelStyle()}>Tournament Name</label>
                  <input value={settingFields.name} onChange={(e) => setSettingFields((p) => ({ ...p, name: e.target.value }))} style={inputStyle()} />
                </div>
                <div>
                  <label style={labelStyle()}>Announcement (shown as gold banner)</label>
                  <input value={settingFields.announcement} onChange={(e) => setSettingFields((p) => ({ ...p, announcement: e.target.value }))} placeholder="Leave blank to hide" style={inputStyle()} />
                </div>
              </div>
            ))}

            {section("Schedule", (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={labelStyle()}>Tournament Start (EVE/UTC)</label>
                  <input type="datetime-local" value={settingFields.scheduled_start ? settingFields.scheduled_start.replace("Z", "").slice(0, 16) : ""} onChange={(e) => setSettingFields((p) => ({ ...p, scheduled_start: e.target.value }))} style={inputStyle()} />
                </div>
                <div>
                  <label style={labelStyle()}>Minutes Per Match</label>
                  <input type="number" min={5} max={120} value={settingFields.minutes_per_match} onChange={(e) => setSettingFields((p) => ({ ...p, minutes_per_match: parseInt(e.target.value) || 15 }))} style={{ ...inputStyle(), width: 120 }} />
                </div>
                <button
                  onClick={handleAutoSchedule}
                  style={{ background: "transparent", border: "1px solid var(--ev-gold)", borderRadius: 6, padding: "8px 16px", fontFamily: "monospace", fontWeight: 600, fontSize: 12, cursor: "pointer", color: GOLD, width: "fit-content" }}
                >
                  Auto-populate Match Times
                </button>
              </div>
            ))}

            {section("Ship Rules", (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <label style={labelStyle()}>Ship Class</label>
                  <input value={settingFields.ship_class} onChange={(e) => setSettingFields((p) => ({ ...p, ship_class: e.target.value }))} placeholder="e.g. Frigates" style={inputStyle()} />
                </div>
                <div>
                  <label style={labelStyle()}>Allowed Ships</label>
                  <input value={settingFields.ship_restrictions} onChange={(e) => setSettingFields((p) => ({ ...p, ship_restrictions: e.target.value }))} style={inputStyle()} />
                </div>
                <div>
                  <label style={labelStyle()}>Banned Ships (comma-separated)</label>
                  <input value={settingFields.banned_ships} onChange={(e) => setSettingFields((p) => ({ ...p, banned_ships: e.target.value }))} style={inputStyle()} />
                </div>
                <div>
                  <label style={labelStyle()}>Engagement Rules</label>
                  <textarea value={settingFields.engagement_rules} onChange={(e) => setSettingFields((p) => ({ ...p, engagement_rules: e.target.value }))} rows={3} style={{ ...inputStyle(), resize: "vertical" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
                  <div>
                    <label style={labelStyle()}>System Name</label>
                    <input value={settingFields.system_name} onChange={(e) => setSettingFields((p) => ({ ...p, system_name: e.target.value }))} style={inputStyle()} />
                  </div>
                  <div>
                    <label style={labelStyle()}>System ID</label>
                    <input value={String(settingFields.system_id)} onChange={(e) => setSettingFields((p) => ({ ...p, system_id: e.target.value }))} style={{ ...inputStyle(), width: 120 }} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle()}>Fitting Restrictions</label>
                  <textarea value={settingFields.fitting_restrictions} onChange={(e) => setSettingFields((p) => ({ ...p, fitting_restrictions: e.target.value }))} rows={2} style={{ ...inputStyle(), resize: "vertical" }} />
                </div>
                <div>
                  <label style={labelStyle()}>Additional Rules</label>
                  <textarea value={settingFields.additional_rules} onChange={(e) => setSettingFields((p) => ({ ...p, additional_rules: e.target.value }))} rows={3} style={{ ...inputStyle(), resize: "vertical" }} />
                </div>
              </div>
            ))}

            {section("Discord Webhook", (
              <div>
                <label style={labelStyle()}>Webhook URL</label>
                <input value={settingFields.discord_webhook_url} onChange={(e) => setSettingFields((p) => ({ ...p, discord_webhook_url: e.target.value }))} placeholder="https://discord.com/api/webhooks/..." style={inputStyle()} />
              </div>
            ))}

            {/* Save button */}
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 40 }}>
              <button
                onClick={handleSaveSettings}
                disabled={settingsLoading}
                style={{ background: "var(--ev-gold)", border: "none", borderRadius: 8, padding: "11px 28px", fontFamily: "monospace", fontWeight: 700, fontSize: 13, cursor: settingsLoading ? "not-allowed" : "pointer", color: "#080500", opacity: settingsLoading ? 0.6 : 1 }}
              >
                {settingsLoading ? "Saving..." : "Save Settings"}
              </button>
              {settingsSuccess && <span style={{ color: "#22c55e", fontSize: 12, fontFamily: "monospace" }}>{settingsSuccess}</span>}
              {settingsError && <span style={{ color: "#ef4444", fontSize: 12 }}>{settingsError}</span>}
            </div>

            {section("⚠ Danger Zone", (
              <div style={{ padding: 16, border: "1px solid #ef444433", borderRadius: 8 }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    onClick={async () => {
                      if (!confirm("Delete this tournament? This cannot be undone.")) return
                      await fetch(`/api/admin/tournament/${tournament.id}/delete`, { method: "POST" })
                      window.location.href = "/admin"
                    }}
                    style={{ background: "transparent", border: "1px solid #ef4444", borderRadius: 6, padding: "8px 16px", color: "#ef4444", fontFamily: "monospace", fontSize: 12, cursor: "pointer" }}
                  >
                    🗑️ Delete Tournament
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {resultModal && (
        <ResultModal
          bracket={resultModal}
          onClose={() => setResultModal(null)}
          onSubmit={(winnerId, killmailUrl) => handleResultSubmit(resultModal.id, winnerId, killmailUrl)}
        />
      )}
      {scheduleModal && (
        <ScheduleModal
          bracketId={scheduleModal.bracketId}
          current={scheduleModal.current}
          onClose={() => setScheduleModal(null)}
          onSave={(time) => handleScheduleSave(scheduleModal.bracketId, time)}
        />
      )}

      {/* unused vars suppression */}
      {void announcement}
    </div>
  )
}
