import { readFileSync, writeFileSync, existsSync } from "node:fs";
import chalk from "chalk";
import { loadConfig } from "../config.js";
import { detectOpenClaw, runOpenClawCmd } from "../core/openclaw.js";
import { checkHealth } from "../core/health-checker.js";
import { trackCommand } from "../telemetry.js";

interface ConfigIssue {
  path: string;
  message: string;
  fix: () => void;
}

function findConfigIssues(configPath: string): ConfigIssue[] {
  if (!existsSync(configPath)) return [];

  let raw: any;
  try {
    raw = JSON.parse(readFileSync(configPath, "utf-8"));
  } catch {
    return [{ path: "root", message: "Config file is not valid JSON", fix: () => {} }];
  }

  const issues: ConfigIssue[] = [];

  // Check agents.list[].workspace — must be string, not array
  if (Array.isArray(raw.agents?.list)) {
    for (let i = 0; i < raw.agents.list.length; i++) {
      const agent = raw.agents.list[i];
      if (Array.isArray(agent.workspace)) {
        const idx = i;
        issues.push({
          path: `agents.list.${i}.workspace`,
          message: `Invalid input: expected string, received array`,
          fix: () => {
            raw.agents.list[idx].workspace = raw.agents.list[idx].workspace[0];
          },
        });
      }
    }
  }

  // Attach a save helper
  if (issues.length > 0) {
    const originalFixes = issues.map((issue) => issue.fix);
    for (let i = 0; i < issues.length; i++) {
      const origFix = originalFixes[i];
      issues[i].fix = () => {
        origFix();
        writeFileSync(configPath, JSON.stringify(raw, null, 2) + "\n");
      };
    }
  }

  return issues;
}

export async function runDoctor(options: {
  config?: string;
  profile?: string;
  fix?: boolean;
}) {
  const config = loadConfig(options.config);
  const info = detectOpenClaw(options.profile ?? config.openclawProfile);

  console.log(chalk.bold("\n  OpenClaw Doctor — Full Diagnostics\n"));

  // 0. Config validation & auto-fix
  console.log(chalk.gray("  [0/4] Config validation"));
  const issues = findConfigIssues(info.configPath);
  if (issues.length === 0) {
    console.log(chalk.green("    Config: valid"));
  } else {
    for (const issue of issues) {
      console.log(chalk.red(`    ${issue.path}: ${issue.message}`));
    }
    if (options.fix) {
      for (const issue of issues) {
        issue.fix();
        console.log(chalk.green(`    Fixed: ${issue.path}`));
      }
      console.log(chalk.green(`    Config saved: ${info.configPath}`));
    } else {
      console.log(chalk.yellow("    Run with --fix to auto-repair"));
    }
  }

  // 1. Check openclaw binary
  console.log(chalk.gray("\n  [1/4] OpenClaw binary"));
  if (info.cliBinPath) {
    console.log(chalk.green(`    Found: ${info.cliBinPath}`));
    console.log(chalk.gray(`    Node: ${info.nodePath}`));
    if (info.version) console.log(chalk.gray(`    Version: ${info.version}`));
  } else {
    console.log(chalk.red("    Not found — openclaw CLI is not installed or not in PATH"));
  }

  // 2. Check gateway health
  console.log(chalk.gray("\n  [2/4] Gateway health"));
  const result = await checkHealth(info);
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
  const doctorOutput = await runOpenClawCmd(info, "doctor");
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

  // 5. Auto-repair (--fix only, when gateway unhealthy)
  if (options.fix) {
    console.log(chalk.gray("\n  [5/5] Auto-repair"));
    if (!result.healthy) {
      console.log(chalk.yellow("    Gateway unhealthy — running openclaw doctor --repair --non-interactive"));
      const repairOutput = await runOpenClawCmd(info, "doctor --repair --non-interactive");
      if (repairOutput) {
        const lines = repairOutput.split("\n");
        for (const line of lines.slice(0, 30)) {
          if (line.trim()) console.log(`    ${line}`);
        }
        console.log(chalk.green("    Repair completed"));
      } else {
        console.log(chalk.yellow("    Could not run repair (openclaw CLI unavailable)"));
      }
    } else {
      console.log(chalk.green("    Gateway healthy — no repair needed"));
    }
  }

  trackCommand("doctor", true).catch(() => {});
  console.log();
}
