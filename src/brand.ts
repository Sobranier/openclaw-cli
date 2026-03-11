import { basename, join } from "node:path";
import { homedir } from "node:os";

const detectedBin = basename(process.argv[1] ?? "openclaw-cli").replace(/\.[cm]?js$/, "");

// Use the invoked binary name directly so all alias packages behave consistently.
export const BINARY_NAME = detectedBin || "openclaw-cli";

// All packages share the same config directory
export const APP_HOME = join(homedir(), ".openclaw-doctor");

function toDisplayName(bin: string) {
  if (bin === "openclaw-cli") return "OpenClaw CLI";
  if (bin === "openclaw-doctor") return "OpenClaw Doctor";
  return bin
    .split("-")
    .map((s) => s ? s[0].toUpperCase() + s.slice(1) : s)
    .join(" ");
}

export const DISPLAY_NAME = toDisplayName(BINARY_NAME);
