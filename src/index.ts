import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { Command } from "commander";
import { BINARY_NAME, DISPLAY_NAME } from "./brand.js";
import { watchDaemon, stopDaemon } from "./commands/watch.js";
import { showStatus } from "./commands/status.js";
import { runDoctor } from "./commands/doctor.js";
import { showLogs } from "./commands/logs.js";
import { gatewayStart, gatewayStop, gatewayRestart } from "./commands/gateway.js";
import { startDashboard } from "./dashboard/server.js";
import { detectOpenClaw } from "./core/openclaw.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json");

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
