import { appendFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";

export type LogLevel = "info" | "warn" | "error" | "success";

import { DOCTOR_LOG_DIR, ensureDoctorHome } from "../config.js";

let logDir = DOCTOR_LOG_DIR;

export function initLogger(dir?: string) {
  logDir = dir ?? DOCTOR_LOG_DIR;
  ensureDoctorHome();
}

function getLogFile(): string {
  const date = new Date().toISOString().slice(0, 10);
  return join(logDir, `${date}.log`);
}

export function log(level: LogLevel, message: string) {
  const time = new Date().toISOString();
  const line = `[${time}] [${level.toUpperCase()}] ${message}`;

  // Console output
  const colorFn =
    level === "error"
      ? chalk.red
      : level === "warn"
        ? chalk.yellow
        : level === "success"
          ? chalk.green
          : chalk.blue;
  console.log(colorFn(line));

  // File output
  try {
    appendFileSync(getLogFile(), line + "\n");
  } catch {
    // Silently ignore file write errors
  }
}

export interface CheckRecord {
  timestamp: string;
  healthy: boolean;
  statusCode?: number;
  error?: string;
  responseTime?: number;
}

export interface RestartRecord {
  timestamp: string;
  reason: string;
  success: boolean;
}

// In-memory history for dashboard
const checkHistory: CheckRecord[] = [];
const restartHistory: RestartRecord[] = [];
const MAX_HISTORY = 100;

export function addCheckRecord(record: CheckRecord) {
  checkHistory.push(record);
  if (checkHistory.length > MAX_HISTORY) checkHistory.shift();
}

export function addRestartRecord(record: RestartRecord) {
  restartHistory.push(record);
  if (restartHistory.length > MAX_HISTORY) restartHistory.shift();
}

export function getCheckHistory(): CheckRecord[] {
  return [...checkHistory];
}

export function getRestartHistory(): RestartRecord[] {
  return [...restartHistory];
}
