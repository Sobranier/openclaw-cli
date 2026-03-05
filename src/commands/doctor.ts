import chalk from "chalk";
import { loadConfig } from "../config.js";
import { detectOpenClaw, runOpenClawCmd } from "../core/openclaw.js";
import { checkHealth } from "../core/health-checker.js";

export async function runDoctor(options: {
  config?: string;
  profile?: string;
}) {
  const config = loadConfig(options.config);
  const info = detectOpenClaw(options.profile ?? config.openclawProfile);

  console.log(chalk.bold("\n  OpenClaw Doctor — Full Diagnostics\n"));

  // 1. Check openclaw binary
  console.log(chalk.gray("  [1/4] OpenClaw binary"));
  if (info.cliBinPath) {
    console.log(chalk.green(`    Found: ${info.cliBinPath}`));
    console.log(chalk.gray(`    Node: ${info.nodePath}`));
    if (info.version) console.log(chalk.gray(`    Version: ${info.version}`));
  } else {
    console.log(chalk.red("    Not found — openclaw CLI is not installed or not in PATH"));
  }

  // 2. Check gateway health
  console.log(chalk.gray("\n  [2/4] Gateway health"));
  const result = checkHealth(info);
  if (result.healthy) {
    console.log(chalk.green(`    Gateway: healthy (port ${info.gatewayPort}, ${result.durationMs}ms)`));
  } else if (result.gateway) {
    console.log(chalk.yellow(`    Gateway: responded but degraded`));
  } else {
    console.log(chalk.red(`    Gateway: unreachable`));
    if (result.error) console.log(chalk.red(`    ${result.error}`));
  }

  // 3. Channel status
  console.log(chalk.gray("\n  [3/4] Channels"));
  if (result.channels.length > 0) {
    for (const ch of result.channels) {
      const status = ch.ok
        ? chalk.green("ok")
        : chalk.red("fail");
      console.log(`    ${ch.name}: ${status}`);
    }
  } else {
    console.log(chalk.yellow("    No channel data available"));
  }

  // 4. Run openclaw doctor (proxy)
  console.log(chalk.gray("\n  [4/4] OpenClaw built-in doctor"));
  const doctorOutput = runOpenClawCmd(info, "doctor");
  if (doctorOutput) {
    // Indent and print, strip ANSI art header
    const lines = doctorOutput.split("\n");
    const startIdx = lines.findIndex((l) => l.includes("OpenClaw doctor") || l.includes("Gateway service"));
    const relevant = startIdx >= 0 ? lines.slice(startIdx) : lines;
    for (const line of relevant) {
      console.log(`    ${line}`);
    }
  } else {
    console.log(chalk.yellow("    Could not run openclaw doctor"));
  }

  console.log();
}
