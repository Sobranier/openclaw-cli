import chalk from "chalk";
import { loadConfig } from "../config.js";
import { detectOpenClaw } from "../core/openclaw.js";
import { checkHealth } from "../core/health-checker.js";

export async function showStatus(options: {
  config?: string;
  profile?: string;
  json?: boolean;
}) {
  const config = loadConfig(options.config);
  const info = detectOpenClaw(options.profile ?? config.openclawProfile);
  const result = await checkHealth(info);

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          gateway: {
            healthy: result.healthy,
            reachable: result.gateway,
            port: info.gatewayPort,
            durationMs: result.durationMs,
          },
          channels: result.channels,
          agents: info.agents,
          openclaw: {
            version: info.version,
            profile: info.profile,
            configPath: info.configPath,
          },
          doctor: {
            checkInterval: config.checkInterval,
            failThreshold: config.failThreshold,
          },
        },
        null,
        2,
      ),
    );
    process.exit(result.healthy ? 0 : 1);
    return;
  }

  console.log(chalk.bold("\n  OpenClaw Doctor\n"));

  // Gateway status
  if (result.healthy) {
    console.log(
      chalk.green.bold(`  Gateway: HEALTHY`) +
        chalk.gray(` (port ${info.gatewayPort}, ${result.durationMs}ms)`),
    );
  } else if (result.gateway) {
    console.log(chalk.yellow.bold(`  Gateway: DEGRADED`) + chalk.gray(` (responded but ok=false)`));
  } else {
    console.log(chalk.red.bold(`  Gateway: UNREACHABLE`));
    if (result.error) console.log(chalk.red(`  ${result.error}`));
  }

  // Channels
  if (result.channels && result.channels.length > 0) {
    console.log();
    for (const ch of (result.channels ?? [])) {
      const icon = ch.ok ? chalk.green("ok") : chalk.red("fail");
      console.log(`  ${chalk.gray("Channel")} ${ch.name}: ${icon}`);
    }
  }

  // Agents
  if (info.agents.length > 0) {
    console.log();
    const agentList = info.agents
      .map((a) => (a.isDefault ? `${a.name} (default)` : a.name))
      .join(", ");
    console.log(chalk.gray(`  Agents: ${agentList}`));
  }

  // OpenClaw info
  console.log();
  console.log(chalk.gray(`  OpenClaw ${info.version ?? "unknown"}`));
  console.log(chalk.gray(`  Config: ${info.configPath}`));
  console.log();

  process.exit(result.healthy ? 0 : 1);
}
