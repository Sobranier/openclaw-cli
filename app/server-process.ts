/**
 * Forked by Electron main process — runs the dashboard HTTP server in a child process.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { startDashboard } = require(path.join(__dirname, "../dist/server-process-entry.js"));

startDashboard({ profile: process.env.OPENCLAW_PROFILE ?? "default" });
