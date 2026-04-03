"use client"

import { useTermsAccepted } from "@/hooks/useTermsAccepted"
import TermsGate from "@/components/ui/TermsGate"

export default function TermsGateWrapper({ children }: { children: React.ReactNode }) {
  const { hasAccepted, acceptTerms } = useTermsAccepted()

  if (!hasAccepted) {
    return <TermsGate onAccept={acceptTerms} />
  }

  return <>{children}</>
}
