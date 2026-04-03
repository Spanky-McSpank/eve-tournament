"use client"

import { useEffect, useState } from "react"

interface WelcomeModalProps {
  onClose: () => void
}

function GoldParticle({ style }: { style: React.CSSProperties }) {
  return (
    <div style={{
      position: "absolute",
      width: 4, height: 4,
      borderRadius: "50%",
      background: "var(--ev-gold-light)",
      opacity: 0.7,
      animation: "wenchyFloat 2.4s ease-in infinite",
      ...style,
    }} />
  )
}

export default function WelcomeModal({ onClose }: WelcomeModalProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Trigger animation on mount
    const t = setTimeout(() => setVisible(true), 16)
    return () => clearTimeout(t)
  }, [])

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 300)
  }

  return (
    <>
      <style>{`
        @keyframes wenchyIn {
          from { opacity: 0; transform: scale(0.8); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes wenchyOut {
          from { opacity: 1; transform: scale(1); }
          to   { opacity: 0; transform: scale(0.92); }
        }
        @keyframes wenchyFloat {
          0%   { transform: translateY(0) scale(1); opacity: 0.7; }
          100% { transform: translateY(-80px) scale(0.3); opacity: 0; }
        }
        @keyframes wenchyShimmer {
          0%, 100% { color: #F0D878; }
          50%       { color: #E8B020; text-shadow: 0 0 16px rgba(240,192,64,0.6); }
        }
      `}</style>

      {/* Overlay */}
      <div style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.85)",
        zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "opacity 0.3s",
        opacity: visible ? 1 : 0,
      }}>
        {/* Card */}
        <div style={{
          position: "relative",
          background: "linear-gradient(160deg, #0D1420 0%, #111B2E 100%)",
          border: "1.5px solid var(--ev-gold-light)",
          borderRadius: 16,
          padding: "48px 40px 40px",
          maxWidth: 480,
          width: "90%",
          textAlign: "center",
          boxShadow: "0 0 48px rgba(240,192,64,0.18), 0 0 8px rgba(240,192,64,0.08)",
          animation: visible ? "wenchyIn 0.3s ease-out forwards" : "wenchyOut 0.3s ease-in forwards",
          overflow: "hidden",
        }}>
          {/* Corner accents */}
          <div style={{ position: "absolute", top: 10, left: 10, width: 16, height: 16, borderTop: "2px solid var(--ev-gold)", borderLeft: "2px solid var(--ev-gold)" }} />
          <div style={{ position: "absolute", top: 10, right: 10, width: 16, height: 16, borderTop: "2px solid var(--ev-gold)", borderRight: "2px solid var(--ev-gold)" }} />
          <div style={{ position: "absolute", bottom: 10, left: 10, width: 16, height: 16, borderBottom: "2px solid var(--ev-gold)", borderLeft: "2px solid var(--ev-gold)" }} />
          <div style={{ position: "absolute", bottom: 10, right: 10, width: 16, height: 16, borderBottom: "2px solid var(--ev-gold)", borderRight: "2px solid var(--ev-gold)" }} />

          {/* Particles */}
          <GoldParticle style={{ bottom: 20, left: "15%", animationDelay: "0s" }} />
          <GoldParticle style={{ bottom: 20, left: "35%", animationDelay: "0.4s" }} />
          <GoldParticle style={{ bottom: 20, left: "55%", animationDelay: "0.8s" }} />
          <GoldParticle style={{ bottom: 20, left: "75%", animationDelay: "1.2s" }} />
          <GoldParticle style={{ bottom: 20, left: "90%", animationDelay: "0.6s" }} />

          {/* Skull */}
          <div style={{ fontSize: 56, marginBottom: 16, lineHeight: 1 }}>☠️</div>

          {/* Title */}
          <div style={{
            fontFamily: "monospace", fontWeight: 700, letterSpacing: 3,
            fontSize: 22, marginBottom: 8,
            animation: "wenchyShimmer 2s ease-in-out infinite",
          }}>
            WELCOME, WENCHY THE DESTROYER
          </div>

          {/* Subtitle */}
          <div style={{
            color: "#d4aa40", fontFamily: "monospace",
            fontSize: 15, marginBottom: 24, letterSpacing: 1,
          }}>
            You degenerate gambler.
          </div>

          {/* Body */}
          <div style={{
            color: "var(--ev-text)", fontFamily: "monospace",
            fontSize: 13, lineHeight: 1.8,
            background: "rgba(0,0,0,0.3)",
            border: "0.5px solid rgba(255,255,255,0.06)",
            borderRadius: 8, padding: "16px 20px",
            marginBottom: 28, textAlign: "left",
          }}>
            The bookie board is yours to manage.<br />
            Try not to lose all your ISK on the first round.<br />
            Good luck. You&apos;ll need it.<br />
            <br />
            <span style={{ color: "var(--ev-muted)" }}>— The Management</span><br />
            <br />
            <span style={{ color: "var(--ev-muted)" }}>P.S. We know about the bees.</span>
          </div>

          {/* CTA */}
          <button
            onClick={handleClose}
            style={{
              background: "linear-gradient(135deg, var(--ev-gold) 0%, var(--ev-gold-light) 100%)",
              color: "#080500",
              border: "none",
              borderRadius: 8,
              padding: "14px 40px",
              fontSize: 15,
              fontWeight: 700,
              fontFamily: "monospace",
              letterSpacing: 2,
              cursor: "pointer",
              boxShadow: "0 4px 16px rgba(240,192,64,0.3)",
            }}
          >
            LET&apos;S GO ⚔ 🐝
          </button>
        </div>
      </div>
    </>
  )
}
