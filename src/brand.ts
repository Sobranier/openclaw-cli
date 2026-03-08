import { basename } from "node:path";
import { homedir } from "node:os";
import { join } from "node:path";

const bin = basename(process.argv[1] ?? "openclaw-doctor").replace(/\.[cm]?js$/, "");
export const BINARY_NAME = bin === "openclaw-cli" ? "openclaw-cli" : "openclaw-doctor";
export const IS_CLI_BRAND = BINARY_NAME === "openclaw-cli";
export const APP_HOME = join(homedir(), `.${BINARY_NAME}`);
export const DISPLAY_NAME = IS_CLI_BRAND ? "OpenClaw CLI" : "OpenClaw Doctor";
