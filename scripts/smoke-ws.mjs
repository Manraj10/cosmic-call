import { WebSocket } from "ws";

function connect(code) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:43221/ws?room=${code}`);
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
    setTimeout(() => reject(new Error("timeout")), 8000);
  });
}

function once(ws, event) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("no " + event)), 5000);
    const onMsg = (buf) => {
      const msg = JSON.parse(String(buf));
      if (msg.event === event) {
        clearTimeout(t);
        ws.off("message", onMsg);
        resolve(msg.data);
      }
    };
    ws.on("message", onMsg);
  });
}

const created = await fetch("http://127.0.0.1:43221/api/create", { method: "POST" }).then((r) => r.json());
const code = created.code;
console.log("code", code);
const a = await connect(code);
const b = await connect(code);
const joinedA = once(a, "joined");
a.send(JSON.stringify({ event: "create", data: { name: "Shaina" } }));
await joinedA;
const stateP = once(b, "state");
b.send(JSON.stringify({ event: "join", data: { name: "Vega" } }));
const st = await stateP;
console.log("players", st.players.map((p) => p.name), "phase", st.phase);
if (st.playerCount !== 2) throw new Error("expected 2");
const waiting = once(a, "state");
a.send(JSON.stringify({ event: "start" }));
let intro = await waiting;
for (let i = 0; i < 8 && intro.phase !== "role_intro"; i++) {
  intro = await once(a, "state");
}
console.log("after start", intro.phase, intro.roleCard?.primary);
if (intro.phase !== "role_intro") throw new Error(intro.phase);
console.log("OK");
a.close();
b.close();
process.exit(0);
