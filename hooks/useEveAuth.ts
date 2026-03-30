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
}

interface UseEveAuth extends AuthState {
  login: () => void
  logout: () => Promise<void>
}

export function useEveAuth(): UseEveAuth {
  const router = useRouter()
  const [state, setState] = useState<AuthState>({
    character: null,
    isAuthenticated: false,
    isAdmin: false,
    isLoading: true,
  })

  useEffect(() => {
    let cancelled = false

    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        setState({
          character: data.character ?? null,
          isAuthenticated: data.isAuthenticated ?? false,
          isAdmin: data.isAdmin ?? false,
          isLoading: false,
        })
      })
      .catch(() => {
        if (cancelled) return
        setState({ character: null, isAuthenticated: false, isAdmin: false, isLoading: false })
      })

    return () => { cancelled = true }
  }, [])

  const login = useCallback(() => {
    router.push('/api/auth/eve')
  }, [router])

  const logout = useCallback(async () => {
    await fetch('/api/auth/eve/logout', { method: 'POST' })
    setState({ character: null, isAuthenticated: false, isAdmin: false, isLoading: false })
    router.push('/')
  }, [router])

  return { ...state, login, logout }
}
