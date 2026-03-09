/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: "ai.openclaw.doctor",
  productName: "OpenClaw Doctor",
  copyright: "Copyright © 2026",
  directories: { output: "dist-app" },
  files: [
    "app-dist/**/*",
    "dist/**/*",
    "node_modules/**/*",
    "package.json",
    "assets/**/*",
  ],
  asar: true,
  mac: {
    category: "public.app-category.developer-tools",
    target: [{ target: "dmg", arch: ["arm64", "x64"] }],
    icon: "assets/icon.icns",
    hardenedRuntime: true,
    gatekeeperAssess: false,
  },
  win: {
    target: [{ target: "nsis", arch: ["x64"] }],
    icon: "assets/icon.ico",
  },
  linux: {
    target: [{ target: "AppImage", arch: ["x64"] }],
    category: "Development",
  },
  dmg: {
    contents: [
      { x: 130, y: 220 },
      { x: 410, y: 220, type: "link", path: "/Applications" },
    ],
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
  },
};
