import { execSync } from "node:child_process";
import { log, addRestartRecord } from "./logger.js";
import {
  type OpenClawInfo,
  getRestartCommand,
  getStartCommand,
  getStopCommand,
} from "./openclaw.js";

export interface CommandResult {
  success: boolean;
  output?: string;
  error?: string;
}

function runShell(command: string): CommandResult {
  try {
    const output = execSync(command, {
      encoding: "utf-8",
      timeout: 120_000,
    }).trim();
    return { success: true, output };
  } catch (err) {
    const error =
      err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}

export function restartGateway(info: OpenClawInfo): CommandResult {
  const cmd = getRestartCommand(info);
  log("warn", `Restarting gateway: ${cmd}`);

  const result = runShell(cmd);

  if (result.success) {
    log("success", "Gateway restarted");
  } else {
    log("error", `Gateway restart failed: ${result.error}`);
  }

  addRestartRecord({
    timestamp: new Date().toISOString(),
    reason: "health check failed",
    success: result.success,
  });

  return result;
}

export function startGateway(info: OpenClawInfo): CommandResult {
  const cmd = getStartCommand(info);
  log("info", `Starting gateway: ${cmd}`);
  const result = runShell(cmd);
  if (result.success) log("success", "Gateway started");
  else log("error", `Gateway start failed: ${result.error}`);
  return result;
}

export function stopGateway(info: OpenClawInfo): CommandResult {
  const cmd = getStopCommand(info);
  log("info", `Stopping gateway: ${cmd}`);
  const result = runShell(cmd);
  if (result.success) log("success", "Gateway stopped");
  else log("error", `Gateway stop failed: ${result.error}`);
  return result;
}

export class RestartThrottle {
  private timestamps: number[] = [];

  constructor(private maxPerHour: number) {}

  canRestart(): boolean {
    const oneHourAgo = Date.now() - 3600_000;
    this.timestamps = this.timestamps.filter((t) => t > oneHourAgo);
    return this.timestamps.length < this.maxPerHour;
  }

  record() {
    this.timestamps.push(Date.now());
  }

  recentCount(): number {
    const oneHourAgo = Date.now() - 3600_000;
    return this.timestamps.filter((t) => t > oneHourAgo).length;
  }
}
