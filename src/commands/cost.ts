import chalk from "chalk";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { loadConfig } from "../config.js";
import { detectOpenClaw } from "../core/openclaw.js";

// Cost rates per 1M tokens (USD)
const RATES: Record<string, { input: number; output: number }> = {
  "claude-opus-4": { input: 15, output: 75 },
  "claude-sonnet-4": { input: 3, output: 15 },
  "claude-haiku-3-5": { input: 0.8, output: 4 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
};
const DEFAULT_RATE = { input: 3, output: 15 };

function getRate(model: string): { input: number; output: number } {
  // Try exact match first, then prefix match
  if (RATES[model]) return RATES[model];
  for (const [key, rate] of Object.entries(RATES)) {
    if (model.startsWith(key)) return rate;
  }
  return DEFAULT_RATE;
}

function calcCost(model: string, inputTokens: number, outputTokens: number): number {
  const rate = getRate(model);
  return (inputTokens * rate.input + outputTokens * rate.output) / 1_000_000;
}

interface UsageEntry {
  model: string;
  inputTokens: number;
  outputTokens: number;
  timestamp: number;
  agentName: string;
  agentId: string;
}

function expandHome(p: string): string {
  return p.startsWith("~/") ? join(homedir(), p.slice(2)) : p;
}

function scanSessionFiles(
  agents: { id: string; name: string; workspace?: string }[],
  sinceDays: number,
): UsageEntry[] {
  const entries: UsageEntry[] = [];
  const cutoff = Date.now() - sinceDays * 24 * 3600 * 1000;

  // Scan session dirs per agent
  for (const agent of agents) {
    const searchPaths: string[] = [];

    // Standard session dir
    searchPaths.push(join(homedir(), ".openclaw", "agents", agent.id, "sessions"));

    // Agent workspace logs
    if (agent.workspace) {
      const ws = expandHome(agent.workspace);
      searchPaths.push(join(ws, "sessions"));
      searchPaths.push(join(ws, "logs"));
    }

    for (const sessDir of searchPaths) {
      if (!existsSync(sessDir)) continue;

      const files = readdirSync(sessDir).filter((f) => f.endsWith(".jsonl") || f.endsWith(".json"));

      for (const file of files) {
        const fpath = join(sessDir, file);
        try {
          const mtime = statSync(fpath).mtimeMs;
          if (mtime < cutoff) continue;
        } catch {
          continue;
        }

        try {
          const lines = readFileSync(fpath, "utf-8").split("\n").filter(Boolean);
          for (const line of lines) {
            try {
              const msg = JSON.parse(line);
              if (msg.type !== "message" || !msg.message?.usage) continue;

              const usage = msg.message.usage;
              const ts = msg.timestamp ? new Date(msg.timestamp).getTime() : (msg.message?.timestamp ?? 0);
              if (ts < cutoff) continue;

              const model = msg.message?.model ?? msg.model ?? "unknown";
              const inputTokens = usage.input_tokens ?? usage.inputTokens ?? 0;
              const outputTokens = usage.output_tokens ?? usage.outputTokens ?? 0;

              if (inputTokens === 0 && outputTokens === 0) continue;

              entries.push({
                model,
                inputTokens,
                outputTokens,
                timestamp: ts,
                agentName: agent.name,
                agentId: agent.id,
              });
            } catch { /* skip malformed line */ }
          }
        } catch { /* skip unreadable file */ }
      }
    }
  }

  // Also scan global log dir
  const globalLogDir = join(homedir(), ".openclaw", "logs");
  if (existsSync(globalLogDir)) {
    const files = readdirSync(globalLogDir).filter((f) => f.endsWith(".jsonl"));
    for (const file of files) {
      const fpath = join(globalLogDir, file);
      try {
        const mtime = statSync(fpath).mtimeMs;
        if (mtime < cutoff) continue;
      } catch {
        continue;
      }

      try {
        const lines = readFileSync(fpath, "utf-8").split("\n").filter(Boolean);
        for (const line of lines) {
          try {
            const msg = JSON.parse(line);
            if (msg.type !== "message" || !msg.message?.usage) continue;

            const usage = msg.message.usage;
            const ts = msg.timestamp ? new Date(msg.timestamp).getTime() : (msg.message?.timestamp ?? 0);
            if (ts < cutoff) continue;

            const model = msg.message?.model ?? msg.model ?? "unknown";
            const inputTokens = usage.input_tokens ?? usage.inputTokens ?? 0;
            const outputTokens = usage.output_tokens ?? usage.outputTokens ?? 0;

            if (inputTokens === 0 && outputTokens === 0) continue;

            // Try to attribute to an agent
            const agentId = msg.agentId ?? msg.message?.agentId ?? "unknown";
            const agentName = msg.agentName ?? msg.message?.agentName ?? agentId;

            entries.push({ model, inputTokens, outputTokens, timestamp: ts, agentName, agentId });
          } catch { /* skip */ }
        }
      } catch { /* skip */ }
    }
  }

  return entries;
}

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export async function showCost(options: { config?: string; profile?: string; json?: boolean; days?: string }) {
  const config = loadConfig(options.config);
  const info = detectOpenClaw(options.profile ?? config.openclawProfile);
  const days = parseInt(options.days ?? "30", 10);

  if (info.agents.length === 0) {
    console.log(chalk.yellow("\n  No agents found in openclaw config."));
    console.log(chalk.gray("  Make sure openclaw is installed and configured.\n"));
    return;
  }

  const entries = scanSessionFiles(
    info.agents.map((a) => ({ id: a.id, name: a.name, workspace: a.workspace })),
    days,
  );

  if (entries.length === 0) {
    console.log(chalk.yellow("\n  No session logs found."));
    console.log(chalk.gray("  OpenClaw stores session logs in:"));
    console.log(chalk.gray(`    ~/.openclaw/agents/<agent-id>/sessions/`));
    console.log(chalk.gray(`    ~/.openclaw/logs/\n`));
    return;
  }

  const now = Date.now();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const weekStart = now - 7 * 24 * 3600 * 1000;
  const monthStart = now - 30 * 24 * 3600 * 1000;

  // Per-agent breakdown
  const byAgent: Record<string, { today: number; week: number; month: number; tokens: number }> = {};
  // Per-model breakdown
  const byModel: Record<string, { today: number; week: number; month: number; input: number; output: number }> = {};

  for (const e of entries) {
    const cost = calcCost(e.model, e.inputTokens, e.outputTokens);

    // Agent
    if (!byAgent[e.agentName]) byAgent[e.agentName] = { today: 0, week: 0, month: 0, tokens: 0 };
    const ag = byAgent[e.agentName];
    ag.tokens += e.inputTokens + e.outputTokens;
    if (e.timestamp >= monthStart) ag.month += cost;
    if (e.timestamp >= weekStart) ag.week += cost;
    if (e.timestamp >= todayStart.getTime()) ag.today += cost;

    // Model
    if (!byModel[e.model]) byModel[e.model] = { today: 0, week: 0, month: 0, input: 0, output: 0 };
    const md = byModel[e.model];
    md.input += e.inputTokens;
    md.output += e.outputTokens;
    if (e.timestamp >= monthStart) md.month += cost;
    if (e.timestamp >= weekStart) md.week += cost;
    if (e.timestamp >= todayStart.getTime()) md.today += cost;
  }

  const totalToday = Object.values(byAgent).reduce((s, a) => s + a.today, 0);
  const totalWeek = Object.values(byAgent).reduce((s, a) => s + a.week, 0);
  const totalMonth = Object.values(byAgent).reduce((s, a) => s + a.month, 0);

  if (options.json) {
    console.log(JSON.stringify({
      period: { days },
      summary: { today: totalToday, week: totalWeek, month: totalMonth, currency: "USD" },
      byAgent: Object.entries(byAgent).map(([name, v]) => ({ name, ...v })),
      byModel: Object.entries(byModel).map(([model, v]) => ({ model, ...v })),
      entries: entries.length,
    }, null, 2));
    return;
  }

  // Summary
  console.log(chalk.bold("\n  Token Cost Summary\n"));
  console.log(`  ${"Period".padEnd(14)} ${"Cost".padStart(10)}`);
  console.log(`  ${"─".repeat(14)} ${"─".repeat(10)}`);
  console.log(`  ${"Today".padEnd(14)} ${chalk.green(formatCost(totalToday).padStart(10))}`);
  console.log(`  ${"This week".padEnd(14)} ${chalk.cyan(formatCost(totalWeek).padStart(10))}`);
  console.log(`  ${"Last 30 days".padEnd(14)} ${chalk.yellow(formatCost(totalMonth).padStart(10))}`);

  // Per-agent
  const agentEntries = Object.entries(byAgent).sort((a, b) => b[1].month - a[1].month);
  if (agentEntries.length > 0) {
    console.log(chalk.bold("\n  By Agent\n"));
    console.log(`  ${"Agent".padEnd(20)} ${"Today".padStart(10)} ${"Week".padStart(10)} ${"Month".padStart(10)} ${"Tokens".padStart(10)}`);
    console.log(`  ${"─".repeat(20)} ${"─".repeat(10)} ${"─".repeat(10)} ${"─".repeat(10)} ${"─".repeat(10)}`);
    for (const [name, v] of agentEntries) {
      console.log(`  ${name.padEnd(20)} ${formatCost(v.today).padStart(10)} ${formatCost(v.week).padStart(10)} ${formatCost(v.month).padStart(10)} ${chalk.gray(formatTokens(v.tokens).padStart(10))}`);
    }
  }

  // Per-model
  const modelEntries = Object.entries(byModel).sort((a, b) => b[1].month - a[1].month);
  if (modelEntries.length > 0) {
    console.log(chalk.bold("\n  By Model\n"));
    console.log(`  ${"Model".padEnd(24)} ${"Today".padStart(10)} ${"Week".padStart(10)} ${"Month".padStart(10)} ${"In Tokens".padStart(10)} ${"Out Tokens".padStart(10)}`);
    console.log(`  ${"─".repeat(24)} ${"─".repeat(10)} ${"─".repeat(10)} ${"─".repeat(10)} ${"─".repeat(10)} ${"─".repeat(10)}`);
    for (const [model, v] of modelEntries) {
      console.log(`  ${model.padEnd(24)} ${formatCost(v.today).padStart(10)} ${formatCost(v.week).padStart(10)} ${formatCost(v.month).padStart(10)} ${chalk.gray(formatTokens(v.input).padStart(10))} ${chalk.gray(formatTokens(v.output).padStart(10))}`);
    }
  }

  console.log();
}
