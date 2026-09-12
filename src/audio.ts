/** TRACK A — Xiao. Friend: do not edit. Astronaut / breaker speech. */

export function unlockAudio() {
  try {
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    speechSynthesis.speak(u)
  } catch {
    /* iOS may still block until a later tap */
  }
}

export function speak(text: string, voice: 'astronaut' | 'system') {
  if (!text.trim()) return
  try {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = voice === 'astronaut' ? 0.92 : 1.05
    u.pitch = voice === 'astronaut' ? 0.72 : 0.95
    const picked = pickVoice(voice)
    if (picked) u.voice = picked
    speechSynthesis.speak(u)
  } catch {
    /* no speech API */
  }
}

function pickVoice(kind: 'astronaut' | 'system') {
  const voices = speechSynthesis.getVoices()
  if (!voices.length) return null
  const en = voices.filter((v) => v.lang.startsWith('en'))
  const pool = en.length ? en : voices
  if (kind === 'astronaut') {
    return pool.find((v) => /male|daniel|david|fred/i.test(v.name)) ?? pool[0] ?? null
  }
  return pool.find((v) => /samantha|karen|zira|female/i.test(v.name)) ?? pool[0] ?? null
}

/**
 * Optional Grok Voice drop-in. Friend does not need this.
 * Set VITE_XAI_API_KEY when you have workshop access; until then we use
 * the browser speech API so both laptops work offline.
 */
export async function speakGrokOrBrowser(text: string, voice: 'astronaut' | 'system') {
  const key = import.meta.env.VITE_XAI_API_KEY as string | undefined
  if (key && import.meta.env.VITE_GROK_TTS_URL) {
    try {
      const res = await fetch(String(import.meta.env.VITE_GROK_TTS_URL), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ text, voice }),
      })
      if (res.ok) {
        const buf = await res.arrayBuffer()
        const ctx = new AudioContext()
        const audio = await ctx.decodeAudioData(buf)
        const src = ctx.createBufferSource()
        src.buffer = audio
        src.connect(ctx.destination)
        src.start()
        return
      }
    } catch {
      /* fall through */
    }
  }
  speak(text, voice)
}
