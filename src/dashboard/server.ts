import { createServer } from "node:http";
import chalk from "chalk";
import { loadConfig } from "../config.js";
import { detectOpenClaw } from "../core/openclaw.js";
import { checkHealth } from "../core/health-checker.js";
import { getCheckHistory, getRestartHistory, log } from "../core/logger.js";

async function renderHTML(info: ReturnType<typeof detectOpenClaw>): Promise<string> {
  const checks = getCheckHistory();
  const restarts = getRestartHistory();

  // Live check for current status
  const live = await checkHealth(info);

  const statusText = live.healthy
    ? "HEALTHY"
    : live.gateway
      ? "DEGRADED"
      : "UNREACHABLE";
  const statusColor = live.healthy
    ? "#22c55e"
    : live.gateway
      ? "#eab308"
      : "#ef4444";

  const channelRows = live.channels
    .map(
      (c) => `
      <tr>
        <td>${c.name}</td>
        <td style="color:${c.ok ? "#22c55e" : "#ef4444"}">${c.ok ? "OK" : "FAIL"}</td>
      </tr>`,
    )
    .join("");

  const agentList = info.agents
    .map((a) => `${a.name}${a.isDefault ? " (default)" : ""}`)
    .join(", ");

  const checksRows = checks
    .slice()
    .reverse()
    .slice(0, 30)
    .map(
      (c) => `
      <tr>
        <td>${c.timestamp}</td>
        <td style="color:${c.healthy ? "#22c55e" : "#ef4444"}">${c.healthy ? "OK" : "FAIL"}</td>
        <td>${c.responseTime ?? "-"}ms</td>
        <td>${c.error ?? ""}</td>
      </tr>`,
    )
    .join("");

  const restartsRows = restarts
    .slice()
    .reverse()
    .slice(0, 20)
    .map(
      (r) => `
      <tr>
        <td>${r.timestamp}</td>
        <td>${r.reason}</td>
        <td style="color:${r.success ? "#22c55e" : "#ef4444"}">${r.success ? "OK" : "FAIL"}</td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>OpenClaw Doctor</title>
  <meta http-equiv="refresh" content="10">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:-apple-system,system-ui,sans-serif; background:#0f172a; color:#e2e8f0; padding:2rem; }
    h1 { font-size:1.5rem; margin-bottom:0.5rem; }
    .subtitle { color:#64748b; margin-bottom:1.5rem; font-size:0.85rem; }
    .status { font-size:2rem; font-weight:bold; color:${statusColor}; margin-bottom:0.5rem; }
    .meta { color:#64748b; font-size:0.8rem; margin-bottom:2rem; }
    h2 { font-size:1.1rem; margin:1.5rem 0 0.5rem; color:#94a3b8; }
    table { width:100%; border-collapse:collapse; margin-bottom:1rem; }
    th,td { text-align:left; padding:0.4rem 0.8rem; border-bottom:1px solid #1e293b; font-size:0.85rem; }
    th { color:#64748b; }
    .grid { display:grid; grid-template-columns:1fr 1fr; gap:2rem; }
    @media (max-width:768px) { .grid { grid-template-columns:1fr; } }
  </style>
</head>
<body>
  <h1>OpenClaw Doctor</h1>
  <div class="subtitle">Gateway :${info.gatewayPort} | OpenClaw ${info.version ?? "?"} | ${info.profile} profile</div>
  <div class="status">${statusText}</div>
  <div class="meta">${live.durationMs}ms | Agents: ${agentList || "none"}</div>

  <div class="grid">
    <div>
      <h2>Channels</h2>
      <table>
        <tr><th>Channel</th><th>Status</th></tr>
        ${channelRows || "<tr><td colspan=2>No channels</td></tr>"}
      </table>

      <h2>Restart History</h2>
      <table>
        <tr><th>Time</th><th>Reason</th><th>Result</th></tr>
        ${restartsRows || "<tr><td colspan=3>No restarts</td></tr>"}
      </table>
    </div>
    <div>
      <h2>Health Check History</h2>
      <table>
        <tr><th>Time</th><th>Status</th><th>Latency</th><th>Error</th></tr>
        ${checksRows || "<tr><td colspan=4>No checks yet</td></tr>"}
      </table>
    </div>
  </div>
</body>
</html>`;
}

export function startDashboard(options: { config?: string; profile?: string }) {
  const config = loadConfig(options.config);
  const info = detectOpenClaw(options.profile ?? config.openclawProfile);
  const port = config.dashboardPort;

  const server = createServer(async (_req, res) => {
    const html = await renderHTML(info);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  });

  server.listen(port, () => {
    log("info", `Dashboard running at http://localhost:${port}`);
    console.log(chalk.green.bold(`\n  Dashboard: http://localhost:${port}\n`));
  });
}
