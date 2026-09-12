type Handler = (payload: unknown) => void;
type Wire = { event: string; data: unknown };

class GameSocket {
  handlers = new Map<string, Set<Handler>>();
  queue: { event: string; data?: unknown }[] = [];
  room: string | null = null;
  sid: string | null = null;
  alive = false;
  pollTimer: ReturnType<typeof setTimeout> | null = null;

  on(event: string, fn: Handler) {
    const set = this.handlers.get(event) || new Set();
    set.add(fn);
    this.handlers.set(event, set);
  }

  off(event: string, fn: Handler) {
    this.handlers.get(event)?.delete(fn);
  }

  private fire(event: string, payload: unknown) {
    this.handlers.get(event)?.forEach((fn) => fn(payload));
  }

  private ingest(messages: Wire[] | undefined) {
    for (const m of messages || []) this.fire(m.event, m.data);
  }

  private url(op: string, extra = "") {
    const t = Date.now();
    return `/sync/${encodeURIComponent(this.room || "")}/${op}?v=poll1&t=${t}${extra}`;
  }

  private async get(url: string) {
    return fetch(url, { cache: "no-store", credentials: "same-origin" });
  }

  connect(room: string) {
    this.disconnect();
    this.room = room.toUpperCase();
    this.alive = true;
    void this.hello();
  }

  private async hello() {
    let last = "radio";
    for (let i = 0; i < 3; i++) {
      try {
        const res = await this.get(this.url("hello"));
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { sid?: string };
        if (!body.sid) throw new Error("no sid");
        if (!this.alive) return;
        this.sid = body.sid;
        const pending = this.queue;
        this.queue = [];
        for (const m of pending) await this.emit(m.event, m.data);
        this.fire("open", null);
        this.loop();
        return;
      } catch (err) {
        last = err instanceof Error ? err.message : "radio";
        if (!this.alive) return;
        await new Promise((r) => setTimeout(r, 400 * (i + 1)));
        if (!this.alive) return;
      }
    }
    this.fire("error_msg", `Habitat radio link failed (${last}). Try CREATE again.`);
  }

  private loop() {
    if (!this.alive || !this.sid) return;
    this.pollTimer = setTimeout(() => {
      void this.poll();
    }, 220);
  }

  private async poll() {
    if (!this.alive || !this.sid) return;
    try {
      const res = await this.get(this.url("poll", `&sid=${encodeURIComponent(this.sid)}`));
      if (res.ok) {
        const body = (await res.json()) as { messages?: Wire[] };
        this.ingest(body.messages);
      }
    } catch {
      /* next tick */
    }
    this.loop();
  }

  async emit(event: string, data?: unknown) {
    if (!this.sid || !this.room) {
      this.queue.push({ event, data });
      return;
    }
    const d = encodeURIComponent(JSON.stringify(data ?? {}));
    const extra = `&sid=${encodeURIComponent(this.sid)}&e=${encodeURIComponent(event)}&d=${d}`;
    try {
      const res = await this.get(this.url("in", extra));
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { messages?: Wire[] };
      this.ingest(body.messages);
    } catch {
      this.fire("error_msg", "Habitat radio link failed. Try CREATE again.");
    }
  }

  disconnect() {
    this.alive = false;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
    if (this.sid && this.room) {
      void this.get(this.url("bye", `&sid=${encodeURIComponent(this.sid)}`));
    }
    this.sid = null;
    this.queue = [];
  }
}

let socket: GameSocket | null = null;

export function getSocket() {
  if (!socket) socket = new GameSocket();
  return socket;
}
