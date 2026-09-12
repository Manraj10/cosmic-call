const base = process.env.SMOKE_URL || "http://127.0.0.1:43221";
const code = `SMOK${Math.floor(10 + Math.random() * 90)}`;
const code2 = `EVA${Math.floor(10 + Math.random() * 90)}`;

async function get(path) {
  const res = await fetch(`${base}${path}`, { cache: "no-store" });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} ${res.status} ${text.slice(0, 180)}`);
  return JSON.parse(text);
}

async function hello(room) {
  return get(`/sync/${room}/hello?v=poll2`);
}

async function send(room, sid, event, data) {
  const d = encodeURIComponent(JSON.stringify(data ?? {}));
  return get(
    `/sync/${room}/in?v=poll2&sid=${encodeURIComponent(sid)}&e=${encodeURIComponent(event)}&d=${d}`,
  );
}

function pick(messages, event) {
  const hits = (messages || []).filter((m) => m.event === event);
  return hits.at(-1)?.data;
}

{
  const a = await hello(code);
  const b = await hello(code);
  if (!a.sid || !b.sid) throw new Error("missing sid");

  const created = await send(code, a.sid, "create", { name: "Shaina" });
  const joinedA = pick(created.messages, "joined");
  if (!joinedA?.playerId) throw new Error("create did not join");

  const joined = await send(code, b.sid, "join", { name: "Vega" });
  const st = pick(joined.messages, "state");
  if (!st || st.playerCount !== 2) throw new Error(`expected 2 players, got ${st?.playerCount}`);

  const started = await send(code, a.sid, "start", {});
  const intro = pick(started.messages, "state");
  if (!intro || intro.phase !== "role_intro") throw new Error(`expected role_intro, got ${intro?.phase}`);
  console.log("OK astronaut-host", code, st.players.map((p) => p.name).join("+"), intro.phase);
}

{
  const mon = await hello(code2);
  const a = await hello(code2);
  const b = await hello(code2);
  const created = await send(code2, mon.sid, "create", { name: "TV", monitor: true });
  const joinedM = pick(created.messages, "joined");
  const st0 = pick(created.messages, "state");
  if (!joinedM?.playerId) throw new Error("monitor create failed");
  if (!st0?.youAreMonitor) throw new Error("host is not monitor");
  if (st0.playerCount !== 0) throw new Error(`monitor counted as crew: ${st0.playerCount}`);
  if (st0.canStart) throw new Error("monitor-only room should not start");

  await send(code2, a.sid, "join", { name: "Ion" });
  const joined = await send(code2, b.sid, "join", { name: "Nova" });
  const st = pick(joined.messages, "state");
  if (!st || st.playerCount !== 2) throw new Error(`expected 2 astronauts, got ${st?.playerCount}`);
  if (st.players.some((p) => p.name === "TV")) throw new Error("monitor appeared in crew list");
  if (!st.canStart) throw new Error("two astronauts + monitor should be able to start");

  const started = await send(code2, mon.sid, "start", {});
  const intro = pick(started.messages, "state");
  if (!intro || intro.phase !== "role_intro") throw new Error(`monitor start failed, phase ${intro?.phase}`);
  console.log("OK monitor-host", code2, st.players.map((p) => p.name).join("+"), intro.phase);
}

process.exit(0);
