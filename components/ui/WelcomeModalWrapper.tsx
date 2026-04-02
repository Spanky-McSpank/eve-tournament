"use client"

import { useEveAuth } from "@/hooks/useEveAuth"
import WelcomeModal from "./WelcomeModal"

export default function WelcomeModalWrapper() {
  const { showWelcome, dismissWelcome } = useEveAuth()
  if (!showWelcome) return null
  return <WelcomeModal onClose={dismissWelcome} />
}
