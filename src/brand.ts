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
  // new aliases
  "qclaw", "qclaw-cli", "autoopenclaw", "claw-open", "open-claw",
  "clawjs", "aliclaw", "fastclaw", "smartclaw", "aiclaw", "megaclaw", "volclaw",
];

export const BINARY_NAME = KNOWN_BINS.includes(bin) ? bin : "openclaw-cli";

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
  // new aliases
  "qclaw":          "QClaw",
  "qclaw-cli":      "QClaw CLI",
  "autoopenclaw":   "AutoOpenClaw",
  "claw-open":      "Claw Open",
  "open-claw":      "Open Claw",
  "clawjs":         "ClawJS",
  "aliclaw":        "AliClaw",
  "fastclaw":       "FastClaw",
  "smartclaw":      "SmartClaw",
  "aiclaw":         "AIClaw",
  "megaclaw":       "MegaClaw",
  "volclaw":        "VolClaw",
};
export const DISPLAY_NAME = DISPLAY_NAMES[BINARY_NAME] ?? "OpenClaw Doctor";
