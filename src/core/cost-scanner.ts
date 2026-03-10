import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface AgentCostSummary {
  agentId: string;
  agentName: string;
  todayCost: number;
  weekCost: number;
  totalTokens: number;
  sessionCount: number;
}

export interface CostSummary {
  agents: AgentCostSummary[];
  todayTotal: number;
  weekTotal: number;
  currency: string;
}

function parseSessionCosts(filePath: string, sinceMs: number): { cost: number; tokens: number } {
  let cost = 0;
  let tokens = 0;
  try {
    const lines = readFileSync(filePath, "utf-8").split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const msg = JSON.parse(line);
        if (msg.type !== "message" || !msg.message?.usage?.cost) continue;
        const ts = msg.timestamp ? new Date(msg.timestamp).getTime() : (msg.message?.timestamp ?? 0);
        if (ts < sinceMs) continue;
        cost += msg.message.usage.cost.total ?? 0;
        tokens += msg.message.usage.totalTokens ?? 0;
      } catch {}
    }
  } catch {}
  return { cost, tokens };
}

export function scanCosts(agents: { id: string; name: string }[]): CostSummary {
  const now = Date.now();
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const weekStart = now - 7 * 24 * 3600 * 1000;

  const result: AgentCostSummary[] = [];

  for (const agent of agents) {
    const sessDir = join(homedir(), ".openclaw", "agents", agent.id, "sessions");
    if (!existsSync(sessDir)) continue;

    let todayCost = 0, weekCost = 0, totalTokens = 0, sessionCount = 0;

    const files = readdirSync(sessDir).filter((f) => f.endsWith(".jsonl"));
    sessionCount = files.length;

    for (const file of files) {
      const fpath = join(sessDir, file);
      try {
        const mtime = statSync(fpath).mtimeMs;
        // Skip files untouched in 7 days (optimization)
        if (mtime < weekStart) continue;
      } catch { continue; }

      const week = parseSessionCosts(fpath, weekStart);
      weekCost += week.cost;
      totalTokens += week.tokens;

      const today = parseSessionCosts(fpath, todayStart.getTime());
      todayCost += today.cost;
    }

    result.push({ agentId: agent.id, agentName: agent.name, todayCost, weekCost, totalTokens, sessionCount });
  }

  return {
    agents: result,
    todayTotal: result.reduce((s, a) => s + a.todayCost, 0),
    weekTotal: result.reduce((s, a) => s + a.weekCost, 0),
    currency: "USD",
  };
}
