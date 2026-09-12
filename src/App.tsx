import { useEffect, useRef, useState } from 'react'
import type { ClientView, StationId } from '@shared/types'
import { speak, unlockAudio } from './audio'
import { getSocket } from './net'
import { Debrief } from './screens/Debrief'
import { Home } from './screens/Home'
import { Lobby } from './screens/Lobby'
import { Play } from './screens/Play'

export default function App() {
  const [view, setView] = useState<ClientView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const role = useRef<StationId | null>(null)

  useEffect(() => {
    role.current = view?.you.role ?? null
  }, [view?.you.role])

  useEffect(() => {
    const s = getSocket()
    const onView = (next: ClientView) => setView(next)
    const onSpeak = (p: { text: string; voice: 'astronaut' | 'system' }) => {
      // Belt and braces: the server already refuses to send Vega audio.
      if (role.current === 'vega') return
      void speak(p.text, p.voice)
    }
    const onDrop = () => setError('Lost the hab. Reconnecting…')
    const onUp = () => setError(null)
    s.on('view', onView)
    s.on('speak', onSpeak)
    s.on('disconnect', onDrop)
    s.on('connect', onUp)
    return () => {
      s.off('view', onView)
      s.off('speak', onSpeak)
      s.off('disconnect', onDrop)
      s.off('connect', onUp)
    }
  }, [])

  if (!view) {
    return (
      <Home
        error={error}
        onReady={unlockAudio}
        onView={(v) => {
          setError(null)
          setView(v)
        }}
        onError={setError}
      />
    )
  }
  if (view.phase === 'lobby') return <Lobby view={view} error={error} onError={setError} />
  if (view.phase === 'end') return <Debrief view={view} />
  return <Play view={view} />
}
