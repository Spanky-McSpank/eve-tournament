"use client"

import { useState } from "react"
import { useTermsAccepted } from "@/hooks/useTermsAccepted"
import TermsGate from "@/components/ui/TermsGate"

export default function TermsGateWrapper({ children }: { children: React.ReactNode }) {
  const { hasAccepted, acceptTerms } = useTermsAccepted()

  // null = localStorage not yet checked (initial hydration)
  // Show a dark screen to match the terms gate background, avoiding any white flash
  if (hasAccepted === null) {
    return <div style={{ minHeight: "100vh", background: "#080808" }} />
  }

  if (!hasAccepted) {
    return <TermsGate onAccept={acceptTerms} />
  }

  return <>{children}</>
}
