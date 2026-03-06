import { spawn } from "node:child_process";
import { writeFileSync, readFileSync, existsSync, unlinkSync, openSync } from "node:fs";
import chalk from "chalk";
import { loadConfig, PID_FILE, DOCTOR_LOG_DIR, ensureDoctorHome } from "../config.js";
import { initLogger, log } from "../core/logger.js";
import { checkHealth } from "../core/health-checker.js";
import { restartGateway, RestartThrottle } from "../core/process-manager.js";
import { detectOpenClaw } from "../core/openclaw.js";
import { join } from "node:path";

export async function watchDaemon(options: {
  config?: string;
  profile?: string;
  daemon?: boolean;
  dashboard?: boolean;
}) {
  // ── Daemon mode: fork and exit ──
  if (options.daemon) {
    return daemonize(options);
  }

  // ── Foreground mode ──
  const config = loadConfig(options.config);
  initLogger();
  ensureDoctorHome();

  const info = detectOpenClaw(options.profile ?? config.openclawProfile);

  // Write PID so `stop` can find us even in foreground
  writeFileSync(PID_FILE, String(process.pid));

  log("info", "OpenClaw Doctor started (foreground)");
  log("info", `Gateway port: ${info.gatewayPort}`);
  log("info", `Channels: ${info.channels.join(", ") || "none detected"}`);
  log("info", `Check interval: ${config.checkInterval}s`);
  log("info", `PID: ${process.pid}`);

  if (options.dashboard) {
    const { startDashboard } = await import("../dashboard/server.js");
    startDashboard({ config: options.config });
  }

  const throttle = new RestartThrottle(config.maxRestartsPerHour);
  let consecutiveFailures = 0;
  let isRestarting = false;

  async function tick() {
    if (isRestarting) return;

    const result = await checkHealth(info);

    if (result.healthy) {
      consecutiveFailures = 0;
      return;
    }

    consecutiveFailures++;
    log(
      "warn",
      `Consecutive failures: ${consecutiveFailures}/${config.failThreshold}`,
    );

    if (consecutiveFailures >= config.failThreshold) {
      if (!throttle.canRestart()) {
        log(
          "error",
          `Restart throttled: ${throttle.recentCount()} restarts in the last hour (max ${config.maxRestartsPerHour})`,
        );
        return;
      }

      isRestarting = true;
      consecutiveFailures = 0;
      throttle.record();

      await restartGateway(info);

      log("info", "Waiting 30s for gateway to start...");
      await new Promise((r) => setTimeout(r, 60_000));
      isRestarting = false;
    }
  }

  await tick();
  setInterval(tick, config.checkInterval * 1000);

  const cleanup = () => {
    log("info", "OpenClaw Doctor stopped");
    try { unlinkSync(PID_FILE); } catch {}
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

function daemonize(options: {
  config?: string;
  profile?: string;
  dashboard?: boolean;
}) {
  ensureDoctorHome();

  // Check if already running
  const existingPid = readDaemonPid();
  if (existingPid && isProcessAlive(existingPid)) {
    console.log(chalk.yellow(`Doctor is already running (PID ${existingPid})`));
    return;
  }

  // Reconstruct the full node command including tsx loader flags from execArgv
  const execArgv = process.execArgv.filter(
    (a) => !a.includes("--eval"),
  );
  const scriptArgs = process.argv.slice(1).filter(
    (a) => a !== "-d" && a !== "--daemon",
  );
  const fullArgs = [...execArgv, ...scriptArgs];

  const outLog = join(DOCTOR_LOG_DIR, "daemon.out.log");
  const errLog = join(DOCTOR_LOG_DIR, "daemon.err.log");

  const out = openSync(outLog, "a");
  const err = openSync(errLog, "a");

  const child = spawn(process.execPath, fullArgs, {
    detached: true,
    stdio: ["ignore", out, err],
    env: { ...process.env, OPENCLAW_DOCTOR_DAEMON: "1" },
  });

  const pid = child.pid!;
  writeFileSync(PID_FILE, String(pid));
  child.unref();

  console.log(chalk.green(`Doctor started in background (PID ${pid})`));
  console.log(chalk.gray(`  Logs: ${outLog}`));
  console.log(chalk.gray(`  Stop: openclaw-doctor stop`));
}

export async function stopDaemon(options: { config?: string }) {
  const pid = readDaemonPid();

  if (!pid) {
    console.log(chalk.yellow("Doctor is not running (no PID file)"));
    return;
  }

  if (!isProcessAlive(pid)) {
    console.log(chalk.yellow(`Doctor is not running (PID ${pid} is dead, cleaning up)`));
    try { unlinkSync(PID_FILE); } catch {}
    return;
  }

  try {
    process.kill(pid, "SIGTERM");
    console.log(chalk.green(`Doctor stopped (PID ${pid})`));
  } catch (err) {
    console.log(chalk.red(`Failed to stop Doctor (PID ${pid}): ${err}`));
  }

  // Wait briefly then clean up PID file
  await new Promise((r) => setTimeout(r, 1000));
  try { unlinkSync(PID_FILE); } catch {}
}

function readDaemonPid(): number | null {
  if (!existsSync(PID_FILE)) return null;
  const raw = readFileSync(PID_FILE, "utf-8").trim();
  const pid = parseInt(raw, 10);
  return isNaN(pid) ? null : pid;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
