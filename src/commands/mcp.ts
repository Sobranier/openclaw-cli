import chalk from "chalk";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";

interface McpServer {
  name: string;
  type: "stdio" | "http" | "unknown";
  command?: string;
  url?: string;
  args?: string[];
  env?: Record<string, string>;
  source: string;
  status: "RUNNING" | "STOPPED" | "UNKNOWN";
}

const CONFIG_LOCATIONS: { path: string; label: string }[] = [
  { path: join(homedir(), ".config", "claude", "claude_desktop_config.json"), label: "Claude Desktop" },
  { path: join(homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json"), label: "Claude Desktop (macOS)" },
  { path: join(homedir(), ".config", "cursor", "mcp.json"), label: "Cursor" },
  { path: join(homedir(), ".openclaw", "config.yaml"), label: "OpenClaw" },
  { path: join(homedir(), ".openclaw", "mcp.json"), label: "OpenClaw MCP" },
];

function findMcpConfigs(): McpServer[] {
  const servers: McpServer[] = [];

  for (const loc of CONFIG_LOCATIONS) {
    if (!existsSync(loc.path)) continue;

    try {
      const raw = readFileSync(loc.path, "utf-8");

      // Skip YAML files for now (openclaw config.yaml)
      if (loc.path.endsWith(".yaml") || loc.path.endsWith(".yml")) {
        // Basic YAML MCP parsing - look for mcp_servers section
        const mcpMatch = raw.match(/mcp_servers:\s*\n([\s\S]*?)(?:\n\w|\n*$)/);
        if (mcpMatch) {
          const lines = mcpMatch[1].split("\n");
          for (const line of lines) {
            const nameMatch = line.match(/^\s+-\s+name:\s*(.+)/);
            if (nameMatch) {
              servers.push({
                name: nameMatch[1].trim(),
                type: "unknown",
                source: loc.label,
                status: "UNKNOWN",
              });
            }
          }
        }
        continue;
      }

      const config = JSON.parse(raw);
      const mcpServers = config.mcpServers ?? config.mcp_servers ?? config.servers ?? {};

      for (const [name, def] of Object.entries(mcpServers)) {
        const d = def as Record<string, unknown>;
        const server: McpServer = {
          name,
          type: d.command ? "stdio" : d.url ? "http" : "unknown",
          command: d.command as string | undefined,
          url: d.url as string | undefined,
          args: d.args as string[] | undefined,
          env: d.env as Record<string, string> | undefined,
          source: loc.label,
          status: "UNKNOWN",
        };

        // Check if stdio process is running
        if (server.type === "stdio" && server.command) {
          server.status = checkProcessRunning(server.command) ? "RUNNING" : "STOPPED";
        } else if (server.type === "http") {
          server.status = "UNKNOWN"; // Would need HTTP probe
        }

        servers.push(server);
      }
    } catch { /* skip unreadable config */ }
  }

  return servers;
}

function checkProcessRunning(command: string): boolean {
  try {
    // Extract the base command name
    const baseName = command.split("/").pop() ?? command;
    const result = execSync(`pgrep -f "${baseName}"`, { encoding: "utf-8", timeout: 3000 });
    return result.trim().length > 0;
  } catch {
    return false;
  }
}

function statusColor(status: string): string {
  switch (status) {
    case "RUNNING": return chalk.green(status);
    case "STOPPED": return chalk.red(status);
    default: return chalk.gray(status);
  }
}

export async function mcpList() {
  const servers = findMcpConfigs();

  if (servers.length === 0) {
    console.log(chalk.yellow("\n  No MCP server configurations found."));
    console.log(chalk.gray("  Checked:"));
    for (const loc of CONFIG_LOCATIONS) {
      console.log(chalk.gray(`    ${loc.path}`));
    }
    console.log(chalk.gray("\n  Configure MCP servers in Claude Desktop:"));
    console.log(chalk.gray(`    ${CONFIG_LOCATIONS[0].path}\n`));
    return;
  }

  console.log(chalk.bold("\n  MCP Servers\n"));
  console.log(`  ${"Name".padEnd(24)} ${"Type".padEnd(8)} ${"Status".padEnd(12)} ${"Source".padEnd(20)} ${"Command/URL"}`);
  console.log(`  ${"─".repeat(24)} ${"─".repeat(8)} ${"─".repeat(12)} ${"─".repeat(20)} ${"─".repeat(30)}`);

  for (const s of servers) {
    const endpoint = s.command
      ? `${s.command}${s.args?.length ? " " + s.args.join(" ") : ""}`
      : s.url ?? "";
    const truncEndpoint = endpoint.length > 50 ? endpoint.slice(0, 47) + "..." : endpoint;
    console.log(
      `  ${s.name.padEnd(24)} ${s.type.padEnd(8)} ${statusColor(s.status).padEnd(12 + 10)} ${chalk.gray(s.source.padEnd(20))} ${chalk.gray(truncEndpoint)}`,
    );
  }
  console.log();
}

export async function mcpStatus(name: string) {
  const servers = findMcpConfigs();
  const server = servers.find((s) => s.name === name);

  if (!server) {
    console.log(chalk.red(`\n  MCP server "${name}" not found.`));
    const available = servers.map((s) => s.name).join(", ");
    if (available) {
      console.log(chalk.gray(`  Available: ${available}\n`));
    } else {
      console.log(chalk.gray("  No MCP servers configured.\n"));
    }
    return;
  }

  console.log(chalk.bold(`\n  MCP Server: ${server.name}\n`));
  console.log(`  Status:  ${statusColor(server.status)}`);
  console.log(`  Type:    ${server.type}`);
  console.log(`  Source:  ${chalk.gray(server.source)}`);

  if (server.command) {
    console.log(`  Command: ${server.command}`);
    if (server.args?.length) {
      console.log(`  Args:    ${server.args.join(" ")}`);
    }
  }
  if (server.url) {
    console.log(`  URL:     ${server.url}`);
  }
  if (server.env && Object.keys(server.env).length > 0) {
    console.log(`  Env:     ${Object.keys(server.env).join(", ")}`);
  }
  console.log();
}
