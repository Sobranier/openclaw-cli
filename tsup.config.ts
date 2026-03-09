import { defineConfig } from "tsup";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { version } = require("./package.json");

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node18",
  clean: true,
  dts: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
  define: {
    __PACKAGE_VERSION__: JSON.stringify(version),
  },
});
