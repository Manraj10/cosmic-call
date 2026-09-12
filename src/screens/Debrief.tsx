import { useEffect, useState } from 'react'
import { CREW_META } from '@shared/content'
import { hearsSpeech } from '@shared/types'
import type { ClientView, IncidentReport, StationId } from '@shared/types'
import { speak } from '../audio'
import { forgetHab, getSocket, sendAction } from '../net'

/**
 * Mission Control reading the incident report back. The round is already graded
 * by the time this fires, so a slow or absent model costs a sentence and
 * nothing else — and with no key set the written line is what everyone hears.
 */
function useRadioDebrief(r: IncidentReport | null, won: boolean, role: StationId | null) {
  const [line, setLine] = useState<{ text: string; by: string } | null>(null)
  useEffect(() => {
    if (!r) return
    let live = true
    void fetch('/api/debrief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        won,
        delivered: r.delivered,
        forged: r.forged,
        replays: r.replays,
        obeyedUnsealed: r.obeyedUnsealed,
        stolenFrom: r.stolenFrom ? CREW_META[r.stolenFrom].callsign : null,
        timeToRevoke: r.timeToRevoke,
        falseRevokes: r.falseRevokes,
        wastedWalkSeconds: r.wastedWalkSeconds,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((j) => {
        if (!live || !j) return
        const said = j as { text: string; by: string }
        setLine(said)
        // Same rule as the round: Vega and the board are never sent a voice.
        if (hearsSpeech(role)) void speak(said.text, 'system')
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [r, won, role])
  return line
}

export function Debrief({ view }: { view: ClientView }) {
  const won = view.outcome === 'won'
  const radio = useRadioDebrief(view.incident, won, view.you.role)
  return (
    <div
      className="app stage"
      style={{ '--plate': 'url(/art/hero-hab.webp)' } as React.CSSProperties}
    >
      <div className="verdict">
        <div className="tag">{won ? 'far side of the corridor' : 'hab-7 went quiet'}</div>
        <div className={`head ${won ? 'v-ok' : 'v-danger'}`}>
          {won ? 'STILL BREATHING' : 'NOBODY MADE IT'}
        </div>
        <div className="why">
          {won
            ? 'You talked to each other, you got a message through, and you did not do what GHOST asked. That is the entire skill of this game.'
            : view.loseReason}
        </div>
      </div>

      {view.incident ? <Incident r={view.incident} radio={radio} /> : null}

      {!won ? (
        <div className="brief">
          Ask Vega what she actually saw. Nine times out of ten she was staring at a broken seal
          while three people screamed the right answer at her.
        </div>
      ) : null}

      <div className="grow" />
      {view.you.host ? (
        <Rematch />
      ) : (
        <div className="tag" style={{ textAlign: 'center' }}>
          waiting on the hab lead to run it again
        </div>
      )}
      <div className="tag" style={{ textAlign: 'center' }}>
        swap seats — everyone should get a turn as Vega
      </div>
      <button
        className="btn ghost"
        onClick={() => {
          forgetHab()
          location.reload()
        }}
      >
        leave hab
      </button>
    </div>
  )
}

/**
 * The after-action report, not a score.
 *
 * The three lines that decide whether the crew actually did the job are: how
 * many unsigned orders the operator executed, how long a stolen key stayed
 * live, and how many clean seats got rotated on a guess. Those are the numbers
 * a security team drills against, and they are the numbers people argue about
 * at the table afterwards, which is the whole reason the round ends here.
 */
function Incident({
  r,
  radio,
}: {
  r: IncidentReport
  radio: { text: string; by: string } | null
}) {
  const clean = r.obeyedUnsealed === 0
  return (
    <div className="incident">
      <div className="incident-head">
        <span>incident report</span>
        <span className="tag">HAB-7 comms bus</span>
      </div>
      <div className={`incident-grade ${clean ? 'v-ok' : 'v-danger'}`}>{r.grade}</div>
      <div className="incident-rows">
        <Row k="orders on the glass" v={r.delivered} />
        <Row k="written by GHOST" v={r.forged} />
        <Row k="replayed at you" v={r.replays} />
        <Row
          k="unsigned orders you executed"
          v={r.obeyedUnsealed}
          tone={r.obeyedUnsealed === 0 ? 'good' : 'bad'}
        />
        <Row
          k="key stolen from"
          v={r.stolenFrom ? CREW_META[r.stolenFrom].callsign : 'nobody'}
        />
        <Row
          k="time to revoke"
          v={r.timeToRevoke == null ? (r.stolenFrom ? 'never caught' : '—') : `${r.timeToRevoke}s`}
          tone={
            r.stolenFrom == null
              ? undefined
              : r.timeToRevoke == null
                ? 'bad'
                : r.timeToRevoke < 10
                  ? 'good'
                  : undefined
          }
        />
        <Row k="clean keys rotated on a guess" v={r.falseRevokes} />
        <Row
          k="seconds wasted on forged walks"
          v={r.wastedWalkSeconds}
          tone={r.wastedWalkSeconds === 0 ? 'good' : 'bad'}
        />
      </div>
      {radio ? (
        <div className="incident-radio">
          <span className="tag">mission control · written by {radio.by === 'hab' ? 'hab log' : radio.by}</span>
          <p>{radio.text}</p>
        </div>
      ) : null}
      <div className="incident-note">
        {r.stolenFrom == null
          ? 'Nobody lost a key this round.'
          : r.timeToRevoke == null
            ? `GHOST held ${CREW_META[r.stolenFrom].callsign}'s key until the end. Every order it signed looked genuine on her glass — the only tell was in ${CREW_META[r.stolenFrom].callsign}'s own signing log.`
            : `${CREW_META[r.stolenFrom].callsign} spotted orders signed under their key and said so, and comms rotated it in ${r.timeToRevoke}s.`}
        {r.wastedWalkSeconds > 0
          ? ` Forged orders walked Vega ${r.wastedWalkSeconds}s across the hab — seconds spent in a corridor instead of at a panel.`
          : r.forged > 0
            ? ' She did not take one step for GHOST.'
            : null}
      </div>
    </div>
  )
}

/**
 * The lead's button only. Everyone else follows the phase back to the lobby
 * with their seats kept, where a page reload used to drop the whole table on
 * the home screen to type the code again.
 */
function Rematch() {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  async function go() {
    setBusy(true)
    setNote(null)
    try {
      await sendAction({ type: 'rematch' })
    } catch (err) {
      // A Wi-Fi blip is not a dead hab. Reloading here would throw away a lobby
      // the whole table is still sitting in.
      if (!getSocket().connected) {
        setNote(err instanceof Error ? err.message : 'Radio offline.')
        return
      }
      // A reload rejoins the saved hab, which would land right back on this
      // screen. Forget it so the reload lands on home with a fresh code.
      try {
        forgetHab()
      } catch {
        // Storage is off, so there was nothing saved to rejoin.
      }
      location.reload()
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <button className="btn primary" disabled={busy} onClick={() => void go()}>
        run it again
      </button>
      {note ? <div className="notice">{note}</div> : null}
    </>
  )
}

function Row({ k, v, tone }: { k: string; v: string | number; tone?: 'good' | 'bad' }) {
  return (
    <div className={`irow${tone ? ` ${tone}` : ''}`}>
      <span className="ikey">{k}</span>
      <span className="ival">{v}</span>
    </div>
  )
}
