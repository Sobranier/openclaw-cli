import chalk from "chalk";
import { setOptOut, getTelemetryStatus } from "../telemetry.js";

export function telemetryOn() {
  setOptOut(false);
  console.log(chalk.green("✓ Telemetry enabled. Thanks for helping improve OpenClaw!"));
}

export function telemetryOff() {
  setOptOut(true);
  console.log(chalk.yellow("✓ Telemetry disabled. Set OPENCLAW_NO_TELEMETRY=1 to suppress permanently."));
}

export function telemetryStatus() {
  const { optOut, clientId } = getTelemetryStatus();
  const status = optOut ? chalk.red("disabled") : chalk.green("enabled");
  console.log(`Telemetry: ${status}`);
  console.log(`Client ID: ${chalk.dim(clientId)}`);
  console.log();
  console.log(chalk.dim("Toggle: openclaw telemetry on/off"));
  console.log(chalk.dim("Env:    OPENCLAW_NO_TELEMETRY=1"));
}
