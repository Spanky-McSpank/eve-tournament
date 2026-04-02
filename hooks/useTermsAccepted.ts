'use client'

import { useState, useEffect, useCallback } from 'react'

const TERMS_KEY = 'terms_accepted_v1'

export function useTermsAccepted(): {
  hasAccepted: boolean | null  // null = not yet checked (SSR/hydration)
  acceptTerms: () => void
} {
  const [hasAccepted, setHasAccepted] = useState<boolean | null>(null)

  useEffect(() => {
    try {
      setHasAccepted(localStorage.getItem(TERMS_KEY) === 'true')
    } catch {
      // localStorage unavailable — let them through
      setHasAccepted(true)
    }
  }, [])

  const acceptTerms = useCallback(() => {
    try { localStorage.setItem(TERMS_KEY, 'true') } catch { /* ignore */ }
    setHasAccepted(true)
  }, [])

  return { hasAccepted, acceptTerms }
}
