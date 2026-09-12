import { useEffect, useRef, useState } from 'react'
import type { ClientView, StationId } from '@shared/types'
import { speak, unlockAudio } from './audio'
import { HabGone, getSocket, restoreHab } from './net'
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
    const onView = (next: ClientView) => {
      role.current = next.you.role
      setView(next)
    }
    const onSpeak = (p: { text: string; voice: 'astronaut' | 'system' }) => {
      // Belt and braces: the server already refuses to send Vega audio.
      if (role.current === 'vega') return
      void speak(p.text, p.voice)
    }
    const onDrop = () => setError('Lost the hab. Reconnecting…')
    let active = true
    let retry: ReturnType<typeof setTimeout> | undefined
    const onUp = () => {
      clearTimeout(retry)
      void restoreHab().then((restored) => {
        if (!active) return
        if (restored) onView(restored)
        setError(null)
      }).catch((err: unknown) => {
        if (!active) return
        if (err instanceof HabGone) {
          setView(null)
          setError('That hab is gone. Enter a room code to join another.')
          return
        }
        // Bad Wi-Fi mid-round: keep the screen, keep the room, try again.
        setError('Lost the hab. Reconnecting…')
        retry = setTimeout(onUp, 2500)
      })
    }
    s.on('view', onView)
    s.on('speak', onSpeak)
    s.on('disconnect', onDrop)
    s.on('connect', onUp)
    if (s.connected) onUp()
    return () => {
      active = false
      clearTimeout(retry)
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
  return <>{error ? <div className="notice" role="alert">{error}</div> : null}<Play view={view} /></>
}
