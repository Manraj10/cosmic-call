import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { ServerResponse } from "node:http";

const ZIP_NAME = "dont-kill-the-astronaut.zip";
const BUNDLE_NAME = "dont-kill-the-astronaut.bundle";

function send(res: ServerResponse, body: Buffer, type: string, filename: string) {
  res.writeHead(200, {
    "Content-Type": type,
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Content-Length": String(body.length),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

export function sendProjectZip(res: ServerResponse) {
  try {
    const zip = execFileSync("git", ["archive", "--format=zip", `--prefix=dont-kill-the-astronaut/`, "HEAD"], {
      cwd: process.cwd(),
      maxBuffer: 32 * 1024 * 1024,
    });
    send(res, zip, "application/zip", ZIP_NAME);
  } catch {
    const fallback = "/opt/cursor/artifacts/dont-kill-the-astronaut.zip";
    try {
      send(res, readFileSync(fallback), "application/zip", ZIP_NAME);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("zip not available");
    }
  }
}

export function sendProjectBundle(res: ServerResponse) {
  try {
    const bundle = execFileSync("git", ["bundle", "create", "-", "HEAD", "main"], {
      cwd: process.cwd(),
      maxBuffer: 32 * 1024 * 1024,
    });
    send(res, bundle, "application/octet-stream", BUNDLE_NAME);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("bundle not available");
  }
}

export function sendDownloadPage(res: ServerResponse) {
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Download DON'T KILL THE ASTRONAUT</title>
  <style>
    body { margin:0; min-height:100dvh; display:grid; place-items:center; background:#070b12; color:#d6f7ff; font-family: ui-sans-serif, system-ui, sans-serif; padding:24px; }
    main { max-width: 28rem; text-align:center; }
    h1 { font-size: 1.6rem; line-height:1.2; color:#fff; }
    p { color:#9ad4e6; line-height:1.45; }
    a.btn { display:block; margin:12px 0; padding:16px 18px; border-radius:12px; text-decoration:none; font-weight:700; letter-spacing:.04em; }
    a.zip { background: linear-gradient(#22d3ee,#0891b2); color:#041016; }
    a.bundle { background: transparent; border:1px solid #22d3ee55; color:#d6f7ff; }
    code { color:#ffb020; }
    ol { text-align:left; color:#b7e7f3; line-height:1.55; }
  </style>
</head>
<body>
  <main>
    <p style="letter-spacing:.4em; font-size:11px; color:#ffb020;">SOURCE DROP</p>
    <h1>Download the project</h1>
    <p>Unzip this on your laptop, then push it to <code>github.com/shainag03/oberon.mp</code>.</p>
    <a class="btn zip" href="/dont-kill-the-astronaut.zip">DOWNLOAD ZIP</a>
    <a class="btn bundle" href="/dont-kill-the-astronaut.bundle">DOWNLOAD GIT BUNDLE</a>
    <ol>
      <li>Unzip <code>dont-kill-the-astronaut.zip</code></li>
      <li><code>git init && git add . && git commit -m "Don't Kill the Astronaut"</code></li>
      <li><code>git branch -M main</code></li>
      <li><code>git remote add origin https://github.com/shainag03/oberon.mp.git</code></li>
      <li><code>git push -u origin main</code></li>
    </ol>
  </main>
</body>
</html>`);
}
