import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";

export const DOCTOR_HOME = join(homedir(), ".openclaw-doctor");
export const CONFIG_PATH = join(DOCTOR_HOME, "config.json");
export const DOCTOR_LOG_DIR = join(DOCTOR_HOME, "logs");
export const PID_FILE = join(DOCTOR_HOME, "daemon.pid");

export interface DoctorConfig {
  checkInterval: number;
  failThreshold: number;
  dashboardPort: number;
  maxRestartsPerHour: number;
  openclawProfile: string;
  notify: {
    webhook: {
      enabled: boolean;
      url: string;
      bodyTemplate: string;
    };
    system: {
      enabled: boolean;
    };
  };
}

const defaults: DoctorConfig = {
  checkInterval: 30,
  failThreshold: 5,
  dashboardPort: 9090,
  maxRestartsPerHour: 5,
  openclawProfile: "default",
  notify: {
    webhook: {
      enabled: false,
      url: "",
      bodyTemplate:
        '{"msgtype":"text","text":{"content":"{{message}}"}}',
    },
    system: {
      enabled: true,
    },
  },
};

export function ensureDoctorHome() {
  if (!existsSync(DOCTOR_HOME)) {
    mkdirSync(DOCTOR_HOME, { recursive: true });
  }
  if (!existsSync(DOCTOR_LOG_DIR)) {
    mkdirSync(DOCTOR_LOG_DIR, { recursive: true });
  }
}

// Local config in cwd takes priority (for development)
const LOCAL_CONFIG = resolve(process.cwd(), "doctor.config.json");

function resolveConfigPath(configPath?: string): string {
  if (configPath) return configPath;
  if (existsSync(LOCAL_CONFIG)) return LOCAL_CONFIG;
  return CONFIG_PATH;
}

export function loadConfig(configPath?: string): DoctorConfig {
  const file = resolveConfigPath(configPath);
  if (existsSync(file)) {
    const raw = JSON.parse(readFileSync(file, "utf-8"));
    return {
      ...defaults,
      ...raw,
      notify: {
        webhook: { ...defaults.notify.webhook, ...(raw.notify?.webhook ?? {}) },
        system: { ...defaults.notify.system, ...(raw.notify?.system ?? {}) },
      },
    };
  }
  // First run: create global default config
  ensureDoctorHome();
  writeFileSync(CONFIG_PATH, JSON.stringify(defaults, null, 2) + "\n");
  return { ...defaults };
}
