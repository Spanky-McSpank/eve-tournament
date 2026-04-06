'use client'

import { useState, useEffect, useCallback } from 'react'

export function useTermsAccepted(): {
  hasAccepted: boolean | null
  acceptTerms: () => void
} {
  const [hasAccepted, setHasAccepted] = useState<boolean | null>(null)

  useEffect(() => {
    setHasAccepted(localStorage.getItem('terms_accepted_v1') === 'true')
  }, [])

  const acceptTerms = useCallback(() => {
    localStorage.setItem('terms_accepted_v1', 'true')
    setHasAccepted(true)
  }, [])

  return { hasAccepted, acceptTerms }
}
