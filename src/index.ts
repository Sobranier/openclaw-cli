// version injected at build time by tsup define
import { spawnSync } from "node:child_process";
import { Command } from "commander";
import { BINARY_NAME, DISPLAY_NAME } from "./brand.js";
import { watchDaemon, stopDaemon } from "./commands/watch.js";
import { showStatus } from "./commands/status.js";
import { runDoctor } from "./commands/doctor.js";
import { showLogs } from "./commands/logs.js";
import { gatewayStart, gatewayStop, gatewayRestart } from "./commands/gateway.js";
import { memoryStatus, memorySearch, memoryCompact, memoryGc, memoryExport } from "./commands/memory.js";
import { showCost } from "./commands/cost.js";
import { mcpList, mcpStatus } from "./commands/mcp.js";
import { startDashboard } from "./dashboard/server.js";
import { detectOpenClaw } from "./core/openclaw.js";
import { telemetryOn, telemetryOff, telemetryStatus } from "./commands/telemetry.js";
import { remoteLogin, remoteEnable, remoteDisable, remoteStatus } from "./commands/remote.js";
import { printFirstRunNotice } from "./telemetry.js";

declare const __PACKAGE_VERSION__: string;
const _PKG_VER = typeof __PACKAGE_VERSION__ !== 'undefined' ? __PACKAGE_VERSION__ : '0.2.1';
const version = _PKG_VER;

// Show first-run telemetry notice (only once, non-blocking)
printFirstRunNotice();

const program = new Command();

program
  .name(BINARY_NAME)
  .description(`${DISPLAY_NAME} — health monitor and management for OpenClaw services`)
  .version(version);

// Global options
const addGlobalOpts = (cmd: Command) =>
  cmd
    .option("-c, --config <path>", "Path to config file")
    .option("--profile <name>", "OpenClaw profile (default, dev, ...)", "default");

// ── Our own unique commands ──

addGlobalOpts(
  program
    .command("watch")
    .description("Start health monitoring daemon")
    .option("-d, --daemon", "Run in background")
    .option("--dashboard", "Also start web dashboard"),
).action(watchDaemon);

addGlobalOpts(
  program.command("unwatch").description("Stop monitoring daemon"),
).action(stopDaemon);

addGlobalOpts(
  program
    .command("status")
    .description("Show gateway and channel health")
    .option("--json", "Machine-readable JSON output"),
).action(showStatus);

addGlobalOpts(
  program
    .command("doctor")
    .description("Run full diagnostics (our checks + openclaw doctor)")
    .option("--fix", "Auto-fix common config issues"),
).action(runDoctor);

addGlobalOpts(
  program
    .command("monitor")
    .description("Start local monitoring web UI (http://localhost:9090)"),
).action(startDashboard);

// ── Gateway management (enhanced proxy) ──

const gw = program
  .command("gateway")
  .description("Manage the OpenClaw gateway service");

addGlobalOpts(gw.command("start").description("Start the gateway")).action(gatewayStart);
addGlobalOpts(gw.command("stop").description("Stop the gateway")).action(gatewayStop);
addGlobalOpts(gw.command("restart").description("Restart the gateway")).action(gatewayRestart);

// ── Cost analysis ──

addGlobalOpts(
  program
    .command("cost")
    .description("Show token usage and cost summary per agent/model")
    .option("--json", "Machine-readable JSON output")
    .option("--days <n>", "Limit date range (default: 30)"),
).action(showCost);

// ── MCP server management ──

const mcp = program
  .command("mcp")
  .description("Manage local MCP (Model Context Protocol) servers");

mcp.command("list").description("List configured MCP servers and their status").action(mcpList);
mcp.command("status").description("Show detailed info for an MCP server").argument("<name>", "Server name").action(mcpStatus);

// ── Telemetry ──

const tele = program
  .command("telemetry")
  .description("Manage anonymous usage telemetry");

tele.command("on").description("Enable telemetry").action(telemetryOn);
tele.command("off").description("Disable telemetry").action(telemetryOff);
tele.command("status").description("Show telemetry status").action(telemetryStatus);

// ── Memory management ──

const mem = program
  .command("memory")
  .description("Memory file health and management");

addGlobalOpts(mem.command("status").description("Show MEMORY.md size and health per agent"))
  .action(memoryStatus);

addGlobalOpts(
  mem.command("search")
    .description("Search agent memory files")
    .argument("<query>", "Search query"),
).action((query, options) => memorySearch(query, options));

addGlobalOpts(
  mem.command("compact")
    .description("Compact agent memory (proxies to openclaw memory compact)")
    .option("--dry-run", "Preview without applying"),
).action(memoryCompact);

addGlobalOpts(
  mem.command("gc")
    .description("Remove old daily memory files")
    .option("--days <n>", "Max age in days (default: 30)")
    .option("--force", "Skip confirmation prompt"),
).action(memoryGc);

addGlobalOpts(
  mem.command("export")
    .description("Export all memory files to a single markdown file")
    .option("-o, --output <file>", "Output file (default: stdout)"),
).action(memoryExport);

// ── Remote monitoring ──

const remote = program
  .command("remote")
  .description("Remote monitoring — report gateway status to openclaw-cli.app");

addGlobalOpts(remote.command("login").description("Authenticate and register this machine"))
  .action(remoteLogin);
addGlobalOpts(remote.command("enable").description("Enable remote reporting"))
  .action(remoteEnable);
addGlobalOpts(remote.command("disable").description("Disable remote reporting"))
  .action(remoteDisable);
addGlobalOpts(remote.command("status").description("Show remote monitoring config"))
  .action(remoteStatus);

// ── Logs: proxy to openclaw, but keep --doctor flag for our own logs ──

addGlobalOpts(
  program
    .command("logs")
    .description("View logs (proxies to openclaw logs; use --doctor for our own logs)")
    .option("-n, --lines <count>", "Number of lines to show", "50")
    .option("--error", "Show gateway error logs")
    .option("--doctor", "Show our own event logs")
    .option("--tail", "Follow logs in real time")
    .allowUnknownOption(),
).action((options, cmd) => {
  if (options.doctor) {
    // Our own logs
    showLogs({ ...options, doctor: true });
  } else {
    // Proxy to openclaw logs
    proxyToOpenclaw(cmd.args.length ? cmd.args : [], ["logs", ...process.argv.slice(3)]);
  }
});

// ── Catch-all proxy: forward everything else to openclaw ──

program
  .command("*", { hidden: true, isDefault: false })
  .allowUnknownOption()
  .action(() => {
    // unreachable, handled below
  });

// Parse known commands first; if nothing matched, proxy to openclaw
program.addHelpText("after", `
Proxy: any unrecognized command is forwarded to the openclaw CLI.
       e.g. "${BINARY_NAME} channels list" → "openclaw channels list"
`);

// Hook: if commander doesn't match a known command, proxy it
const knownCommands = program.commands.map((c) => c.name());

const rawArgs = process.argv.slice(2);
const firstArg = rawArgs[0];

// Check if we need to proxy (not a known command, not a flag)
if (firstArg && !firstArg.startsWith("-") && !knownCommands.includes(firstArg)) {
  proxyToOpenclaw(rawArgs);
} else {
  program.parse();
}

function proxyToOpenclaw(args: string[], override?: string[]) {
  const info = detectOpenClaw("default");
  const bin = info.cliBinPath;
  if (!bin) {
    console.error("openclaw CLI not found. Please install openclaw first.");
    process.exit(1);
  }
  const passArgs = override ?? args;
  const result = spawnSync(info.nodePath, [bin, ...passArgs], {
    stdio: "inherit",
    env: process.env,
  });
  process.exit(result.status ?? 0);
}
