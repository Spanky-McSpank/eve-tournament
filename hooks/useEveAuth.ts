'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export interface EveCharacter {
  character_id: number
  character_name: string
  corporation_id: number
}

interface AuthState {
  character: EveCharacter | null
  isAuthenticated: boolean
  isAdmin: boolean
  isLoading: boolean
  showWelcome: boolean
}

interface UseEveAuth extends AuthState {
  login: (returnTo?: string) => void
  logout: () => Promise<void>
  dismissWelcome: () => void
}

export function useEveAuth(): UseEveAuth {
  const router = useRouter()
  const [state, setState] = useState<AuthState>({
    character: null,
    isAuthenticated: false,
    isAdmin: false,
    isLoading: true,
    showWelcome: false,
  })

  useEffect(() => {
    let cancelled = false

    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data: { character?: EveCharacter | null; isAuthenticated?: boolean; isAdmin?: boolean; showWelcome?: boolean }) => {
        if (cancelled) return
        let showWelcome = false
        if (data.showWelcome) {
          try {
            if (!localStorage.getItem('wenchy_welcomed')) {
              showWelcome = true
              localStorage.setItem('wenchy_welcomed', 'true')
            }
          } catch { /* localStorage unavailable */ }
        }
        setState({
          character: data.character ?? null,
          isAuthenticated: data.isAuthenticated ?? false,
          isAdmin: data.isAdmin ?? false,
          isLoading: false,
          showWelcome,
        })
      })
      .catch(() => {
        if (cancelled) return
        setState({ character: null, isAuthenticated: false, isAdmin: false, isLoading: false, showWelcome: false })
      })

    return () => { cancelled = true }
  }, [])

  const login = useCallback((returnTo?: string) => {
    const path = returnTo ?? (typeof window !== 'undefined' ? window.location.pathname : '/')
    router.push(`/api/auth/eve?returnTo=${encodeURIComponent(path)}`)
  }, [router])

  const logout = useCallback(async () => {
    await fetch('/api/auth/eve/logout', { method: 'POST' })
    setState({ character: null, isAuthenticated: false, isAdmin: false, isLoading: false, showWelcome: false })
    router.push('/')
  }, [router])

  const dismissWelcome = useCallback(() => {
    setState((prev) => ({ ...prev, showWelcome: false }))
  }, [])

  return { ...state, login, logout, dismissWelcome }
}
