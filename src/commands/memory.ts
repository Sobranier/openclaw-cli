import chalk from "chalk";
import { existsSync, statSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join, relative, basename } from "node:path";
import { homedir } from "node:os";
import { createInterface } from "node:readline";
import { loadConfig } from "../config.js";
import { detectOpenClaw, runOpenClawCmd } from "../core/openclaw.js";

function expandHome(p: string): string {
  return p.startsWith("~/") ? join(homedir(), p.slice(2)) : p;
}

function getAgentMemoryPaths(agents: { name: string; workspace?: string }[]): { agent: string; dir: string }[] {
  const paths: { agent: string; dir: string }[] = [];
  for (const agent of agents) {
    const ws = (agent as any).workspace;
    if (!ws) continue;
    const wsPath = expandHome(ws);
    if (existsSync(wsPath)) {
      paths.push({ agent: agent.name, dir: wsPath });
    }
  }
  return paths;
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

  const agentPaths = getAgentMemoryPaths(info.agents);
  let found = false;

  for (const { agent, dir } of agentPaths) {
    const filesToSearch: string[] = [];

    // MEMORY.md
    const memPath = join(dir, "MEMORY.md");
    if (existsSync(memPath)) filesToSearch.push(memPath);

    // memory/ directory (daily files and other memory files)
    const memDir = join(dir, "memory");
    if (existsSync(memDir)) {
      try {
        const files = readdirSync(memDir).filter((f) => f.endsWith(".md"));
        for (const f of files) {
          filesToSearch.push(join(memDir, f));
        }
      } catch { /* skip */ }
    }

    for (const filePath of filesToSearch) {
      try {
        const content = readFileSync(filePath, "utf-8");
        const lines = content.split("\n");
        const lowerQuery = query.toLowerCase();

        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(lowerQuery)) {
            if (!found) found = true;
            const relPath = basename(filePath);
            const contextStart = Math.max(0, i - 1);
            const contextEnd = Math.min(lines.length, i + 2);
            const context = lines.slice(contextStart, contextEnd).map((l, idx) => {
              const lineNum = contextStart + idx + 1;
              const prefix = lineNum === i + 1 ? chalk.yellow("→") : " ";
              return `  ${prefix} ${chalk.gray(`${lineNum}:`)} ${l}`;
            }).join("\n");

            console.log(`  ${chalk.cyan(agent)} ${chalk.gray("/")} ${chalk.white(relPath)}${chalk.gray(`:${i + 1}`)}`);
            console.log(context);
            console.log();
          }
        }
      } catch { /* skip unreadable */ }
    }
  }

  if (!found) {
    // Fallback to openclaw CLI search
    const output = await runOpenClawCmd(info, `memory search "${query}"`);
    if (output) {
      console.log(output);
    } else {
      console.log(chalk.yellow("  No results found."));
    }
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

export async function memoryGc(options: { config?: string; profile?: string; days?: string; force?: boolean }) {
  const config = loadConfig(options.config);
  const info = detectOpenClaw(options.profile ?? config.openclawProfile);
  const maxAgeDays = parseInt(options.days ?? "30", 10);
  const cutoff = Date.now() - maxAgeDays * 24 * 3600 * 1000;

  console.log(chalk.bold(`\n  Memory GC — removing daily files older than ${maxAgeDays} days\n`));

  const agentPaths = getAgentMemoryPaths(info.agents);
  const filesToDelete: { path: string; agent: string; name: string; size: number }[] = [];

  // Match daily memory files: YYYY-MM-DD.md
  const dailyPattern = /^\d{4}-\d{2}-\d{2}\.md$/;

  for (const { agent, dir } of agentPaths) {
    const memDir = join(dir, "memory");
    if (!existsSync(memDir)) continue;

    try {
      const files = readdirSync(memDir).filter((f) => dailyPattern.test(f));
      for (const f of files) {
        const fpath = join(memDir, f);
        try {
          const stat = statSync(fpath);
          if (stat.mtimeMs < cutoff) {
            filesToDelete.push({ path: fpath, agent, name: f, size: stat.size });
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }

  if (filesToDelete.length === 0) {
    console.log(chalk.green("  No old daily memory files found. Nothing to clean up.\n"));
    return;
  }

  console.log(`  Found ${chalk.yellow(String(filesToDelete.length))} files to remove:\n`);
  for (const f of filesToDelete) {
    const sizeKB = Math.round(f.size / 1024);
    console.log(`  ${chalk.gray("•")} ${f.agent} / ${f.name} ${chalk.gray(`(${sizeKB}KB)`)}`);
  }
  console.log();

  const totalKB = Math.round(filesToDelete.reduce((s, f) => s + f.size, 0) / 1024);
  console.log(`  Total: ${chalk.yellow(`${totalKB}KB`)} across ${filesToDelete.length} files\n`);

  if (!options.force) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise<string>((resolve) => {
      rl.question("  Delete these files? [y/N] ", resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== "y") {
      console.log(chalk.gray("  Cancelled.\n"));
      return;
    }
  }

  let deleted = 0;
  for (const f of filesToDelete) {
    try {
      unlinkSync(f.path);
      deleted++;
    } catch (err) {
      console.log(chalk.red(`  Failed to delete ${f.name}: ${err}`));
    }
  }

  console.log(chalk.green(`\n  Deleted ${deleted} files.\n`));
}

export async function memoryExport(options: { config?: string; profile?: string; output?: string }) {
  const config = loadConfig(options.config);
  const info = detectOpenClaw(options.profile ?? config.openclawProfile);

  const agentPaths = getAgentMemoryPaths(info.agents);
  const parts: string[] = [];

  parts.push(`# OpenClaw Memory Export`);
  parts.push(`# Generated: ${new Date().toISOString()}\n`);

  for (const { agent, dir } of agentPaths) {
    const agentParts: string[] = [];

    // MEMORY.md
    const memPath = join(dir, "MEMORY.md");
    if (existsSync(memPath)) {
      try {
        const content = readFileSync(memPath, "utf-8");
        agentParts.push(`### MEMORY.md\n\n${content}`);
      } catch { /* skip */ }
    }

    // memory/ directory
    const memDir = join(dir, "memory");
    if (existsSync(memDir)) {
      try {
        const files = readdirSync(memDir).filter((f) => f.endsWith(".md")).sort();
        for (const f of files) {
          try {
            const content = readFileSync(join(memDir, f), "utf-8");
            agentParts.push(`### memory/${f}\n\n${content}`);
          } catch { /* skip */ }
        }
      } catch { /* skip */ }
    }

    if (agentParts.length > 0) {
      parts.push(`## Agent: ${agent}\n`);
      parts.push(agentParts.join("\n---\n\n"));
      parts.push("");
    }
  }

  if (parts.length <= 2) {
    console.log(chalk.yellow("\n  No memory files found to export.\n"));
    return;
  }

  const result = parts.join("\n");

  if (options.output) {
    writeFileSync(options.output, result, "utf-8");
    console.log(chalk.green(`\n  Exported memory to ${options.output}\n`));
  } else {
    console.log(result);
  }
}
