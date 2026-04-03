"use client"

import { useEffect, useState, useCallback } from "react"

const RULES = [
  {
    num: "01",
    title: "YOU WILL SHOW UP",
    body: "If you register, you fight. No-shows forfeit their match and bring dishonor to their corporation. If something comes up, contact the tournament organizer before your scheduled match.",
  },
  {
    num: "02",
    title: "ONE SHIP. ONE PILOT.",
    body: "Each pilot registers and flies for themselves. No alts, no stand-ins, no exceptions. The character that registers is the character that fights.",
  },
  {
    num: "03",
    title: "THE KILLMAIL IS LAW",
    body: "Match results are determined by killmail submission. The pilot whose ship is destroyed loses. Pod kills do not count unless explicitly stated by the organizer.",
  },
  {
    num: "04",
    title: "AGREED SHIPS ONLY",
    body: "Fits and ship classes must comply with the tournament ruleset distributed before the event. Bringing an unauthorized hull is an automatic loss. When in doubt, ask first.",
  },
  {
    num: "05",
    title: "BETS ARE BINDING",
    body: "If you place or accept a bet on the Bookie Board, you owe that ISK when the match concludes. Refusing to pay a settled bet will get you banned from future events. Pay up.",
  },
  {
    num: "06",
    title: "NO OUTSIDE INTERFERENCE",
    body: "Third parties may not interfere with tournament matches. This includes cyno drops, intel networks, and third-party logi. Violations result in disqualification.",
  },
  {
    num: "07",
    title: "THE ORGANIZER DECIDES",
    body: "In any situation not covered by these rules, the tournament organizer has final say. Disputes are resolved by the organizer. Their decision is not subject to appeal.",
  },
]

function useRulesAccepted(tournamentId: string) {
  const key = `rules_accepted_${tournamentId}_v1`
  const [accepted, setAccepted] = useState<boolean | null>(null)

  useEffect(() => {
    try { setAccepted(localStorage.getItem(key) === "true") }
    catch { setAccepted(true) }
  }, [key])

  const accept = useCallback(() => {
    try { localStorage.setItem(key, "true") } catch {}
    setAccepted(true)
  }, [key])

  return { accepted, accept }
}

export default function RegistrationRulesGate({
  tournamentId,
  tournamentName,
  children,
}: {
  tournamentId: string
  tournamentName: string
  children: React.ReactNode
}) {
  const { accepted, accept } = useRulesAccepted(tournamentId)
  const [checked, setChecked] = useState(false)
  const [exiting, setExiting] = useState(false)

  if (accepted === null) {
    return <div style={{ minHeight: "100vh", background: "#080808" }} />
  }

  if (accepted) return <>{children}</>

  function handleAccept() {
    if (!checked) return
    setExiting(true)
    setTimeout(() => { accept() }, 420)
  }

  return (
    <>
      <style>{`
        @keyframes rulesOverlayOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes rulesCardIn {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes rulesGoldShimmer {
          0%, 100% { background-position: -200% center; }
          50% { background-position: 200% center; }
        }
      `}</style>
      <div style={{
        position: "fixed", inset: 0, zIndex: 9200,
        background: "rgba(8,5,0,0.96)",
        backdropFilter: "blur(2px)",
        overflowY: "auto",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "32px 16px 64px",
        animation: exiting ? "rulesOverlayOut 420ms ease forwards" : undefined,
      }}>
        <div style={{
          width: "100%", maxWidth: 560,
          animation: "rulesCardIn 500ms ease forwards",
        }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{
              fontSize: 9, fontFamily: "monospace", letterSpacing: 4,
              color: "#c0392b", marginBottom: 10, textTransform: "uppercase",
            }}>
              ⚠ READ BEFORE REGISTERING
            </div>
            <div style={{
              fontSize: "clamp(18px, 4vw, 26px)",
              fontFamily: "monospace", fontWeight: 700,
              background: "linear-gradient(90deg, #c8960c, #f0c040, #c8960c, #f0c040, #c8960c)",
              backgroundSize: "300% auto",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              animation: "rulesGoldShimmer 4s linear infinite",
              lineHeight: 1.2, marginBottom: 6,
            }}>
              TOURNAMENT RULES
            </div>
            <div style={{ color: "var(--ev-muted)", fontSize: 12, fontFamily: "monospace" }}>
              {tournamentName}
            </div>
          </div>

          {/* Rules list */}
          <div style={{
            maxHeight: "60vh", overflowY: "auto",
            display: "flex", flexDirection: "column", gap: 8,
            marginBottom: 20,
            paddingRight: 4,
          }}>
            {RULES.map((rule) => (
              <div key={rule.num} style={{
                background: "rgba(255,255,255,0.025)",
                border: "0.5px solid rgba(240,192,64,0.15)",
                borderLeft: "3px solid var(--ev-gold)",
                borderRadius: "0 6px 6px 0",
                padding: "12px 16px",
              }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 9, fontFamily: "monospace", color: "var(--ev-gold)", letterSpacing: 2, flexShrink: 0 }}>
                    ART. {rule.num}
                  </span>
                  <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 700, color: "var(--ev-champagne)" }}>
                    {rule.title}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--ev-muted)", lineHeight: 1.6, paddingLeft: 46 }}>
                  {rule.body}
                </div>
              </div>
            ))}
          </div>

          {/* Sticky accept footer */}
          <div style={{
            position: "sticky", bottom: 0,
            background: "linear-gradient(transparent, rgba(8,5,0,0.98) 30%)",
            paddingTop: 24, paddingBottom: 4,
          }}>
            <label style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              cursor: "pointer", marginBottom: 14,
              fontSize: 12, fontFamily: "monospace", color: "var(--ev-muted)",
              lineHeight: 1.5,
            }}>
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                style={{ width: 16, height: 16, flexShrink: 0, marginTop: 2, accentColor: "var(--ev-gold)", cursor: "pointer" }}
              />
              I have read and agree to the tournament rules. I understand that participation is binding and that the tournament organizer has final authority over all decisions.
            </label>

            <button
              onClick={handleAccept}
              disabled={!checked}
              style={{
                width: "100%",
                padding: "12px 0",
                background: checked ? "var(--ev-gold-light)" : "rgba(240,192,64,0.1)",
                border: checked ? "none" : "1px solid rgba(240,192,64,0.2)",
                borderRadius: 8,
                color: checked ? "var(--ev-bg)" : "rgba(240,192,64,0.3)",
                fontSize: 13, fontWeight: 700, fontFamily: "monospace",
                cursor: checked ? "pointer" : "not-allowed",
                transition: "all 0.2s",
                letterSpacing: 1,
              }}
            >
              {checked ? "I ACCEPT — PROCEED TO REGISTRATION" : "READ ALL RULES TO CONTINUE"}
            </button>
          </div>
        </div>
      </div>
      <div style={{ opacity: 0.15, pointerEvents: "none", userSelect: "none" }}>
        {children}
      </div>
    </>
  )
}
