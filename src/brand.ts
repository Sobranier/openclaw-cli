import { basename } from "node:path";
import { homedir } from "node:os";
import { join } from "node:path";

const bin = basename(process.argv[1] ?? "openclaw-doctor").replace(/\.[cm]?js$/, "");

const KNOWN_BINS = ["openclaw-cli", "openclaw-manage", "openclaw-doctor"];
export const BINARY_NAME = KNOWN_BINS.includes(bin) ? bin : "openclaw-doctor";
export const APP_HOME = join(homedir(), `.${BINARY_NAME}`);

const DISPLAY_NAMES: Record<string, string> = {
  "openclaw-cli": "OpenClaw CLI",
  "openclaw-manage": "OpenClaw Manage",
  "openclaw-doctor": "OpenClaw Doctor",
};
export const DISPLAY_NAME = DISPLAY_NAMES[BINARY_NAME] ?? "OpenClaw Doctor";
export const IS_CLI_BRAND = BINARY_NAME === "openclaw-cli";
