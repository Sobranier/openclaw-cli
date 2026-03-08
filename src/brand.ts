import { basename } from "node:path";
import { homedir } from "node:os";
import { join } from "node:path";

const bin = basename(process.argv[1] ?? "openclaw-doctor").replace(/\.[cm]?js$/, "");

const KNOWN_BINS = [
  "openclaw-cli", "openclaw-manage", "openclaw-doctor",
  "openclaw-service", "openclaw-daemon", "openclaw-monitor",
  "openclaw-helper", "openclaw-tools", "openclaw-utils",
  "openclaw-gateway", "openclaw-setup", "openclaw-install",
  "openclaw-run", "openclaw-start", "openclaw-watch", "openclaw-health",
];

export const BINARY_NAME = KNOWN_BINS.includes(bin) ? bin : "openclaw-doctor";

// All packages share the same config directory
export const APP_HOME = join(homedir(), ".openclaw-doctor");

const DISPLAY_NAMES: Record<string, string> = {
  "openclaw-cli":     "OpenClaw CLI",
  "openclaw-manage":  "OpenClaw Manage",
  "openclaw-doctor":  "OpenClaw Doctor",
  "openclaw-service": "OpenClaw Service",
  "openclaw-daemon":  "OpenClaw Daemon",
  "openclaw-monitor": "OpenClaw Monitor",
  "openclaw-helper":  "OpenClaw Helper",
  "openclaw-tools":   "OpenClaw Tools",
  "openclaw-utils":   "OpenClaw Utils",
  "openclaw-gateway": "OpenClaw Gateway",
  "openclaw-setup":   "OpenClaw Setup",
  "openclaw-install": "OpenClaw Install",
  "openclaw-run":     "OpenClaw Run",
  "openclaw-start":   "OpenClaw Start",
  "openclaw-watch":   "OpenClaw Watch",
  "openclaw-health":  "OpenClaw Health",
};
export const DISPLAY_NAME = DISPLAY_NAMES[BINARY_NAME] ?? "OpenClaw Doctor";
