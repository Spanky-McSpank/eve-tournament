'use client'

import { useState, useCallback } from 'react'

export function useTermsAccepted(): {
  hasAccepted: boolean
  acceptTerms: () => void
} {
  const [hasAccepted, setHasAccepted] = useState(false)
  const acceptTerms = useCallback(() => { setHasAccepted(true) }, [])
  return { hasAccepted, acceptTerms }
}
