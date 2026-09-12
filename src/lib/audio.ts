export class HabitatAudio {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  wind: GainNode | null = null;
  alarm: GainNode | null = null;
  heart: GainNode | null = null;
  lastVoice = "";
  intensity = 0.2;

  ensure() {
    if (this.ctx) return;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.22;
    this.master.connect(ctx.destination);

    this.wind = ctx.createGain();
    this.wind.gain.value = 0.04;
    this.wind.connect(this.master);
    const noise = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buf;
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 480;
    noise.connect(filter);
    filter.connect(this.wind);
    noise.start();

    this.alarm = ctx.createGain();
    this.alarm.gain.value = 0;
    this.alarm.connect(this.master);
    const o1 = ctx.createOscillator();
    o1.type = "square";
    o1.frequency.value = 880;
    const o2 = ctx.createOscillator();
    o2.type = "square";
    o2.frequency.value = 640;
    o1.connect(this.alarm);
    o2.connect(this.alarm);
    o1.start();
    o2.start();

    this.heart = ctx.createGain();
    this.heart.gain.value = 0;
    this.heart.connect(this.master);
    const h = ctx.createOscillator();
    h.type = "sine";
    h.frequency.value = 52;
    h.connect(this.heart);
    h.start();
  }

  setIntensity(n: number, dust: boolean, criticalHealth: boolean) {
    this.ensure();
    if (!this.wind || !this.alarm || !this.heart || !this.ctx) return;
    this.intensity = n;
    const t = this.ctx.currentTime;
    this.wind.gain.linearRampToValueAtTime(dust ? 0.14 : 0.035 + n * 0.04, t + 0.3);
    this.alarm.gain.linearRampToValueAtTime(n > 0.7 ? 0.035 : 0, t + 0.2);
    this.heart.gain.linearRampToValueAtTime(criticalHealth ? 0.12 : 0, t + 0.2);
  }

  click() {
    this.ensure();
    if (!this.ctx || !this.master) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.value = 1400;
    o.type = "triangle";
    g.gain.value = 0.08;
    o.connect(g);
    g.connect(this.master);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
    o.stop(this.ctx.currentTime + 0.09);
  }

  warn() {
    this.ensure();
    if (!this.ctx || !this.master) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.value = 520;
    o.type = "sawtooth";
    g.gain.value = 0.06;
    o.connect(g);
    g.connect(this.master);
    o.start();
    o.frequency.exponentialRampToValueAtTime(220, this.ctx.currentTime + 0.25);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.28);
    o.stop(this.ctx.currentTime + 0.3);
  }

  speak(text: string) {
    if (!text || text === this.lastVoice) return;
    this.lastVoice = text;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.96;
      u.pitch = 0.72;
      u.volume = 0.9;
      const voices = window.speechSynthesis.getVoices();
      const pick =
        voices.find((v) => /en-GB|Daniel|Google UK/i.test(v.name + v.lang)) ||
        voices.find((v) => /en/i.test(v.lang));
      if (pick) u.voice = pick;
      window.speechSynthesis.speak(u);
    } catch {
      /* ignore */
    }
  }
}

export const habitatAudio = new HabitatAudio();
