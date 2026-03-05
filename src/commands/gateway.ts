import chalk from "chalk";
import { loadConfig } from "../config.js";
import { detectOpenClaw } from "../core/openclaw.js";
import {
  startGateway,
  stopGateway,
  restartGateway,
} from "../core/process-manager.js";
import { initLogger } from "../core/logger.js";

export async function gatewayStart(options: {
  config?: string;
  profile?: string;
}) {
  const config = loadConfig(options.config);
  initLogger();
  const info = detectOpenClaw(options.profile ?? config.openclawProfile);
  const result = startGateway(info);
  if (result.success) {
    console.log(chalk.green("Gateway started"));
  } else {
    console.log(chalk.red(`Failed to start gateway: ${result.error}`));
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
  const result = stopGateway(info);
  if (result.success) {
    console.log(chalk.green("Gateway stopped"));
  } else {
    console.log(chalk.red(`Failed to stop gateway: ${result.error}`));
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
  const result = restartGateway(info);
  if (result.success) {
    console.log(chalk.green("Gateway restarted"));
  } else {
    console.log(chalk.red(`Failed to restart gateway: ${result.error}`));
    process.exit(1);
  }
}
