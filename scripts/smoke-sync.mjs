const base = process.env.SMOKE_URL || "http://127.0.0.1:43221";
const code = `SMOK${Math.floor(10 + Math.random() * 90)}`;

async function get(path) {
  const res = await fetch(`${base}${path}`, { cache: "no-store" });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} ${res.status} ${text.slice(0, 180)}`);
  return JSON.parse(text);
}

async function hello() {
  return get(`/sync/${code}/hello?v=poll1&t=${Date.now()}`);
}

async function send(sid, event, data) {
  const d = encodeURIComponent(JSON.stringify(data ?? {}));
  return get(
    `/sync/${code}/in?v=poll1&t=${Date.now()}&sid=${encodeURIComponent(sid)}&e=${encodeURIComponent(event)}&d=${d}`,
  );
}

function pick(messages, event) {
  return (messages || []).find((m) => m.event === event)?.data;
}

const a = await hello();
const b = await hello();
if (!a.sid || !b.sid) throw new Error("missing sid");

const created = await send(a.sid, "create", { name: "Shaina" });
const joinedA = pick(created.messages, "joined");
if (!joinedA?.playerId) throw new Error("create did not join");

const joined = await send(b.sid, "join", { name: "Vega" });
const st = pick(joined.messages, "state");
if (!st || st.playerCount !== 2) throw new Error(`expected 2 players, got ${st?.playerCount}`);

const started = await send(a.sid, "start", {});
const intro = pick(started.messages, "state");
if (!intro || intro.phase !== "role_intro") throw new Error(`expected role_intro, got ${intro?.phase}`);

console.log("OK", code, st.players.map((p) => p.name).join("+"), intro.phase);
process.exit(0);
