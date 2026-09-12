/**
 * Ship voice. Never reaches Vega — the server refuses to send her speech events
 * at all, so this module is only ever running on the other three phones.
 *
 * If the host has an xAI key set, /api/voice returns real audio and we band-pass
 * it so it sounds like a suit radio. Without a key we fall back to the browser
 * speech engine, which needs no account and works offline.
 */

let ctx: AudioContext | null = null
let grokAvailable: boolean | null = null

function audioCtx(): AudioContext {
  ctx ??= new AudioContext()
  return ctx
}

export function unlockAudio() {
  try {
    const c = audioCtx()
    void c.resume()
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    speechSynthesis.speak(u)
  } catch {
    /* some browsers hold out until a later gesture */
  }
}

/** Short squelch click, so a transmission feels like a transmission. */
function squelch() {
  try {
    const c = audioCtx()
    const now = c.currentTime
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(1180, now)
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.07)
    gain.gain.setValueAtTime(0.05, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09)
    osc.connect(gain).connect(c.destination)
    osc.start(now)
    osc.stop(now + 0.1)
  } catch {
    /* not fatal */
  }
}

function browserSpeak(text: string, voice: 'astronaut' | 'system') {
  try {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = voice === 'astronaut' ? 0.95 : 1.08
    u.pitch = voice === 'astronaut' ? 0.75 : 1
    const voices = speechSynthesis.getVoices()
    const en = voices.filter((v) => v.lang.startsWith('en'))
    const pool = en.length ? en : voices
    const preferred =
      voice === 'astronaut'
        ? pool.find((v) => /daniel|david|male|fred|arthur/i.test(v.name))
        : pool.find((v) => /samantha|karen|zira|female|serena/i.test(v.name))
    if (preferred) u.voice = preferred
    speechSynthesis.speak(u)
  } catch {
    /* no speech engine */
  }
}

async function grokSpeak(text: string): Promise<boolean> {
  if (grokAvailable === false) return false
  try {
    const res = await fetch('/api/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) {
      if (res.status === 501) grokAvailable = false
      return false
    }
    grokAvailable = true
    const buf = await res.arrayBuffer()
    const c = audioCtx()
    const decoded = await c.decodeAudioData(buf)
    const src = c.createBufferSource()
    src.buffer = decoded
    // Suit-radio crunch: we own the buffer here, so we can actually filter it.
    const band = c.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 1650
    band.Q.value = 0.85
    const drive = c.createGain()
    drive.gain.value = 1.35
    src.connect(band).connect(drive).connect(c.destination)
    src.start()
    return true
  } catch {
    return false
  }
}

export async function speak(text: string, voice: 'astronaut' | 'system') {
  if (!text.trim()) return
  squelch()
  const done = await grokSpeak(text)
  if (!done) browserSpeak(text, voice)
}
