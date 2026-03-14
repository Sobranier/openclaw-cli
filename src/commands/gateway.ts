import chalk from "chalk";
import { loadConfig } from "../config.js";
import { detectOpenClaw } from "../core/openclaw.js";
import {
  startGateway,
  stopGateway,
  restartGateway,
} from "../core/process-manager.js";
import { initLogger } from "../core/logger.js";
import { trackCommand } from "../telemetry.js";

declare const __PACKAGE_VERSION__: string;
const _VER = typeof __PACKAGE_VERSION__ !== "undefined" ? __PACKAGE_VERSION__ : undefined;

export async function gatewayStart(options: {
  config?: string;
  profile?: string;
}) {
  const config = loadConfig(options.config);
  initLogger();
  const info = detectOpenClaw(options.profile ?? config.openclawProfile);
  const result = await startGateway(info);
  if (result.success) {
    console.log(chalk.green("Gateway started"));
    trackCommand("gateway start", true, _VER).catch(() => {});
  } else {
    console.log(chalk.red(`Failed to start gateway: ${result.error}`));
    trackCommand("gateway start", false, _VER).catch(() => {});
    process.exit(1);
  }
}

export async function gatewayStop(options: {
  config?: string;
  profile?: string;
}) {
  const config = loadConfig(options.config);
  initLogger();
  const info = detectOpenClaw(options.profile ?? config.openclawProfile);
  const result = await stopGateway(info);
  if (result.success) {
    console.log(chalk.green("Gateway stopped"));
    trackCommand("gateway stop", true, _VER).catch(() => {});
  } else {
    console.log(chalk.red(`Failed to stop gateway: ${result.error}`));
    trackCommand("gateway stop", false, _VER).catch(() => {});
    process.exit(1);
  }
}

export async function gatewayRestart(options: {
  config?: string;
  profile?: string;
}) {
  const config = loadConfig(options.config);
  initLogger();
  const info = detectOpenClaw(options.profile ?? config.openclawProfile);
  const result = await restartGateway(info);
  if (result.success) {
    console.log(chalk.green("Gateway restarted"));
    trackCommand("gateway restart", true, _VER).catch(() => {});
  } else {
    console.log(chalk.red(`Failed to restart gateway: ${result.error}`));
    trackCommand("gateway restart", false, _VER).catch(() => {});
    process.exit(1);
  }
}
