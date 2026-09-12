import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { Server } from "socket.io";
import { attachGame } from "./socket";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT || 43221);
const hostname = "0.0.0.0";

async function main() {
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();
  await app.prepare();

  const httpServer = createServer((req, res) => {
    const parsed = parse(req.url || "/", true);
    handle(req, res, parsed);
  });

  const io = new Server(httpServer, {
    cors: { origin: true },
    pingInterval: 10000,
    pingTimeout: 20000,
  });
  attachGame(io);

  httpServer.listen(port, hostname, () => {
    console.log(`DON'T KILL THE ASTRONAUT  →  http://127.0.0.1:${port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
