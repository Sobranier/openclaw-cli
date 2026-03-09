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
const SERVER_SCRIPT = path.join(__dirname, "../app/server-process.js");

// Minimal 16x16 transparent PNG (placeholder — replace with real icon later)
const ICON_B64 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAA" +
  "AklEQVR42mNk+A8AAQQBAScAIgsBAAAASUVORK5CYII=";

// ── State ──────────────────────────────────────────────────────────────────
let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
let serverProc: ChildProcess | null = null;
let isHealthy = true;

// ── Server lifecycle ───────────────────────────────────────────────────────
function startServer() {
  serverProc = fork(SERVER_SCRIPT, [], {
    env: { ...process.env, OPENCLAW_PROFILE: "default" },
    stdio: "ignore",
  });
  serverProc.on("exit", (code) => {
    console.log(`[app] server process exited (code ${code}), restarting in 3s`);
    setTimeout(startServer, 3000);
  });
}

function waitForServer(retries = 20): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      http
        .get(`${DASHBOARD_URL}/api/status`, (res) => {
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
  const icon = nativeImage.createFromDataURL(ICON_B64).resize({ width: 16, height: 16 });
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
  startServer();

  try {
    await waitForServer();
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
