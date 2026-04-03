"use client"

import { useState } from "react"

interface TermsGateProps {
  onAccept: () => void
}

function GoldRule() {
  return (
    <div style={{
      height: 1,
      background: "linear-gradient(90deg, transparent, #C8960C 20%, #F0D878 50%, #C8960C 80%, transparent)",
    }} />
  )
}

function ArticleDivider() {
  return (
    <div style={{
      height: "0.5px",
      background: "linear-gradient(90deg, transparent, rgba(240,192,64,0.28) 50%, transparent)",
      margin: "22px 0",
    }} />
  )
}

function Particle({ style }: { style: React.CSSProperties }) {
  return (
    <div style={{
      position: "fixed",
      borderRadius: "50%",
      background: "#E8B020",
      pointerEvents: "none",
      zIndex: 9499,
      ...style,
    }} />
  )
}

const PARTICLES = [
  { bottom: "8%",  left: "7%",  size: 3, dur: "9s",   delay: "0s" },
  { bottom: "14%", left: "21%", size: 2, dur: "11s",  delay: "2s" },
  { bottom: "4%",  left: "37%", size: 4, dur: "8s",   delay: "1s" },
  { bottom: "19%", left: "54%", size: 2, dur: "12s",  delay: "3s" },
  { bottom: "7%",  left: "67%", size: 3, dur: "10s",  delay: "0.5s" },
  { bottom: "11%", left: "81%", size: 4, dur: "9.5s", delay: "1.5s" },
  { bottom: "2%",  left: "91%", size: 2, dur: "11s",  delay: "4s" },
  { bottom: "17%", left: "44%", size: 3, dur: "8.5s", delay: "2.5s" },
]

export default function TermsGate({ onAccept }: TermsGateProps) {
  const [accepting, setAccepting] = useState(false)
  const [exiting, setExiting] = useState(false)

  function handleAccept() {
    if (accepting) return
    setAccepting(true)
    setTimeout(() => {
      setExiting(true)
      setTimeout(onAccept, 420)
    }, 600)
  }

  return (
    <>
      <style>{`
        @keyframes termsCardIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes termsOverlayOut {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
        @keyframes termsGoldShimmer {
          0%, 100% { color: #F0D878; text-shadow: 0 0 24px rgba(240,192,64,0.35); }
          50%       { color: #E8B020; text-shadow: 0 0 40px rgba(240,192,64,0.65), 0 0 80px rgba(240,192,64,0.18); }
        }
        @keyframes termsDrift {
          0%   { transform: translateY(0) translateX(0) scale(1); opacity: 0.6; }
          60%  { opacity: 0.25; }
          100% { transform: translateY(-100vh) translateX(18px) scale(0.15); opacity: 0; }
        }
        @keyframes termsPulse {
          0%, 70%, 100% { box-shadow: 0 4px 20px rgba(240,192,64,0.22); }
          35%            { box-shadow: 0 4px 36px rgba(240,192,64,0.6), 0 0 0 4px rgba(240,192,64,0.12); }
        }
        @keyframes termsBtnFlash {
          0%   { background: linear-gradient(135deg, #C8960C 0%, #E8B020 100%); }
          40%  { background: linear-gradient(135deg, #ffffff 0%, #F0D878 100%); }
          100% { background: linear-gradient(135deg, #C8960C 0%, #E8B020 100%); }
        }
      `}</style>

      {PARTICLES.map((p, i) => (
        <Particle key={i} style={{
          bottom: p.bottom, left: p.left,
          width: p.size, height: p.size,
          animation: `termsDrift ${p.dur} ease-in ${p.delay} infinite`,
        }} />
      ))}

      {/* Full-screen overlay */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 9500,
        background: "#080808",
        backgroundImage: [
          "radial-gradient(ellipse at 50% 60%, rgba(240,192,64,0.06) 0%, transparent 70%)",
          "linear-gradient(rgba(200,150,12,0.025) 1px, transparent 1px)",
          "linear-gradient(90deg, rgba(200,150,12,0.025) 1px, transparent 1px)",
        ].join(", "),
        backgroundSize: "100% 100%, 32px 32px, 32px 32px",
        overflowY: "auto",
        display: "flex",
        justifyContent: "center",
        animation: exiting ? "termsOverlayOut 0.42s ease-in forwards" : "none",
      }}>
        {/* Card */}
        <div style={{
          maxWidth: 680, width: "100%",
          padding: "clamp(32px, 4vw, 64px) clamp(20px, 4vw, 40px) 56px",
          margin: "auto",
          animation: "termsCardIn 0.5s ease-out forwards",
        }}>

          <GoldRule />

          {/* Classified header */}
          <div style={{ textAlign: "center", padding: "22px 0 18px" }}>
            <div style={{
              fontSize: 10, fontFamily: "monospace", color: "#f59e0b",
              letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 22,
            }}>
              CLASSIFIED · EYES ONLY · DO NOT DISTRIBUTE
            </div>
            <div style={{
              fontFamily: "monospace", fontWeight: 700, letterSpacing: 4,
              fontSize: 13, color: "#666", textTransform: "uppercase", marginBottom: 10,
            }}>
              WELCOME TO
            </div>
            <div style={{
              fontFamily: "monospace", fontWeight: 700,
              fontSize: "clamp(22px, 3.5vw, 36px)",
              letterSpacing: "clamp(2px, 0.3vw, 5px)",
              textTransform: "uppercase",
              lineHeight: 1.15,
              marginBottom: 22,
              animation: "termsGoldShimmer 3s ease-in-out infinite",
            }}>
              THE PAGE THAT<br />WILL NOT BE NAMED
            </div>
            <div style={{ color: "#f59e0b", fontSize: 11, fontFamily: "monospace", letterSpacing: 2, marginTop: 6 }}>Presented by Bloodlust Tournaments</div>
          </div>

          <GoldRule />

          {/* Rules document */}
          <div style={{
            margin: "28px 0 24px",
            background: "rgba(240,192,64,0.018)",
            border: "0.5px solid rgba(240,192,64,0.2)",
            borderRadius: 10,
            padding: "clamp(20px, 3vw, 32px) clamp(18px, 3vw, 32px)",
          }}>

            {/* ARTICLE I */}
            <div>
              <div style={{ fontSize: 9, fontFamily: "monospace", color: "#f59e0b", letterSpacing: 2, marginBottom: 10, textTransform: "uppercase" }}>
                Article I
              </div>
              <div style={{ color: "#ccc", fontSize: 14, lineHeight: 1.65, marginBottom: 10 }}>
                The <span style={{ color: "#E8B020", fontWeight: 700 }}>FIRST</span> rule of Bloodlust Tournaments is:
              </div>
              <div style={{
                fontFamily: "monospace", fontWeight: 700,
                fontSize: "var(--font-xl)", color: "#E8B020",
                textTransform: "uppercase", lineHeight: 1.25,
              }}>
                YOU DO NOT TALK ABOUT<br />BLOODLUST TOURNAMENTS.
              </div>
            </div>

            <ArticleDivider />

            {/* ARTICLE II */}
            <div>
              <div style={{ fontSize: 9, fontFamily: "monospace", color: "#f59e0b", letterSpacing: 2, marginBottom: 10, textTransform: "uppercase" }}>
                Article II
              </div>
              <div style={{ color: "#ccc", fontSize: 14, lineHeight: 1.65, marginBottom: 10 }}>
                The <span style={{ color: "#E8B020", fontWeight: 700 }}>SECOND</span> rule of Bloodlust Tournaments is:
              </div>
              <div style={{
                background: "rgba(192,30,30,0.07)",
                borderRadius: 6, padding: "14px 18px",
              }}>
                <div style={{
                  fontFamily: "monospace", fontWeight: 700,
                  fontSize: "clamp(20px, 2.6vw, 30px)", color: "#E8B020",
                  textTransform: "uppercase", lineHeight: 1.25,
                  textShadow: "0 0 32px rgba(220,40,40,0.22)",
                }}>
                  YOU DO NOT TALK ABOUT<br />BLOODLUST TOURNAMENTS.
                </div>
              </div>
            </div>

            <ArticleDivider />

            {/* ARTICLE III */}
            <div>
              <div style={{ fontSize: 9, fontFamily: "monospace", color: "#f59e0b", letterSpacing: 2, marginBottom: 10, textTransform: "uppercase" }}>
                Article III · Escrow
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <span style={{ fontSize: 26, flexShrink: 0, marginTop: 1, color: "#E8B020" }}>⚖</span>
                <div style={{ color: "#ccc", fontSize: 14, lineHeight: 1.75 }}>
                  All bets are held in escrow by{" "}
                  <span style={{ color: "#E8B020", fontWeight: 700, fontFamily: "monospace" }}>
                    Wenchy The Destroyer
                  </span>
                  . Send your bet ISK to him only after your bet has been accepted and matched.
                </div>
              </div>
            </div>

            <ArticleDivider />

            {/* ARTICLE IV */}
            <div>
              <div style={{ fontSize: 9, fontFamily: "monospace", color: "#f59e0b", letterSpacing: 2, marginBottom: 10, textTransform: "uppercase" }}>
                Article IV · Forfeits
              </div>
              <div style={{ color: "#ccc", fontSize: 14, lineHeight: 1.65, marginBottom: 6 }}>
                In the event of a forfeit — the winner is the winner.
              </div>
              <div style={{ color: "#E8B020", fontWeight: 700, fontSize: 15, marginBottom: 5 }}>
                Pay up. Don&apos;t be a dick.
              </div>
              <div style={{ color: "#555", fontSize: 12 }}>
                This is supposed to be fun.
              </div>
            </div>

            <ArticleDivider />

            {/* ARTICLE V */}
            <div>
              <div style={{ fontSize: 9, fontFamily: "monospace", color: "#f59e0b", letterSpacing: 2, marginBottom: 10, textTransform: "uppercase" }}>
                Article V · Bet Limits
              </div>
              <div style={{
                fontFamily: "monospace", fontWeight: 700,
                fontSize: "clamp(20px, 2.6vw, 30px)", color: "#E8B020", marginBottom: 6,
              }}>
                100,000,000 ISK
              </div>
              <div style={{ color: "#ccc", fontSize: 14, marginBottom: 8 }}>
                Maximum honored bet per match.
              </div>
              <div style={{ color: "#555", fontSize: 12, lineHeight: 1.65 }}>
                All payments will be made to winners. If this becomes a hassle, we reserve the right
                to shut it all down. Don&apos;t make it a hassle.
              </div>
            </div>

            <ArticleDivider />

            {/* ARTICLE VI */}
            <div>
              <div style={{ fontSize: 9, fontFamily: "monospace", color: "#f59e0b", letterSpacing: 2, marginBottom: 10, textTransform: "uppercase" }}>
                Article VI · Operational Security
              </div>
              <div style={{ marginBottom: 12 }}>
                <span style={{
                  fontSize: 9, fontFamily: "monospace", letterSpacing: 1,
                  padding: "3px 9px", borderRadius: 3,
                  border: "1px solid #c0392b", color: "#c0392b",
                  background: "rgba(192,57,43,0.08)",
                }}>⚠ RESTRICTED</span>
              </div>
              <div style={{ color: "#fff", fontSize: 15, fontWeight: 700, lineHeight: 1.6, marginBottom: 6 }}>
                Do not share this link with anyone outside of the tournament.
              </div>
              <div style={{ color: "#555", fontSize: 12, fontStyle: "italic" }}>
                You know who you are. Keep it that way.
              </div>
            </div>
          </div>

          <GoldRule />

          {/* Disclaimer */}
          <div style={{
            textAlign: "center", padding: "20px 0 26px",
            color: "#555", fontSize: 12, lineHeight: 1.75,
          }}>
            By clicking below you acknowledge these terms and agree to abide by them.
            <br />Ignorance is not an excuse. Good luck, capsuleer.
          </div>
          <div style={{
            textAlign: "center", padding: "0 0 20px",
            color: "#b8860b", fontSize: 10, lineHeight: 1.7,
            fontStyle: "italic", fontFamily: "monospace",
          }}>
            This activity is not sanctioned by CCP Games or any alliance leadership.<br />
            Participation is entirely at your own discretion.<br />
            By continuing you accept full personal responsibility.
          </div>

          {/* Accept button */}
          <button
            onClick={handleAccept}
            disabled={accepting}
            style={{
              width: "100%",
              minHeight: "var(--btn-height)",
              background: "linear-gradient(135deg, #C8960C 0%, #E8B020 100%)",
              border: "none",
              borderRadius: "var(--border-radius)",
              color: "#080500",
              fontSize: "var(--font-lg)",
              fontWeight: 700,
              fontFamily: "monospace",
              letterSpacing: 2,
              cursor: accepting ? "default" : "pointer",
              animation: accepting ? "termsBtnFlash 0.5s ease-in-out forwards" : "termsPulse 3s ease-in-out infinite",
              textTransform: "uppercase",
            }}
          >
            ⚔ I ACCEPT — AND I&apos;LL KEEP MY MOUTH SHUT ⚔
          </button>

          {/* Footer */}
          <div style={{
            textAlign: "center", marginTop: 18,
            color: "#2a2a2a", fontSize: 9,
            fontFamily: "monospace", letterSpacing: 2,
          }}>
            BLOODLUST TOURNAMENTS · ESTABLISHED 2025
          </div>

        </div>
      </div>
    </>
  )
}
