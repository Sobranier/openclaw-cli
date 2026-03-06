import { createRequire } from "node:module";
import { Command } from "commander";
import { watchDaemon, stopDaemon } from "./commands/watch.js";
import { showStatus } from "./commands/status.js";
import { runDoctor } from "./commands/doctor.js";
import { showLogs } from "./commands/logs.js";
import { gatewayStart, gatewayStop, gatewayRestart } from "./commands/gateway.js";
import { startDashboard } from "./dashboard/server.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json");

const program = new Command();

program
  .name("openclaw-doctor")
  .description("Health monitor and management daemon for OpenClaw services")
  .version(version);

// Global options
const addGlobalOpts = (cmd: Command) =>
  cmd
    .option("-c, --config <path>", "Path to doctor config file")
    .option("--profile <name>", "OpenClaw profile (default, dev, ...)", "default");

// ── Core commands ──

addGlobalOpts(
  program
    .command("watch")
    .description("Start health monitoring daemon")
    .option("-d, --daemon", "Run in background")
    .option("--dashboard", "Also start web dashboard"),
).action(watchDaemon);

addGlobalOpts(
  program.command("unwatch").description("Stop Doctor monitoring daemon"),
).action(stopDaemon);

addGlobalOpts(
  program
    .command("status")
    .description("Show gateway and channel health")
    .option("--json", "Machine-readable JSON output"),
).action(showStatus);

addGlobalOpts(
  program.command("doctor").description("Run full diagnostics"),
).action(runDoctor);

addGlobalOpts(
  program.command("dashboard").description("Start web management dashboard"),
).action(startDashboard);

// ── Gateway management ──

const gw = program
  .command("gateway")
  .description("Manage the OpenClaw gateway service");

addGlobalOpts(
  gw.command("start").description("Start the gateway"),
).action(gatewayStart);

addGlobalOpts(
  gw.command("stop").description("Stop the gateway"),
).action(gatewayStop);

addGlobalOpts(
  gw.command("restart").description("Restart the gateway"),
).action(gatewayRestart);

// ── Logs ──

addGlobalOpts(
  program
    .command("logs")
    .description("View logs")
    .option("-n, --lines <count>", "Number of lines to show", "50")
    .option("--error", "Show gateway error logs")
    .option("--doctor", "Show doctor event logs")
    .option("--tail", "Follow logs in real time"),
).action(showLogs);

program.parse();
