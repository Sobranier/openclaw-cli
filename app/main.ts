import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  shell,
  Notification,
  ipcMain,
} from "electron";
import { fork, type ChildProcess } from "node:child_process";
import * as path from "node:path";
import * as http from "node:http";

// ── Constants ──────────────────────────────────────────────────────────────
const DASHBOARD_PORT = 9090;
const DASHBOARD_URL = `http://localhost:${DASHBOARD_PORT}`;
const HEALTH_INTERVAL_MS = 30_000;
// In dev: __dirname = app-dist/, script is app-dist/server-process.js
// In packaged: __dirname = .../app.asar/app-dist/, script is same
const SERVER_SCRIPT = path.join(__dirname, "server-process.js");

// Icon paths (relative to app bundle Resources or dev project root)
const ICON_PATH = path.join(
  app.isPackaged
    ? path.join(process.resourcesPath, "assets/icon.iconset/icon_16x16@2x.png")
    : path.join(__dirname, "../assets/icon.iconset/icon_16x16@2x.png")
);

// ── State ──────────────────────────────────────────────────────────────────
let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
let serverProc: ChildProcess | null = null;
let isHealthy = true;

// ── Server lifecycle ───────────────────────────────────────────────────────
/** Check if dashboard server is already running on the port */
function isServerRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    http.get(`${DASHBOARD_URL}/api/status`, { timeout: 1000 }, (res) => {
      resolve(res.statusCode === 200);
    }).on("error", () => resolve(false))
      .on("timeout", () => resolve(false));
  });
}

function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    http.get(`http://127.0.0.1:${port}/api/status`, { timeout: 1000 }, (res) => {
      resolve(res.statusCode === 200);
    }).on("error", () => resolve(false));
  });
}

function findCLI(): string | null {
  // Try env PATH first, then common nvm paths
  const { execSync } = require("node:child_process");
  try { return execSync("which openclaw-doctor", { encoding: "utf-8" }).trim(); } catch {}
  const home = process.env.HOME ?? "";
  const candidates = [
    `${home}/.nvm/versions/node/v24.14.0/bin/openclaw-doctor`,
    `${home}/.nvm/versions/node/v22.13.0/bin/openclaw-doctor`,
    `/usr/local/bin/openclaw-doctor`,
    `/opt/homebrew/bin/openclaw-doctor`,
  ];
  const { existsSync } = require("node:fs");
  return candidates.find(existsSync) ?? null;
}

async function startServer() {
  if (await isPortInUse(DASHBOARD_PORT)) {
    console.log("[app] dashboard already running, reusing");
    return;
  }

  const cli = findCLI();
  if (!cli) {
    console.error("[app] openclaw-doctor CLI not found — install with: npm install -g openclaw-doctor");
    return;
  }

  // Use system node (not Electron's node) to run the CLI
  const { spawnSync: _ss, spawn } = require("node:child_process");
  // Find system node
  let nodeExec = "/usr/local/bin/node";
  try {
    const nvmNode = _ss("bash", ["-lc", "which node"], { encoding: "utf-8" });
    if (nvmNode.stdout?.trim()) nodeExec = nvmNode.stdout.trim();
  } catch {}

  console.log(`[app] Starting: ${nodeExec} ${cli} monitor`);
  serverProc = spawn(nodeExec, [cli, "monitor"], {
    env: { ...process.env, PATH: `/usr/local/bin:/opt/homebrew/bin:${process.env.PATH}` },
    stdio: "pipe",
  }) as unknown as ChildProcess;

  serverProc.stderr?.on("data", (d: Buffer) => console.error("[monitor]", d.toString().trim()));
  serverProc.stdout?.on("data", (d: Buffer) => console.log("[monitor]", d.toString().trim()));

  serverProc.on("exit", (code: number | null) => {
    console.log(`[app] monitor exited (code ${code}), retry in 3s`);
    serverProc = null;
    setTimeout(startServer, 3000);
  });
}

async function ensureServer(): Promise<void> {
  // If already running (e.g. openclaw-doctor watch --dashboard), reuse it
  const already = await isServerRunning();
  if (already) {
    console.log("[app] Dashboard server already running, reusing existing instance");
    return;
  }
  startServer();
  await waitForServer();
}

function waitForServer(retries = 20): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      http
        .get(`${DASHBOARD_URL}/api/status`, { timeout: 2000 }, (res) => {
          if (res.statusCode === 200) return resolve();
          retry();
        })
        .on("error", retry);
    };
    const retry = () => {
      if (++attempts >= retries) return reject(new Error("Dashboard server did not start"));
      setTimeout(check, 500);
    };
    check();
  });
}

// ── Window ─────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    title: "OpenClaw Doctor",
    backgroundColor: "#050810",
    webPreferences: { contextIsolation: true },
    show: false,
  });

  mainWindow.loadURL(DASHBOARD_URL);
  mainWindow.once("ready-to-show", () => mainWindow?.show());

  mainWindow.on("close", (e) => {
    e.preventDefault();
    mainWindow?.hide();
  });
}

function showWindow() {
  if (!mainWindow) createWindow();
  else {
    mainWindow.show();
    mainWindow.focus();
  }
}

// ── Tray ───────────────────────────────────────────────────────────────────
function buildTrayMenu() {
  return Menu.buildFromTemplate([
    {
      label: "OpenClaw Doctor",
      enabled: false,
    },
    {
      label: `Status: ${isHealthy ? "🟢 HEALTHY" : "🔴 UNREACHABLE"}`,
      enabled: false,
    },
    { type: "separator" },
    { label: "Open Dashboard", click: () => showWindow() },
    { label: "Open in Browser", click: () => shell.openExternal(DASHBOARD_URL) },
    { type: "separator" },
    {
      label: "Restart Gateway",
      click: async () => {
        try {
          await fetch(`${DASHBOARD_URL}/api/restart`, { method: "POST" });
        } catch {}
      },
    },
    {
      label: "Run Doctor Fix",
      click: async () => {
        try {
          await fetch(`${DASHBOARD_URL}/api/doctor`, { method: "POST" });
        } catch {}
      },
    },
    { type: "separator" },
    {
      label: "Start at Login",
      type: "checkbox",
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => {
        app.setLoginItemSettings({ openAtLogin: item.checked });
      },
    },
    { type: "separator" },
    { label: "Quit", click: () => app.exit(0) },
  ]);
}

function createTray() {
  let icon: Electron.NativeImage;
  try {
    icon = nativeImage.createFromPath(ICON_PATH);
    // Mark as template for macOS menubar (auto dark/light adaptation)
    icon.setTemplateImage(true);
  } catch {
    icon = nativeImage.createEmpty();
  }
  tray = new Tray(icon);
  tray.setToolTip("OpenClaw Doctor — starting...");
  tray.setContextMenu(buildTrayMenu());
  tray.on("double-click", () => showWindow());
}

function updateTray(healthy: boolean) {
  if (!tray) return;
  isHealthy = healthy;
  tray.setToolTip(`OpenClaw Doctor — ${healthy ? "HEALTHY" : "UNREACHABLE"}`);
  tray.setContextMenu(buildTrayMenu());
}

// ── Health polling ─────────────────────────────────────────────────────────
async function pollHealth() {
  try {
    const res = await fetch(`${DASHBOARD_URL}/api/status`);
    const data = (await res.json()) as { healthy: boolean };
    const wasHealthy = isHealthy;
    updateTray(data.healthy);

    if (!data.healthy && wasHealthy) {
      new Notification({
        title: "OpenClaw Doctor",
        body: "Gateway is down — attempting auto-restart...",
      }).show();
    } else if (data.healthy && !wasHealthy) {
      new Notification({
        title: "OpenClaw Doctor",
        body: "Gateway is back online ✓",
      }).show();
    }
  } catch {
    updateTray(false);
  }
}

// ── App lifecycle ──────────────────────────────────────────────────────────
app.on("ready", async () => {
  // macOS: don't show in Dock
  if (process.platform === "darwin") app.dock?.hide();

  createTray();
  try {
    await ensureServer();
  } catch {
    console.warn("[app] server warmup timed out, opening anyway");
  }

  createWindow();
  await pollHealth();
  setInterval(pollHealth, HEALTH_INTERVAL_MS);
});

app.on("window-all-closed", () => {
  // Keep app alive in tray (do nothing — don't quit)
});

app.on("activate", () => {
  showWindow();
});

// Prevent second instance
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => showWindow());
}

export {};
