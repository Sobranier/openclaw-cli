import { log, addCheckRecord } from "./logger.js";
import {
  type OpenClawInfo,
  type GatewayHealth,
  getGatewayHealth,
  getGatewayHealthHttp,
} from "./openclaw.js";

export interface HealthResult {
  healthy: boolean;
  gateway: boolean;
  channels: { name: string; ok: boolean }[];
  agentRuntimes: import("./openclaw.js").AgentRuntime[];
  durationMs: number;
  error?: string;
  raw?: GatewayHealth;
}

export async function checkHealth(info: OpenClawInfo): Promise<HealthResult> {
  const start = Date.now();

  let health = await getGatewayHealthHttp(info);
  if (!health) {
    log("warn", "HTTP probe failed, falling back to CLI health check");
    health = await getGatewayHealth(info);
  }
  const durationMs = Date.now() - start;

  if (!health) {
    const error = "Gateway unreachable (openclaw health failed)";
    addCheckRecord({
      timestamp: new Date().toISOString(),
      healthy: false,
      error,
      responseTime: durationMs,
    });
    log("error", `Health check failed: ${error} (${durationMs}ms)`);
    return { healthy: false, gateway: false, channels: [], agentRuntimes: [], durationMs, error };
  }

  const channels = health.channels
    ? Object.entries(health.channels).map(([name, ch]) => ({
        name,
        ok: ch.probe?.ok ?? false,
      }))
    : [];

  const healthy = health.ok;
  const agentRuntimes = health.agents ?? [];

  addCheckRecord({
    timestamp: new Date().toISOString(),
    healthy,
    responseTime: durationMs,
  });

  if (healthy) {
    log("success", `Health OK — gateway up, ${channels.length} channels (${durationMs}ms)`);
  } else {
    log("warn", `Health degraded — gateway responded but ok=false (${durationMs}ms)`);
  }

  return { healthy, gateway: true, channels, agentRuntimes, durationMs, raw: health };
}
