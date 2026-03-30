'use client'

import { useEveAuth } from '@/hooks/useEveAuth'

// EVE Online diamond/cross logo SVG
function EveLogo() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M16 2L30 16L16 30L2 16L16 2Z"
        fill="white"
        fillOpacity="0.15"
        stroke="white"
        strokeWidth="1.5"
      />
      <path
        d="M16 7L25 16L16 25L7 16L16 7Z"
        fill="white"
        fillOpacity="0.4"
      />
      <line x1="16" y1="2" x2="16" y2="30" stroke="white" strokeWidth="1" strokeOpacity="0.6" />
      <line x1="2" y1="16" x2="30" y2="16" stroke="white" strokeWidth="1" strokeOpacity="0.6" />
    </svg>
  )
}

function Skeleton() {
  return (
    <div className="h-9 w-44 animate-pulse rounded bg-white/10" />
  )
}

export default function EveLoginButton() {
  const { character, isAuthenticated, isLoading, login, logout } = useEveAuth()

  if (isLoading) {
    return <Skeleton />
  }

  if (isAuthenticated && character) {
    const portraitUrl = `https://images.evetech.net/characters/${character.character_id}/portrait?size=64`

    return (
      <div className="flex items-center gap-2">
        <img
          src={portraitUrl}
          alt={character.character_name}
          width={32}
          height={32}
          className="rounded-full border border-white/20"
        />
        <span style={{ color: '#f0c040' }} className="text-sm font-medium">
          {character.character_name}
        </span>
        <button
          onClick={() => logout()}
          className="text-xs text-white/50 hover:text-white/80 transition-colors ml-1"
        >
          Logout
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={login}
      style={{ backgroundColor: '#000', color: '#fff', border: '1px solid #444' }}
      className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium hover:bg-white/10 transition-colors"
    >
      <EveLogo />
      Log in with EVE Online
    </button>
  )
}
