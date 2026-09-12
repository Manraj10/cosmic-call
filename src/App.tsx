/** SHARED GLUE — only touch if the socket protocol changes. */

import { useEffect, useRef, useState } from 'react'
import type { ClientView, StationId } from '@shared/types'
import { speakGrokOrBrowser, unlockAudio } from './audio'
import { getSocket } from './net'
import { Home } from './screens/Home'
import { Lobby } from './screens/Lobby'
import { Play } from './screens/Play'

export default function App() {
  const [view, setView] = useState<ClientView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const roleRef = useRef<StationId | null>(null)

  useEffect(() => {
    roleRef.current = view?.you.role ?? null
  }, [view?.you.role])

  useEffect(() => {
    const s = getSocket()
    const onView = (next: ClientView) => setView(next)
    const onSpeak = (packet: { text: string; voice: 'astronaut' | 'system' }) => {
      if (roleRef.current === 'oxygen') return
      void speakGrokOrBrowser(packet.text, packet.voice)
    }
    s.on('view', onView)
    s.on('speak', onSpeak)
    return () => {
      s.off('view', onView)
      s.off('speak', onSpeak)
    }
  }, [])

  if (!view) {
    return (
      <Home
        error={error}
        onReady={() => unlockAudio()}
        onView={(v) => {
          setError(null)
          setView(v)
        }}
        onError={setError}
      />
    )
  }

  if (view.phase === 'lobby') {
    return <Lobby view={view} onError={setError} error={error} />
  }

  return <Play view={view} />
}
