declare const __PACKAGE_VERSION__: string;
const _PKG_VER = typeof __PACKAGE_VERSION__ !== 'undefined' ? __PACKAGE_VERSION__ : '0.2.1';
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import { loadConfig, DOCTOR_LOG_DIR } from "../config.js";
import { detectOpenClaw, runOpenClawCmd } from "../core/openclaw.js";
import { checkHealth } from "../core/health-checker.js";
import { getCheckHistory, getRestartHistory, log } from "../core/logger.js";
import { restartGateway } from "../core/process-manager.js";
import { scanWorkspaces } from "../core/workspace-scanner.js";
import { scanCosts } from "../core/cost-scanner.js";

const pkgVersion = _PKG_VER;

function readDoctorLogs(maxLines = 50): string[] {
  if (!existsSync(DOCTOR_LOG_DIR)) return [];
  const files = (readdirSync(DOCTOR_LOG_DIR) as string[])
    .filter((f) => f.endsWith(".log"))
    .sort()
    .reverse();
  if (files.length === 0) return [];
  const content = readFileSync(join(DOCTOR_LOG_DIR, files[0]), "utf-8");
  const lines = content.trim().split("\n");
  return lines.slice(-maxLines);
}

function renderShell(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OpenClaw Doctor</title>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:system-ui,-apple-system,sans-serif; background:#050810; color:#f0f4ff; min-height:100vh; }

    /* Navbar */
    .navbar { display:flex; align-items:center; justify-content:space-between; padding:0.75rem 1.5rem; background:#0d1424; border-bottom:1px solid #1a2744; flex-wrap:wrap; gap:0.5rem; }
    .nav-left { display:flex; align-items:center; gap:0.5rem; font-weight:700; font-size:1rem; white-space:nowrap; }
    .nav-left .ver { font-weight:400; color:#6b7fa3; font-size:0.8rem; }
    .nav-center { display:flex; align-items:center; gap:0.5rem; }
    .status-dot { width:10px; height:10px; border-radius:50%; display:inline-block; }
    .status-label { font-weight:600; font-size:0.9rem; }
    .nav-right { color:#6b7fa3; font-size:0.75rem; white-space:nowrap; }

    /* Tabs */
    .tabs { display:flex; border-bottom:1px solid #1a2744; background:#0d1424; overflow-x:auto; }
    .tab { padding:0.65rem 1.25rem; cursor:pointer; color:#6b7fa3; font-size:0.85rem; border-bottom:2px solid transparent; white-space:nowrap; transition:color 0.15s; }
    .tab:hover { color:#f0f4ff; }
    .tab.active { color:#f0f4ff; border-bottom-color:#007AFF; }

    /* Content */
    .content { padding:1.5rem; max-width:1200px; margin:0 auto; }

    /* Cards */
    .card { background:#0d1424; border:1px solid #1a2744; border-radius:12px; padding:1.25rem; margin-bottom:1rem; }
    .card-title { color:#6b7fa3; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.5rem; }

    .big-status { font-size:2rem; font-weight:700; }
    .meta-row { color:#6b7fa3; font-size:0.8rem; margin-top:0.25rem; }

    .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
    @media (max-width:768px) { .grid2 { grid-template-columns:1fr; } }

    /* Tables */
    table { width:100%; border-collapse:collapse; }
    th, td { text-align:left; padding:0.4rem 0.75rem; border-bottom:1px solid #1a2744; font-size:0.8rem; }
    th { color:#6b7fa3; font-size:0.7rem; text-transform:uppercase; letter-spacing:0.05em; }

    /* Tags */
    .tag { display:inline-block; padding:0.15rem 0.5rem; border-radius:9999px; font-size:0.7rem; font-weight:600; }
    .tag-ok { background:rgba(0,166,126,0.15); color:#00A67E; }
    .tag-fail { background:#ef444422; color:#ef4444; }
    .tag-default { background:rgba(0,122,255,0.15); color:#007AFF; font-size:0.65rem; margin-left:0.35rem; }

    /* Buttons */
    .btn { padding:0.5rem 1rem; border:none; border-radius:0.375rem; cursor:pointer; font-size:0.8rem; font-weight:600; transition:opacity 0.15s; }
    .btn:hover { opacity:0.85; }
    .btn:disabled { opacity:0.5; cursor:not-allowed; }
    .btn-blue { background:#007AFF; color:#fff; }
    .btn-amber { background:#f59e0b; color:#fff; }
    .btn-group { display:flex; gap:0.5rem; flex-wrap:wrap; }

    /* Result box */
    .result-box { margin-top:0.75rem; padding:0.75rem; background:#030609; border-radius:8px; font-size:0.75rem; font-family:ui-monospace,monospace; white-space:pre-wrap; word-break:break-all; max-height:200px; overflow-y:auto; }

    /* Logs */
    .log-line { font-family:ui-monospace,monospace; font-size:0.75rem; padding:0.2rem 0; line-height:1.4; word-break:break-all; }
    .log-info { color:#6b7fa3; }
    .log-warn { color:#eab308; }
    .log-error { color:#ef4444; }
    .log-success { color:#00A67E; }

    /* Config */
    .cfg-row { display:flex; justify-content:space-between; padding:0.5rem 0; border-bottom:1px solid #1a2744; font-size:0.85rem; }
    .cfg-key { color:#6b7fa3; }
    .cfg-val { color:#f0f4ff; font-family:ui-monospace,monospace; }

    /* Loading */
    .loading { color:#6b7fa3; text-align:center; padding:3rem 0; }
  </style>
</head>
<body x-data="dashboard()" x-init="init()">

  <!-- Navbar -->
  <div class="navbar">
    <div class="nav-left">
      <span>&#129438; OpenClaw Doctor</span>
      <span class="ver">v${pkgVersion}</span>
    </div>
    <div class="nav-center">
      <span class="status-dot" :style="'background:' + statusColor"></span>
      <span class="status-label" :style="'color:' + statusColor" x-text="statusText"></span>
    </div>
    <div class="nav-right" x-text="lastCheck ? 'Updated ' + lastCheck : 'Loading...'"></div>
  </div>

  <!-- Tabs -->
  <div class="tabs">
    <template x-for="t in ['Overview','Cost','Restarts','Logs','Config']">
      <div class="tab" :class="{ active: tab === t }" @click="tab = t" x-text="t"></div>
    </template>
  </div>

  <!-- Content -->
  <div class="content">

    <!-- Loading state -->
    <template x-if="!loaded">
      <div class="loading">Loading...</div>
    </template>

    <!-- Overview Tab -->
    <template x-if="loaded && tab === 'Overview'">
      <div>
        <div class="card">
          <div class="big-status" :style="'color:' + statusColor" x-text="statusText"></div>
          <div class="meta-row">
            Gateway :<span x-text="data.info?.gatewayPort ?? '?'"></span>
            &nbsp;|&nbsp; Latency: <span x-text="(data.durationMs ?? '-') + 'ms'"></span>
            &nbsp;|&nbsp; Profile: <span x-text="data.info?.profile ?? '?'"></span>
            &nbsp;|&nbsp; OpenClaw <span x-text="data.info?.version ?? '?'"></span>
          </div>
        </div>

        <div class="grid2">
          <!-- Channels -->
          <div class="card">
            <div class="card-title">Channels</div>
            <template x-if="data.channels && data.channels.length > 0">
              <table>
                <thead><tr><th>Name</th><th>Status</th></tr></thead>
                <tbody>
                  <template x-for="c in data.channels" :key="c.name">
                    <tr>
                      <td x-text="c.name"></td>
                      <td><span class="tag" :class="c.ok ? 'tag-ok' : 'tag-fail'" x-text="c.ok ? 'OK' : 'FAIL'"></span></td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </template>
            <template x-if="!data.channels || data.channels.length === 0">
              <div style="color:#6b7fa3;font-size:0.8rem;">No channels</div>
            </template>
          </div>

          <!-- Agents -->
          <div class="card">
            <div class="card-title">Agents</div>
            <template x-if="data.agents && data.agents.length > 0">
              <table>
                <thead><tr><th>Name</th><th>Model</th><th>Sessions</th><th>Last Active</th><th></th></tr></thead>
                <tbody>
                  <template x-for="a in data.agents" :key="a.id">
                    <tr x-data="{ rt() { return (data.agentRuntimes||[]).find(r=>r.agentId===a.id) } }">
                      <td x-text="a.name"></td>
                      <td style="color:#6b7fa3;font-size:0.78rem;" x-text="a.model ? a.model.replace('anthropic/','').replace('openai/','') : '—'"></td>
                      <td style="color:#6b7fa3;font-size:0.78rem;" x-text="rt()?.sessions?.count ?? '—'"></td>
                      <td style="font-size:0.78rem;" x-text="rt()?.sessions?.recent?.[0]?.age != null ? (rt().sessions.recent[0].age < 60000 ? 'just now' : rt().sessions.recent[0].age < 3600000 ? Math.floor(rt().sessions.recent[0].age/60000)+'m ago' : Math.floor(rt().sessions.recent[0].age/3600000)+'h ago') : '—'"></td>
                      <td><template x-if="a.isDefault"><span class="tag tag-default">default</span></template></td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </template>
            <template x-if="!data.agents || data.agents.length === 0">
              <div style="color:#6b7fa3;font-size:0.8rem;">No agents</div>
            </template>
          </div>
        </div>

        <!-- Recent checks -->
        <div class="card">
          <div class="card-title">Recent Health Checks</div>
          <template x-if="data.checks && data.checks.length > 0">
            <div style="overflow-x:auto;">
              <table>
                <thead><tr><th>Time</th><th>Status</th><th>Latency</th><th>Error</th></tr></thead>
                <tbody>
                  <template x-for="c in data.checks.slice().reverse().slice(0, 10)" :key="c.timestamp">
                    <tr>
                      <td x-text="fmtTime(c.timestamp)"></td>
                      <td><span class="tag" :class="c.healthy ? 'tag-ok' : 'tag-fail'" x-text="c.healthy ? 'OK' : 'FAIL'"></span></td>
                      <td x-text="(c.responseTime ?? '-') + 'ms'"></td>
                      <td style="color:#ef4444;" x-text="c.error ?? ''"></td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
          </template>
          <template x-if="!data.checks || data.checks.length === 0">
            <div style="color:#6b7fa3;font-size:0.8rem;">No checks yet</div>
          </template>
        </div>
      </div>
    </template>

    
        <!-- Workspace Health -->
        <div class="card">
          <div class="card-title">Workspace Health</div>
          <template x-if="data.workspaces && data.workspaces.length > 0">
            <table>
              <thead><tr><th>Agent</th><th>MEMORY.md</th><th>Sessions</th><th>Workspace Size</th><th></th></tr></thead>
              <tbody>
                <template x-for="w in data.workspaces" :key="w.agentId">
                  <tr>
                    <td x-text="w.agentName"></td>
                    <td x-text="w.memoryFileSizeKB + ' KB'"></td>
                    <td x-text="w.sessionCount"></td>
                    <td x-text="w.totalWorkspaceSizeKB + ' KB'"></td>
                    <td>
                      <template x-if="w.memoryWarning">
                        <span class="tag" style="background:rgba(245,158,11,0.15);color:#f59e0b;">⚠ Large</span>
                      </template>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </template>
          <template x-if="!data.workspaces || data.workspaces.length === 0">
            <div style="color:#6b7fa3;font-size:0.8rem;">No workspace data</div>
          </template>
        </div>

        <!-- Restarts Tab -->
    <template x-if="loaded && tab === 'Restarts'">
      <div>
        <div class="card">
          <div class="card-title">Actions</div>
          <div class="btn-group">
            <button class="btn btn-blue" :disabled="actionLoading" @click="doRestart()">Restart Gateway</button>
            <button class="btn btn-amber" :disabled="actionLoading" @click="doDoctor()">Run Doctor Fix</button>
          </div>
          <template x-if="actionResult">
            <div class="result-box" x-text="actionResult"></div>
          </template>
        </div>

        <div class="card">
          <div class="card-title">Restart History</div>
          <template x-if="data.restarts && data.restarts.length > 0">
            <div style="overflow-x:auto;">
              <table>
                <thead><tr><th>Time</th><th>Reason</th><th>Result</th></tr></thead>
                <tbody>
                  <template x-for="r in data.restarts.slice().reverse()" :key="r.timestamp">
                    <tr>
                      <td x-text="fmtTime(r.timestamp)"></td>
                      <td x-text="r.reason"></td>
                      <td><span class="tag" :class="r.success ? 'tag-ok' : 'tag-fail'" x-text="r.success ? 'OK' : 'FAIL'"></span></td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
          </template>
          <template x-if="!data.restarts || data.restarts.length === 0">
            <div style="color:#6b7fa3;font-size:0.8rem;">No restarts</div>
          </template>
        </div>
      </div>
    </template>

    <!-- Logs Tab -->
    <template x-if="loaded && tab === 'Logs'">
      <div>
        <div class="card">
          <div class="card-title">Doctor Logs (latest 50)</div>
          <template x-if="logs.length > 0">
            <div style="max-height:600px;overflow-y:auto;">
              <template x-for="(line, i) in logs" :key="i">
                <div class="log-line" :class="logClass(line)" x-text="line"></div>
              </template>
            </div>
          </template>
          <template x-if="logs.length === 0">
            <div style="color:#6b7fa3;font-size:0.8rem;">No logs yet</div>
          </template>
        </div>
      </div>
    </template>

    <!-- Cost Tab -->
    <template x-if="loaded && tab === 'Cost'">
      <div>
        <template x-if="costData">
          <div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
              <div class="card" style="text-align:center;">
                <div class="card-title">Today</div>
                <div style="font-size:2rem;font-weight:700;color:#f0f4ff;" x-text="'$' + (costData.todayTotal||0).toFixed(4)"></div>
              </div>
              <div class="card" style="text-align:center;">
                <div class="card-title">This Week</div>
                <div style="font-size:2rem;font-weight:700;color:#f0f4ff;" x-text="'$' + (costData.weekTotal||0).toFixed(4)"></div>
              </div>
            </div>
            <div class="card">
              <div class="card-title">By Agent</div>
              <table>
                <thead><tr><th>Agent</th><th>Today</th><th>This Week</th><th>Sessions</th></tr></thead>
                <tbody>
                  <template x-for="a in costData.agents" :key="a.agentId">
                    <tr>
                      <td x-text="a.agentName"></td>
                      <td x-text="'$' + (a.todayCost||0).toFixed(4)"></td>
                      <td x-text="'$' + (a.weekCost||0).toFixed(4)"></td>
                      <td style="color:#6b7fa3;" x-text="a.sessionCount"></td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
          </div>
        </template>
        <template x-if="!costData">
          <div class="loading">Loading cost data...</div>
        </template>
      </div>
    </template>

    <!-- Config Tab -->
    <template x-if="loaded && tab === 'Config'">
      <div>
        <div class="card">
          <div class="card-title">Current Configuration</div>
          <template x-if="data.config">
            <div>
              <div class="cfg-row"><span class="cfg-key">checkInterval</span><span class="cfg-val" x-text="data.config.checkInterval + 's'"></span></div>
              <div class="cfg-row"><span class="cfg-key">failThreshold</span><span class="cfg-val" x-text="data.config.failThreshold"></span></div>
              <div class="cfg-row"><span class="cfg-key">dashboardPort</span><span class="cfg-val" x-text="data.config.dashboardPort"></span></div>
              <div class="cfg-row"><span class="cfg-key">maxRestartsPerHour</span><span class="cfg-val" x-text="data.config.maxRestartsPerHour"></span></div>
              <div class="cfg-row"><span class="cfg-key">openclawProfile</span><span class="cfg-val" x-text="data.config.openclawProfile"></span></div>
              <div class="cfg-row"><span class="cfg-key">notify.webhook.enabled</span><span class="cfg-val" x-text="data.config.notify?.webhook?.enabled ?? false"></span></div>
              <div class="cfg-row"><span class="cfg-key">notify.system.enabled</span><span class="cfg-val" x-text="data.config.notify?.system?.enabled ?? false"></span></div>
            </div>
          </template>
        </div>
      </div>
    </template>

  </div>

  <script>
    function dashboard() {
      return {
        tab: 'Overview',
        costData: null,
        loaded: false,
        data: {},
        logs: [],
        lastCheck: '',
        actionLoading: false,
        actionResult: '',

        get statusText() {
          if (!this.data || !this.loaded) return 'LOADING';
          if (this.data.healthy) return 'HEALTHY';
          if (this.data.gateway) return 'DEGRADED';
          return 'UNREACHABLE';
        },

        get statusColor() {
          if (!this.data || !this.loaded) return '#64748b';
          if (this.data.healthy) return '#00A67E';
          if (this.data.gateway) return '#f59e0b';
          return '#ef4444';
        },

        async init() {
          await this.refresh();
          await this.refreshLogs();
          setInterval(() => this.refresh(), 10000);
          setInterval(() => this.refreshLogs(), 10000);
        },

        async refresh() {
          try {
            const res = await fetch('/api/status');
            this.data = await res.json();
            this.lastCheck = new Date().toLocaleTimeString();
            this.loaded = true;
          } catch (e) {
            console.error('Failed to fetch status', e);
          }
        },

        async refreshCost() {
          try {
            const r = await fetch('/api/cost');
            this.costData = await r.json();
          } catch {}
        },
        async refreshLogs() {
          try {
            const res = await fetch('/api/logs');
            const d = await res.json();
            this.logs = d.lines ?? [];
          } catch (e) {
            console.error('Failed to fetch logs', e);
          }
        },

        async doRestart() {
          this.actionLoading = true;
          this.actionResult = '';
          try {
            const res = await fetch('/api/restart', { method: 'POST' });
            const d = await res.json();
            this.actionResult = d.success ? 'Gateway restarted successfully.' : ('Restart failed: ' + (d.error ?? 'unknown'));
            await this.refresh();
          } catch (e) {
            this.actionResult = 'Request failed: ' + e.message;
          }
          this.actionLoading = false;
        },

        async doDoctor() {
          this.actionLoading = true;
          this.actionResult = '';
          try {
            const res = await fetch('/api/doctor', { method: 'POST' });
            const d = await res.json();
            this.actionResult = d.output ?? 'No output';
          } catch (e) {
            this.actionResult = 'Request failed: ' + e.message;
          }
          this.actionLoading = false;
        },

        fmtTime(iso) {
          if (!iso) return '';
          try { return new Date(iso).toLocaleString(); } catch { return iso; }
        },

        logClass(line) {
          if (line.includes('[ERROR]')) return 'log-error';
          if (line.includes('[WARN]')) return 'log-warn';
          if (line.includes('[SUCCESS]')) return 'log-success';
          return 'log-info';
        }
      };
    }
  </script>
</body>
</html>`;
}

async function handleApiStatus(
  info: ReturnType<typeof detectOpenClaw>,
  configPath: string | undefined,
  res: ServerResponse,
) {
  try {
    const live = await checkHealth(info);
    const config = loadConfig(configPath);
    const workspaces = scanWorkspaces(info);
    const agentRuntimes = live.agentRuntimes ?? [];
    const payload = {
      healthy: live.healthy,
      gateway: live.gateway,
      channels: live.channels,
      agents: info.agents,
      agentRuntimes,
      durationMs: live.durationMs,
      checks: getCheckHistory(),
      restarts: getRestartHistory(),
      config,
      workspaces,
      info: {
        version: info.version,
        gatewayPort: info.gatewayPort,
        profile: info.profile,
      },
    };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(payload));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: String(err) }));
  }
}

async function handleApiRestart(
  info: ReturnType<typeof detectOpenClaw>,
  res: ServerResponse,
) {
  try {
    const result = await restartGateway(info);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: result.success, message: result.output ?? result.error ?? "" }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, message: String(err) }));
  }
}

async function handleApiDoctor(
  info: ReturnType<typeof detectOpenClaw>,
  res: ServerResponse,
) {
  try {
    const output = await runOpenClawCmd(info, "doctor --non-interactive");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ output: output ?? "No output" }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ output: "Error: " + String(err) }));
  }
}

async function handleApiCost(
  info: ReturnType<typeof detectOpenClaw>,
  res: ServerResponse,
) {
  try {
    const costs = scanCosts(info.agents);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(costs));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: String(err) }));
  }
}

function handleApiLogs(res: ServerResponse) {
  const lines = readDoctorLogs(50);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ lines }));
}

export function startDashboard(options: { config?: string; profile?: string }) {
  const config = loadConfig(options.config);
  const info = detectOpenClaw(options.profile ?? config.openclawProfile);
  const port = config.dashboardPort;
  const shell = renderShell();

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? "/";
    const method = req.method ?? "GET";

    if (method === "GET" && url === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(shell);
    } else if (method === "GET" && url === "/api/status") {
      await handleApiStatus(info, options.config, res);
    } else if (method === "GET" && url === "/api/cost") {
      await handleApiCost(info, res);
    } else if (method === "GET" && url === "/api/logs") {
      handleApiLogs(res);
    } else if (method === "POST" && url === "/api/restart") {
      await handleApiRestart(info, res);
    } else if (method === "POST" && url === "/api/doctor") {
      await handleApiDoctor(info, res);
    } else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    }
  });

  server.listen(port, () => {
    log("info", `Dashboard running at http://localhost:${port}`);
    console.log(chalk.green.bold(`\n  Dashboard: http://localhost:${port}\n`));
  });
}

// === Change Summary ===
// Dashboard v2: Full rewrite of server.ts
// - renderShell() returns static HTML with Alpine.js for reactive UI
// - 4 tabs: Overview, Restarts, Logs, Config
// - REST API: GET /api/status, GET /api/logs, POST /api/restart, POST /api/doctor
// - /api/status returns health, channels, agents, checks, restarts, config, info
// - /api/restart triggers restartGateway(), /api/doctor runs openclaw doctor
// - /api/logs reads latest doctor log file (50 lines)
// - Dark theme (#0f172a), mobile responsive, 10s auto-refresh polling
// - No new npm dependencies added
