import { readFileSync, existsSync } from "node:fs";
import chalk from "chalk";
import { DOCTOR_LOG_DIR } from "../config.js";
import { detectOpenClaw } from "../core/openclaw.js";
import { loadConfig } from "../config.js";

export function showLogs(options: {
  config?: string;
  profile?: string;
  lines?: string;
  error?: boolean;
  doctor?: boolean;
  tail?: boolean;
}) {
  const config = loadConfig(options.config);
  const maxLines = parseInt(options.lines ?? "50", 10);

  if (options.doctor) {
    showDoctorLogs(maxLines);
    return;
  }

  // Show OpenClaw gateway logs
  const info = detectOpenClaw(options.profile ?? config.openclawProfile);
  const logFile = options.error
    ? `${info.logDir}/gateway.err.log`
    : `${info.logDir}/gateway.log`;

  if (!existsSync(logFile)) {
    console.log(chalk.yellow(`Log file not found: ${logFile}`));
    return;
  }

  console.log(chalk.blue.bold(`\n  ${logFile}\n`));

  const content = readFileSync(logFile, "utf-8");
  const lines = content.trim().split("\n");
  const tail = lines.slice(-maxLines);

  for (const line of tail) {
    if (line.includes("[error]") || line.includes("[ERROR]")) {
      console.log(chalk.red(line));
    } else if (line.includes("[warn]") || line.includes("[WARN]")) {
      console.log(chalk.yellow(line));
    } else {
      console.log(chalk.gray(line));
    }
  }
  console.log();
}

function showDoctorLogs(maxLines: number) {
  // Find latest doctor log file
  const { readdirSync } = require("node:fs");
  const { join } = require("node:path");

  if (!existsSync(DOCTOR_LOG_DIR)) {
    console.log(chalk.yellow("No doctor logs found."));
    return;
  }

  const files = (readdirSync(DOCTOR_LOG_DIR) as string[])
    .filter((f: string) => f.endsWith(".log"))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.log(chalk.yellow("No doctor log files found."));
    return;
  }

  const latest = files[0];
  console.log(chalk.blue.bold(`\n  ${join(DOCTOR_LOG_DIR, latest)}\n`));

  const content = readFileSync(join(DOCTOR_LOG_DIR, latest), "utf-8");
  const lines = content.trim().split("\n");
  const tail = lines.slice(-maxLines);

  for (const line of tail) {
    if (line.includes("[ERROR]")) {
      console.log(chalk.red(line));
    } else if (line.includes("[WARN]")) {
      console.log(chalk.yellow(line));
    } else if (line.includes("[SUCCESS]")) {
      console.log(chalk.green(line));
    } else {
      console.log(chalk.gray(line));
    }
  }
  console.log();
}
