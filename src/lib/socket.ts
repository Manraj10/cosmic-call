type Handler = (payload: unknown) => void;

class GameSocket {
  ws: WebSocket | null = null;
  handlers = new Map<string, Set<Handler>>();
  queue: { event: string; data?: unknown }[] = [];
  room: string | null = null;

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

  connect(room: string) {
    this.disconnect();
    this.room = room.toUpperCase();
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${window.location.host}/ws?room=${encodeURIComponent(this.room)}`);
    this.ws = ws;
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as { event: string; data: unknown };
        this.fire(msg.event, msg.data);
      } catch {
        /* ignore */
      }
    };
    ws.onopen = () => {
      const pending = this.queue;
      this.queue = [];
      for (const m of pending) this.emit(m.event, m.data);
      this.fire("open", null);
    };
    ws.onclose = () => this.fire("close", null);
  }

  emit(event: string, data?: unknown) {
    const packet = JSON.stringify({ event, data });
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.queue.push({ event, data });
      return;
    }
    this.ws.send(packet);
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
    this.queue = [];
  }
}

let socket: GameSocket | null = null;

export function getSocket() {
  if (!socket) socket = new GameSocket();
  return socket;
}
