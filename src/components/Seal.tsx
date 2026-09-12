import { CREW_META } from '@shared/content'
import type { ClientView, CrewId, SealState } from '@shared/types'
import { revokeKey } from '../net'

const WORD: Record<SealState, string> = {
  sealed: 'SEALED',
  broken: 'BROKEN SEAL',
  stale: 'OLD COUNTER',
}

const WHY: Record<SealState, string> = {
  sealed: 'signed by a real console — this is an order',
  broken: 'nobody signed this. it is not from your crew',
  stale: 'this order already ran once. it came back',
}

/**
 * The badge on the operator's glass. It is the only thing on her screen that
 * tells her whether to believe what she is looking at, so it gets more visual
 * weight than the order itself.
 */
export function SealBadge({ seal, tag, seq }: { seal: SealState; tag: string; seq: number }) {
  return (
    <div className={`seal seal-${seal}`}>
      <div className="seal-word">{WORD[seal]}</div>
      <div className="seal-why">{WHY[seal]}</div>
      <div className="seal-meta">
        <span>
          tag <b>{tag}</b>
        </span>
        <span>
          seq <b>{seq}</b>
        </span>
      </div>
    </div>
  )
}

/**
 * A crew console's own outgoing log.
 *
 * This exists for one moment in the round. After GHOST steals a key, the
 * operator's glass starts calling its forgeries genuine, and the only evidence
 * anywhere in the game is a line in here that the person reading it knows they
 * did not press. They cannot send that fact to the operator — it has to be
 * said out loud, to whoever is sitting at comms.
 */
export function KeyLog({ view }: { view: ClientView }) {
  const seal = view.seal
  if (!seal) return null
  const stolen = seal.log.some((e) => !e.mine)

  return (
    <div className={`keylog${stolen ? ' compromised' : ''}`}>
      <div className="keylog-head">
        <span className="tag">signing log · key #{seal.epoch}</span>
        <span className="tag">next seq {seal.nextSeq}</span>
      </div>
      {stolen ? (
        <div className="keyalarm">
          SOMETHING IS SIGNING AS YOU. SAY IT OUT LOUD — COMMS HAS TO ROTATE YOUR KEY.
        </div>
      ) : null}
      <div className="keyrows">
        {seal.log.length === 0 ? (
          <div className="keyrow quiet">nothing signed yet</div>
        ) : (
          seal.log
            .slice()
            .reverse()
            .map((e) => (
              <div key={`${e.seq}-${e.signal}`} className={`keyrow${e.mine ? '' : ' notmine'}`}>
                <span className="kseq">#{e.seq}</span>
                <span className="ksig">{e.signal}</span>
                <span className="kwho">{e.mine ? 'you' : 'NOT YOU'}</span>
              </div>
            ))
        )}
      </div>
    </div>
  )
}

/**
 * Comms owns the key registry, so comms owns revocation. Rotating the right
 * seat throws GHOST off the bus; rotating a clean one voids that console's
 * in-flight tag and costs the table a call, which is what stops this from
 * being a button you just mash.
 */
export function RevokePanel({ view }: { view: ClientView }) {
  const seats = view.canRevoke
  if (!seats) return null
  const wait = view.revokeCooldownMs ?? 0
  const locked = wait > 0

  return (
    <div className="revoke">
      <div className="tag" style={{ textAlign: 'center' }}>
        {locked
          ? `registry writing — ${(wait / 1000).toFixed(1)}s`
          : 'key registry — rotate the seat they are signing as'}
      </div>
      <div className="revoke-row">
        {seats.map((s) => (
          <button
            key={s}
            className="rev"
            disabled={locked}
            onClick={() => void revokeKey(s).catch(() => {})}
            style={{ '--accent': accent(s) } as React.CSSProperties}
          >
            <span className="rname">{CREW_META[s].callsign}</span>
            <span className="rwhat">rotate key</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function accent(s: CrewId): string {
  return CREW_META[s].accent
}
