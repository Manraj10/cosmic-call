type Handler = (payload: unknown) => void;
type Wire = { event: string; data: unknown };

const POLL_WAIT_MS = 8000;
const HELLO_TRIES = 8;

class GameSocket {
  handlers = new Map<string, Set<Handler>>();
  queue: { event: string; data?: unknown }[] = [];
  room: string | null = null;
  sid: string | null = null;
  alive = false;
  gen = 0;
  pollTimer: ReturnType<typeof setTimeout> | null = null;
  abort: AbortController | null = null;

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
    return `/sync/${encodeURIComponent(this.room || "")}/${op}?v=poll2${extra}`;
  }

  private async get(url: string) {
    this.abort = new AbortController();
    return fetch(url, {
      cache: "no-store",
      credentials: "same-origin",
      signal: this.abort.signal,
    });
  }

  connect(room: string) {
    this.disconnect();
    this.room = room.toUpperCase();
    this.alive = true;
    this.gen += 1;
    void this.hello();
  }

  private async hello() {
    const gen = this.gen;
    let last = "radio";
    for (let i = 0; i < HELLO_TRIES; i++) {
      if (!this.alive || this.gen !== gen) return;
      try {
        const res = await this.get(this.url("hello"));
        const body = await readJson(res);
        if (isChallenge(res, body)) {
          last = "challenge";
          this.fire(
            "error_msg",
            "Cloudflare is checking this browser. Wait a moment — if it keeps failing, hard-refresh, then JOIN again.",
          );
          await sleep(1800 + i * 700);
          continue;
        }
        if (!res.ok || !body || typeof body !== "object" || !("sid" in body) || !body.sid) {
          last = String(res.status);
          throw new Error(last);
        }
        if (!this.alive || this.gen !== gen) return;
        this.sid = String(body.sid);
        const pending = this.queue;
        this.queue = [];
        for (const m of pending) await this.emit(m.event, m.data);
        this.fire("open", null);
        this.loop();
        return;
      } catch (err) {
        last = err instanceof Error ? err.message : "radio";
        if (!this.alive || this.gen !== gen) return;
        await sleep(400 * (i + 1));
      }
    }
    this.fire("error_msg", `Habitat radio link failed (${last}). Try CREATE or JOIN again.`);
  }

  private loop() {
    if (!this.alive || !this.sid) return;
    this.pollTimer = setTimeout(() => {
      void this.poll();
    }, 60);
  }

  private async poll() {
    if (!this.alive || !this.sid) return;
    const gen = this.gen;
    try {
      const res = await this.get(
        this.url("poll", `&sid=${encodeURIComponent(this.sid)}&wait=${POLL_WAIT_MS}`),
      );
      if (!this.alive || this.gen !== gen) return;
      const body = await readJson(res);
      if (isChallenge(res, body)) {
        this.fire(
          "error_msg",
          "Cloudflare challenged the radio. Waiting, then retrying — hard-refresh if this repeats.",
        );
        await sleep(2500);
        if (!this.alive || this.gen !== gen) return;
        await this.hello();
        return;
      }
      if (res.status === 400) {
        await this.hello();
        return;
      }
      if (res.ok && body && typeof body === "object" && "messages" in body) {
        this.ingest((body as { messages?: Wire[] }).messages);
      }
    } catch (err) {
      if (!this.alive || this.gen !== gen) return;
      const msg = err instanceof Error ? err.message : "";
      if (msg === "challenge") {
        await sleep(2500);
        if (!this.alive || this.gen !== gen) return;
        await this.hello();
        return;
      }
    }
    if (!this.alive || this.gen !== gen) return;
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
      const body = await readJson(res);
      if (isChallenge(res, body)) {
        this.fire(
          "error_msg",
          "Cloudflare challenged the radio. Hard-refresh, then try that action again.",
        );
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      this.ingest((body as { messages?: Wire[] } | null)?.messages);
    } catch {
      this.fire("error_msg", "Habitat radio link failed. Try CREATE or JOIN again.");
    }
  }

  disconnect() {
    this.alive = false;
    this.gen += 1;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
    this.abort?.abort();
    this.abort = null;
    if (this.sid && this.room) {
      const url = this.url("bye", `&sid=${encodeURIComponent(this.sid)}`);
      void fetch(url, { cache: "no-store", credentials: "same-origin" });
    }
    this.sid = null;
    this.queue = [];
  }
}

async function readJson(res: Response): Promise<Record<string, unknown> | null> {
  const ct = res.headers.get("content-type") || "";
  const text = await res.text();
  if (!ct.includes("json")) {
    if (res.status === 403 || res.status === 429) {
      throw new Error("challenge");
    }
    return null;
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    if (res.status === 403 || res.status === 429) throw new Error("challenge");
    return null;
  }
}

function isChallenge(res: Response, body: Record<string, unknown> | null) {
  if (res.status === 403 || res.status === 429) {
    if (!body) return true;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("json")) return true;
  }
  return false;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

let socket: GameSocket | null = null;

export function getSocket() {
  if (!socket) socket = new GameSocket();
  return socket;
}
