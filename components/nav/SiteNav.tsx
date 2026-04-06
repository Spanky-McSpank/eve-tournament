"use client"

import Link from "next/link"
import { usePathname, useParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { useEveAuth } from "@/hooks/useEveAuth"
import EveLoginButton from "@/components/ui/EveLoginButton"

function useTournamentName(tournamentId: string | null): string | null {
  const [name, setName] = useState<string | null>(null)
  useEffect(() => {
    if (!tournamentId) { setName(null); return }
    let cancelled = false
    fetch(`/api/tournament/${tournamentId}/info`)
      .then((r) => r.ok ? r.json() : null)
      .then((d: { tournament?: { name?: string } } | null) => {
        if (!cancelled) setName(d?.tournament?.name ?? null)
      })
      .catch(() => { if (!cancelled) setName(null) })
    return () => { cancelled = true }
  }, [tournamentId])
  return name
}

const crumbLink: React.CSSProperties = {
  color: "var(--ev-champagne)",
  textDecoration: "none",
}

function DropdownItem({
  href,
  children,
  onClick,
}: {
  href: string
  children: React.ReactNode
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={href}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "block",
        padding: "9px 16px",
        color: hovered ? "var(--ev-champagne)" : "var(--ev-muted)",
        background: hovered ? "rgba(200,150,12,0.10)" : "transparent",
        textDecoration: "none",
        fontFamily: "monospace",
        fontSize: 12,
        letterSpacing: 0.5,
        transition: "color 0.12s, background 0.12s",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </Link>
  )
}

export default function SiteNav() {
  const pathname = usePathname()
  const params = useParams()
  const { isAdmin } = useEveAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  // Extract tournament ID when on any /tournament/[id] or /admin/tournament/[id] route
  const tournamentId = (params?.id as string) ?? null
  const tournamentName = useTournamentName(tournamentId)

  // Close dropdown on outside click or Escape
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDropdownOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("mousedown", handleClick)
      document.removeEventListener("keydown", handleKey)
    }
  }, [])

  // Build context breadcrumb
  let breadcrumb: React.ReactNode = null
  if (tournamentId && tournamentName) {
    const onBracket = pathname?.includes("/bracket")
    const onBets = pathname?.includes("/bets")
    const onStats = pathname?.includes("/stats")
    const tournamentLink = (
      <Link href={`/tournament/${tournamentId}`} style={crumbLink}>
        {tournamentName}
      </Link>
    )
    if (onBracket) {
      breadcrumb = <span>{tournamentLink}{" › "}<span style={{ color: "var(--ev-text)" }}>⚔ Bracket</span></span>
    } else if (onBets) {
      breadcrumb = <span>{tournamentLink}{" › "}<span style={{ color: "var(--ev-text)" }}>🎲 Bookie Board</span></span>
    } else if (onStats) {
      breadcrumb = <span>{tournamentLink}{" › "}<span style={{ color: "var(--ev-text)" }}>📊 Stats</span></span>
    } else {
      breadcrumb = tournamentLink
    }
  }

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 200,
        background: "rgba(15,15,15,0.97)",
        borderBottom: "1.5px solid var(--ev-gold)",
        height: 52,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Left — logo */}
      <Link
        href="/"
        style={{
          fontFamily: "monospace",
          fontWeight: 700,
          fontSize: 13,
          letterSpacing: 2,
          color: "var(--ev-champagne)",
          textDecoration: "none",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        ⚔ BLOODLUST TOURNAMENTS
      </Link>

      {/* Center — context breadcrumb */}
      <div
        style={{
          flex: 1,
          textAlign: "center",
          fontFamily: "monospace",
          fontSize: 12,
          color: "var(--ev-muted)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          padding: "0 20px",
        }}
      >
        {breadcrumb}
      </div>

      {/* Right — admin dropdown + login */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        {isAdmin && (
          <div ref={dropRef} style={{ position: "relative" }}>
            <button
              onClick={() => setDropdownOpen((o) => !o)}
              style={{
                background: dropdownOpen
                  ? "rgba(200,150,12,0.18)"
                  : "rgba(200,150,12,0.07)",
                border: "1px solid var(--ev-gold)",
                borderRadius: "var(--border-radius)",
                color: "var(--ev-champagne)",
                fontFamily: "monospace",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1,
                padding: "5px 12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                whiteSpace: "nowrap",
              }}
            >
              ⚙ COMMAND CENTER {dropdownOpen ? "▲" : "▾"}
            </button>

            {dropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  background: "#111",
                  border: "1px solid var(--ev-gold)",
                  borderRadius: "var(--border-radius)",
                  overflow: "hidden",
                  zIndex: 300,
                  minWidth: 220,
                }}
              >
                <DropdownItem href="/admin" onClick={() => setDropdownOpen(false)}>
                  📋 All Tournaments
                </DropdownItem>
                {tournamentId && (
                  <>
                    <DropdownItem
                      href={`/admin/tournament/${tournamentId}`}
                      onClick={() => setDropdownOpen(false)}
                    >
                      ⚔ Manage This Tournament
                    </DropdownItem>
                    <DropdownItem
                      href={`/admin/tournament/${tournamentId}/bets`}
                      onClick={() => setDropdownOpen(false)}
                    >
                      💰 Bet Management
                    </DropdownItem>
                    <div
                      style={{
                        height: 1,
                        background: "rgba(200,150,12,0.2)",
                        margin: "4px 0",
                      }}
                    />
                  </>
                )}
                <DropdownItem href="/admin#create" onClick={() => setDropdownOpen(false)}>
                  ➕ New Tournament
                </DropdownItem>
              </div>
            )}
          </div>
        )}
        <EveLoginButton />
      </div>
    </nav>
  )
}
