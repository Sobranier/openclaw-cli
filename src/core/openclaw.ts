import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import * as http from "node:http";
const execAsync = promisify(exec);

export interface OpenClawInfo {
  configPath: string;
  gatewayPort: number;
  gatewayToken: string;
  launchdLabel: string;
  nodePath: string;
  cliBinPath: string;
  logDir: string;
  profile: string;
  channels: string[];
  agents: { id: string; name: string; isDefault: boolean; model?: string; workspace?: string }[];
  version: string | null;
}

function getOpenClawHome(profile: string): string {
  if (profile === "dev") return join(homedir(), ".openclaw-dev");
  if (profile !== "default") return join(homedir(), `.openclaw-${profile}`);
  return join(homedir(), ".openclaw");
}

function findOpenClawBin(): { nodePath: string; cliBinPath: string } | null {
  // Check launchd plist first for exact paths
  const plistDir = join(homedir(), "Library", "LaunchAgents");
  if (existsSync(plistDir)) {
    const plists = readdirSync(plistDir).filter((f) =>
      f.includes("openclaw") && f.endsWith(".plist"),
    );
    for (const plist of plists) {
      const content = readFileSync(join(plistDir, plist), "utf-8");
      const nodeMatch = content.match(
        /<string>(\/[^<]*\/bin\/node)<\/string>/,
      );
      const cliMatch = content.match(
        /<string>(\/[^<]*openclaw[^<]*\.(?:js|mjs))<\/string>/,
      );
      if (nodeMatch && cliMatch) {
        return { nodePath: nodeMatch[1], cliBinPath: cliMatch[1] };
      }
    }
  }

  // Fallback: try `which openclaw`
  try {
    const bin = execSync("which openclaw", { encoding: "utf-8" }).trim();
    if (bin) return { nodePath: process.execPath, cliBinPath: bin };
  } catch {
    // not in PATH
  }

  return null;
}

function findLaunchdLabel(): string {
  const plistDir = join(homedir(), "Library", "LaunchAgents");
  if (!existsSync(plistDir)) return "ai.openclaw.gateway";
  const plists = readdirSync(plistDir).filter(
    (f) => f.includes("openclaw") && f.endsWith(".plist"),
  );
  if (plists.length > 0) {
    return plists[0].replace(".plist", "");
  }
  return "ai.openclaw.gateway";
}

export function detectOpenClaw(profile = "default"): OpenClawInfo {
  const home = getOpenClawHome(profile);
  const configPath = join(home, "openclaw.json");
  const logDir = join(home, "logs");

  const defaults: OpenClawInfo = {
    configPath,
    gatewayPort: 18789,
    gatewayToken: "",
    launchdLabel: findLaunchdLabel(),
    nodePath: process.execPath,
    cliBinPath: "",
    logDir,
    profile,
    channels: [],
    agents: [],
    version: null,
  };

  // Find openclaw binary
  const binInfo = findOpenClawBin();
  if (binInfo) {
    defaults.nodePath = binInfo.nodePath;
    defaults.cliBinPath = binInfo.cliBinPath;
  }

  // Read openclaw.json
  if (!existsSync(configPath)) {
    return defaults;
  }

  try {
    const raw = JSON.parse(readFileSync(configPath, "utf-8"));

    defaults.gatewayPort = raw.gateway?.port ?? defaults.gatewayPort;
    defaults.gatewayToken = raw.gateway?.auth?.token ?? "";
    defaults.version = raw.meta?.lastTouchedVersion ?? null;

    // Channels
    if (raw.channels) {
      defaults.channels = Object.entries(raw.channels)
        .filter(([, v]) => (v as { enabled?: boolean }).enabled !== false)
        .map(([k]) => k);
    }

    // Agents
    if (raw.agents?.list) {
      defaults.agents = raw.agents.list.map(
        (a: { id: string; name?: string; default?: boolean; model?: string | { primary?: string }; workspace?: string }) => ({
          id: a.id,
          name: a.name ?? a.id,
          isDefault: a.default ?? false,
          model: typeof a.model === "string" ? a.model : (a.model?.primary ?? raw.agents?.defaults?.model?.primary ?? undefined),
          workspace: a.workspace,
        }),
      );
    }
  } catch {
    // Corrupted config, use defaults
  }

  return defaults;
}

export async function runOpenClawCmd(
  info: OpenClawInfo,
  args: string,
): Promise<string | null> {
  if (!info.cliBinPath) return null;
  try {
    const { stdout } = await execAsync(`"${info.nodePath}" "${info.cliBinPath}" ${args}`, {
      timeout: 30_000,
      env: { ...process.env, NODE_NO_WARNINGS: "1" },
    });
    return stdout.trim();
  } catch {
    return null;
  }
}

export interface AgentRuntime {
  agentId: string;
  name: string;
  isDefault: boolean;
  heartbeat?: { enabled: boolean; every: string };
  sessions?: { count: number; recent: { key: string; updatedAt: number; age: number }[] };
}

export interface GatewayHealth {
  ok: boolean;
  durationMs: number;
  channels: Record<
    string,
    { configured: boolean; probe: { ok: boolean } }
  >;
  agents: AgentRuntime[];
}


export async function getGatewayHealthHttp(
  info: OpenClawInfo,
): Promise<GatewayHealth | null> {
  return new Promise((resolve) => {
    const url = `http://127.0.0.1:${info.gatewayPort}/health`;
    const req = http.get(url, { timeout: 5000 }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}

export async function getGatewayHealth(
  info: OpenClawInfo,
): Promise<GatewayHealth | null> {
  const raw = await runOpenClawCmd(info, "health --json");
  if (!raw) return null;
  try {
    // Strip any non-JSON lines (deprecation warnings etc.)
    const jsonStart = raw.indexOf("{");
    if (jsonStart === -1) return null;
    return JSON.parse(raw.slice(jsonStart));
  } catch {
    return null;
  }
}

export function getRestartCommand(info: OpenClawInfo): string {
  const uid = process.getuid?.() ?? 501;
  return `launchctl kickstart -k gui/${uid}/${info.launchdLabel}`;
}

export function getStopCommand(info: OpenClawInfo): string {
  const uid = process.getuid?.() ?? 501;
  return `launchctl kill SIGTERM gui/${uid}/${info.launchdLabel}`;
}

export function getStartCommand(info: OpenClawInfo): string {
  const uid = process.getuid?.() ?? 501;
  return `launchctl kickstart gui/${uid}/${info.launchdLabel}`;
}
