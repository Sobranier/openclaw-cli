/**
 * Forked by Electron main process.
 * Starts the dashboard HTTP server directly using Node's http module.
 * This file is compiled to CommonJS and runs as a standalone child process.
 */
import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import * as cp from "node:child_process";

const PORT = Number(process.env.DASHBOARD_PORT ?? 9090);

// Find openclaw-doctor CLI (the installed npm package)
function findOpenclawDoctor(): string | null {
  // 1. Check if there's a global install
  try {
    const which = cp.execSync("which openclaw-doctor", { encoding: "utf-8" }).trim();
    if (which) return which;
  } catch {}
  
  // 2. Check common paths
  const candidates = [
    "/usr/local/bin/openclaw-doctor",
    "/opt/homebrew/bin/openclaw-doctor",
    path.join(process.env.HOME ?? "", ".nvm/versions/node/v24.14.0/bin/openclaw-doctor"),
    path.join(process.env.HOME ?? "", ".nvm/versions/node/v22.13.0/bin/openclaw-doctor"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

// Strategy: spawn openclaw-doctor monitor as a subprocess
const cli = findOpenclawDoctor();
if (cli) {
  console.log(`[server-process] Starting via CLI: ${cli} monitor`);
  const child = cp.spawn(process.execPath, [cli, "monitor"], {
    env: { ...process.env },
    stdio: "inherit",
  });
  child.on("exit", (code) => {
    console.log(`[server-process] CLI exited (${code})`);
    process.exit(code ?? 1);
  });
} else {
  // Fallback: minimal inline HTTP server returning status
  console.warn("[server-process] openclaw-doctor CLI not found, starting fallback server");
  const server = http.createServer((req, res) => {
    if (req.url === "/api/status") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ healthy: false, gateway: false, channels: [], agents: [], durationMs: 0, error: "CLI not found" }));
    } else {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<h1>OpenClaw Doctor</h1><p>CLI not found. Please install openclaw-doctor.</p>");
    }
  });
  server.listen(PORT, () => console.log(`[server-process] Fallback server on :${PORT}`));
}
