/**
 * Standalone entry point used by Electron child process.
 * Exports startDashboard so electron-builder can bundle it separately.
 */
export { startDashboard } from "./server.js";
