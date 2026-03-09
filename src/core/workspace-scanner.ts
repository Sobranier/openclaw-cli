import { existsSync, statSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import type { OpenClawInfo } from "./openclaw.js";

export interface WorkspaceInfo {
  agentId: string;
  agentName: string;
  workspacePath: string;
  memoryFileSizeKB: number;
  memoryWarning: boolean;
  totalWorkspaceSizeKB: number;
  sessionCount: number;
  model?: string;
}

function expandHome(p: string): string {
  return p.startsWith("~/") ? join(homedir(), p.slice(2)) : p;
}

function dirSizeKB(dir: string, depth = 0): number {
  if (depth > 4 || !existsSync(dir)) return 0;
  let total = 0;
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", ".git", ".DS_Store"].includes(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        total += dirSizeKB(full, depth + 1);
      } else {
        try { total += statSync(full).size; } catch {}
      }
    }
  } catch {}
  return Math.round(total / 1024);
}

export function scanWorkspaces(info: OpenClawInfo): WorkspaceInfo[] {
  const results: WorkspaceInfo[] = [];
  for (const agent of info.agents) {
    const workspaceRaw = (agent as any).workspace;
    if (!workspaceRaw) continue;
    const workspacePath = expandHome(workspaceRaw);

    let memoryFileSizeKB = 0;
    try {
      const memPath = join(workspacePath, "MEMORY.md");
      if (existsSync(memPath)) {
        memoryFileSizeKB = Math.round(statSync(memPath).size / 1024);
      }
    } catch {}

    let totalWorkspaceSizeKB = 0;
    try { totalWorkspaceSizeKB = dirSizeKB(workspacePath); } catch {}

    let sessionCount = 0;
    try {
      const sessDir = join(homedir(), ".openclaw", "agents", agent.id, "sessions");
      if (existsSync(sessDir)) {
        sessionCount = readdirSync(sessDir).filter((f) => f.endsWith(".jsonl") || f.endsWith(".json")).length;
      }
    } catch {}

    results.push({
      agentId: agent.id,
      agentName: agent.name,
      workspacePath,
      memoryFileSizeKB,
      memoryWarning: memoryFileSizeKB > 50,
      totalWorkspaceSizeKB,
      sessionCount,
      model: (agent as any).model,
    });
  }
  return results;
}
