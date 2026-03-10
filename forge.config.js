const path = require("path");

module.exports = {
  packagerConfig: {
    name: "OpenClaw CLI",
    icon: path.join(__dirname, "assets/icons/icon"),
    appBundleId: "sh.openclaw.cli",
    appCategoryType: "public.app-category.developer-tools",
    asar: true,
  },
  makers: [
    {
      name: "@electron-forge/maker-zip",
      config: {},
      platforms: ["darwin"],
    },
  ],
};
