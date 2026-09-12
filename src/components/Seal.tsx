import { CREW_META } from '@shared/content'
import type { ClientView, SealState } from '@shared/types'

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
          SOMETHING IS SIGNING AS YOU. SAY IT OUT LOUD — CHEN MUST SEND A ROTATE CARD. SHE HAS TO
          CARRY THE HARDWARE KEY TO COMMS.
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

/** Chen sends rotate cards; Vega walks the hardware key. This is just the reminder. */
export function RevokePanel(_props: { view: ClientView }) {
  return (
    <div className="revoke">
      <div className="tag" style={{ textAlign: 'center' }}>
        you do not rotate from here — send ROTATE ROOK / ROTATE IDRIS so she runs the token to Comms
      </div>
      <div className="tag" style={{ textAlign: 'center', opacity: 0.7 }}>
        {CREW_META.sparks.callsign} holds the only cards that open the registry
      </div>
    </div>
  )
}
