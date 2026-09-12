export class HabitatAudio {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  wind: GainNode | null = null;
  rumble: GainNode | null = null;
  alarm: GainNode | null = null;
  klaxon: GainNode | null = null;
  heart: GainNode | null = null;
  lfo: OscillatorNode | null = null;
  lfoGain: GainNode | null = null;
  rumbleOsc: OscillatorNode | null = null;
  klaxonOsc: OscillatorNode | null = null;
  lastVoice = "";
  intensity = 0.2;

  ensure() {
    if (this.ctx) return;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.42;
    this.master.connect(ctx.destination);

    this.wind = ctx.createGain();
    this.wind.gain.value = 0.06;
    this.wind.connect(this.master);
    const noise = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buf;
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;
    noise.connect(filter);
    filter.connect(this.wind);
    noise.start();

    this.rumble = ctx.createGain();
    this.rumble.gain.value = 0;
    this.rumble.connect(this.master);
    const rumble = ctx.createOscillator();
    rumble.type = "sawtooth";
    rumble.frequency.value = 32;
    const rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = "lowpass";
    rumbleFilter.frequency.value = 90;
    rumble.connect(rumbleFilter);
    rumbleFilter.connect(this.rumble);
    rumble.start();
    this.rumbleOsc = rumble;

    this.alarm = ctx.createGain();
    this.alarm.gain.value = 0;
    this.alarm.connect(this.master);
    const o1 = ctx.createOscillator();
    o1.type = "square";
    o1.frequency.value = 780;
    const o2 = ctx.createOscillator();
    o2.type = "square";
    o2.frequency.value = 520;
    o1.connect(this.alarm);
    o2.connect(this.alarm);
    o1.start();
    o2.start();

    this.lfo = ctx.createOscillator();
    this.lfo.type = "square";
    this.lfo.frequency.value = 1.4;
    this.lfoGain = ctx.createGain();
    this.lfoGain.gain.value = 0;
    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.alarm.gain);
    this.lfo.start();

    this.klaxon = ctx.createGain();
    this.klaxon.gain.value = 0;
    this.klaxon.connect(this.master);
    const k = ctx.createOscillator();
    k.type = "sawtooth";
    k.frequency.value = 180;
    k.connect(this.klaxon);
    k.start();
    this.klaxonOsc = k;

    this.heart = ctx.createGain();
    this.heart.gain.value = 0;
    this.heart.connect(this.master);
    const h = ctx.createOscillator();
    h.type = "sine";
    h.frequency.value = 48;
    h.connect(this.heart);
    h.start();
  }

  setIntensity(n: number, dust: boolean, criticalHealth: boolean) {
    this.ensure();
    if (!this.wind || !this.alarm || !this.heart || !this.ctx || !this.master || !this.rumble || !this.klaxon) return;
    this.intensity = n;
    const t = this.ctx.currentTime;
    const fierce = Math.max(0, (n - 0.35) / 0.65);

    this.master.gain.linearRampToValueAtTime(0.38 + n * 0.5, t + 0.25);
    this.wind.gain.linearRampToValueAtTime(dust ? 0.22 + n * 0.12 : 0.05 + n * 0.16, t + 0.3);
    this.rumble.gain.linearRampToValueAtTime(0.04 + fierce * 0.28, t + 0.3);
    if (this.rumbleOsc) this.rumbleOsc.frequency.linearRampToValueAtTime(28 + fierce * 18, t + 0.4);

    const alarmLevel = n > 0.45 ? 0.02 + fierce * 0.09 : 0;
    this.alarm.gain.cancelScheduledValues(t);
    this.alarm.gain.setValueAtTime(this.alarm.gain.value, t);
    this.alarm.gain.linearRampToValueAtTime(alarmLevel, t + 0.2);
    if (this.lfo) this.lfo.frequency.linearRampToValueAtTime(1.2 + fierce * 6.5, t + 0.3);
    if (this.lfoGain) this.lfoGain.gain.linearRampToValueAtTime(alarmLevel * 0.85, t + 0.3);

    this.klaxon.gain.linearRampToValueAtTime(fierce > 0.55 ? 0.04 + fierce * 0.1 : 0, t + 0.25);
    if (this.klaxonOsc) this.klaxonOsc.frequency.linearRampToValueAtTime(140 + fierce * 90, t + 0.4);

    this.heart.gain.linearRampToValueAtTime(criticalHealth ? 0.1 + fierce * 0.12 : fierce * 0.03, t + 0.2);
  }

  click() {
    this.ensure();
    if (!this.ctx || !this.master) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.value = 1400;
    o.type = "triangle";
    g.gain.value = 0.12;
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
    const n = this.intensity;
    o.frequency.value = 420 + n * 180;
    o.type = "sawtooth";
    g.gain.value = 0.12 + n * 0.18;
    o.connect(g);
    g.connect(this.master);
    o.start();
    o.frequency.exponentialRampToValueAtTime(110, this.ctx.currentTime + 0.32);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.36);
    o.stop(this.ctx.currentTime + 0.38);
  }

  speak(text: string) {
    if (!text || text === this.lastVoice) return;
    this.lastVoice = text;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.94 - this.intensity * 0.08;
      u.pitch = 0.68 - this.intensity * 0.12;
      u.volume = Math.min(1, 0.85 + this.intensity * 0.15);
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
