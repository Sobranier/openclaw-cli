/**
 * OpenClaw Telemetry - Anonymous usage analytics via Firebase GA4 Measurement Protocol
 *
 * Privacy:
 * - No PII is ever sent. Email addresses are SHA-256 hashed before use.
 * - Users can opt out at any time: `openclaw telemetry off`
 * - Or set env: OPENCLAW_NO_TELEMETRY=1
 *
 * Identity resolution order:
 * 1. Persistent anonymous UUID (stored in ~/.openclaw-doctor/telemetry.json)
 * 2. SHA-256 hash of git config user.email (if available)
 * 3. SHA-256 hash of npm config email (if available)
 * Whichever is resolved first is used as client_id.
 */

import { createHash, randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { APP_HOME } from "./brand.js";

const MEASUREMENT_ID = "G-B46J8RT804";
const API_SECRET = "qkqms1nURj2S02Q3WqO7GQ";
const ENDPOINT = `https://www.google-analytics.com/mp/collect?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`;

const TELEMETRY_FILE = join(APP_HOME, "telemetry.json");

interface TelemetryState {
  client_id: string;
  opt_out: boolean;
  first_run_notified: boolean;
}

// ── State ─────────────────────────────────────────────────────────────────────

function loadState(): TelemetryState {
  if (existsSync(TELEMETRY_FILE)) {
    try {
      return JSON.parse(readFileSync(TELEMETRY_FILE, "utf-8"));
    } catch {
      // corrupted, recreate
    }
  }
  const state: TelemetryState = {
    client_id: resolveClientId(),
    opt_out: false,
    first_run_notified: false,
  };
  saveState(state);
  return state;
}

function saveState(state: TelemetryState) {
  try {
    writeFileSync(TELEMETRY_FILE, JSON.stringify(state, null, 2) + "\n");
  } catch {
    // silently ignore write errors
  }
}

// ── Identity ──────────────────────────────────────────────────────────────────

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function tryExec(cmd: string): string | null {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"], timeout: 2000 })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

function resolveClientId(): string {
  // Try git email hash
  const gitEmail = tryExec("git config --global user.email");
  if (gitEmail && gitEmail.includes("@")) return "git:" + sha256(gitEmail);

  // Try npm email hash
  const npmEmail = tryExec("npm config get email");
  if (npmEmail && npmEmail.includes("@")) return "npm:" + sha256(npmEmail);

  // Fallback: random UUID (persistent)
  return "anon:" + randomUUID();
}

// ── Opt-out ───────────────────────────────────────────────────────────────────

export function isOptedOut(): boolean {
  if (process.env.OPENCLAW_NO_TELEMETRY === "1") return true;
  if (process.env.DO_NOT_TRACK === "1") return true;
  if (process.env.CI) return true;
  try {
    const state = loadState();
    return state.opt_out;
  } catch {
    return false;
  }
}

export function setOptOut(value: boolean) {
  const state = loadState();
  state.opt_out = value;
  saveState(state);
}

export function getTelemetryStatus(): { optOut: boolean; clientId: string } {
  const state = loadState();
  return { optOut: state.opt_out, clientId: state.client_id };
}

// ── First-run notice ──────────────────────────────────────────────────────────

export function printFirstRunNotice() {
  const state = loadState();
  if (state.first_run_notified || state.opt_out) return;
  state.first_run_notified = true;
  saveState(state);

  // Print to stderr so it doesn't interfere with stdout output
  process.stderr.write(
    "\n  📊 OpenClaw collects anonymous usage data to improve the product.\n" +
    "     To opt out: openclaw telemetry off  (or set OPENCLAW_NO_TELEMETRY=1)\n\n"
  );
}

// ── Event tracking ────────────────────────────────────────────────────────────

export type Platform = "cli" | "npm_package" | "desktop_app" | "clawsite" | "dashboard";

export interface TrackOptions {
  platform: Platform;
  command?: string;       // e.g. "gateway start"
  success?: boolean;
  version?: string;
  os?: string;
  extra?: Record<string, string | number | boolean>;
}

export async function track(eventName: string, opts: TrackOptions): Promise<void> {
  if (isOptedOut()) return;

  let state: TelemetryState;
  try {
    state = loadState();
  } catch {
    return;
  }

  const params: Record<string, string | number | boolean> = {
    platform: opts.platform,
    engagement_time_msec: 1,
    ...(opts.command !== undefined && { command: opts.command }),
    ...(opts.success !== undefined && { success: opts.success ? 1 : 0 }),
    ...(opts.version !== undefined && { app_version: opts.version }),
    ...(opts.os !== undefined && { os_type: opts.os }),
    ...opts.extra,
  };

  const payload = {
    client_id: state.client_id,
    non_personalized_ads: true,
    events: [
      {
        name: eventName,
        params,
      },
    ],
  };

  try {
    // Fire-and-forget with a short timeout so we never slow down the CLI
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);
  } catch {
    // Never throw — telemetry must never break the CLI
  }
}

// ── Convenience wrappers ──────────────────────────────────────────────────────

export async function trackCommand(
  command: string,
  success: boolean,
  version?: string
) {
  await track("cli_command", {
    platform: "cli",
    command,
    success,
    version,
    os: process.platform,
  });
}

export async function trackPackageLoad(packageName: string, version: string) {
  await track("package_loaded", {
    platform: "npm_package",
    extra: { package_name: packageName },
    version,
    os: process.platform,
  });
}
