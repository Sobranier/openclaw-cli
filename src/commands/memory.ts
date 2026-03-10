import chalk from "chalk";
import { existsSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { loadConfig } from "../config.js";
import { detectOpenClaw, runOpenClawCmd } from "../core/openclaw.js";

function expandHome(p: string): string {
  return p.startsWith("~/") ? join(homedir(), p.slice(2)) : p;
}

export async function memoryStatus(options: { config?: string; profile?: string }) {
  const config = loadConfig(options.config);
  const info = detectOpenClaw(options.profile ?? config.openclawProfile);

  console.log(chalk.bold("\n  Memory Status\n"));

  for (const agent of info.agents) {
    const ws = (agent as any).workspace;
    if (!ws) continue;
    const wsPath = expandHome(ws);
    const memPath = join(wsPath, "MEMORY.md");

    const exists = existsSync(memPath);
    const sizeKB = exists ? Math.round(statSync(memPath).size / 1024) : 0;
    const warn = sizeKB > 50;

    const indicator = warn ? chalk.yellow("⚠") : chalk.green("✓");
    const sizeStr = warn ? chalk.yellow(`${sizeKB}KB`) : chalk.gray(`${sizeKB}KB`);
    console.log(`  ${indicator} ${agent.name.padEnd(16)} MEMORY.md: ${sizeStr}${warn ? chalk.yellow("  — exceeds 50KB, may waste tokens") : ""}`);
  }
  console.log();
}

export async function memorySearch(query: string, options: { config?: string; profile?: string }) {
  const config = loadConfig(options.config);
  const info = detectOpenClaw(options.profile ?? config.openclawProfile);

  console.log(chalk.bold(`\n  Searching memory: "${query}"\n`));
  const output = await runOpenClawCmd(info, `memory search "${query}"`);
  if (output) {
    console.log(output);
  } else {
    console.log(chalk.yellow("  No results or openclaw memory search unavailable"));
  }
  console.log();
}

export async function memoryCompact(options: { config?: string; profile?: string; dryRun?: boolean }) {
  const config = loadConfig(options.config);
  const info = detectOpenClaw(options.profile ?? config.openclawProfile);

  const flag = options.dryRun ? "--dry-run" : "";
  console.log(chalk.bold(`\n  Memory Compact${options.dryRun ? " (dry run)" : ""}\n`));
  const output = await runOpenClawCmd(info, `memory compact ${flag}`);
  if (output) {
    console.log(output);
  } else {
    console.log(chalk.yellow("  openclaw memory compact not available"));
  }
  console.log();
}
