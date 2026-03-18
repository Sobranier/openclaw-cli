import { defineConfig } from "tsup";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { version } = require("./package.json");

export default defineConfig([
  // ESM build — for npm package (normal usage)
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    target: "node18",
    clean: true,
    dts: true,
    splitting: false,
    bundle: true,
    banner: { js: "#!/usr/bin/env node" },
    define: { __PACKAGE_VERSION__: JSON.stringify(version) },
  },
  // CJS build — for pkg standalone binary (menubar app)
  {
    entry: { "index.pkg": "src/index.ts" },
    format: ["cjs"],
    target: "node18",
    clean: false,
    dts: false,
    splitting: false,
    bundle: true,
    noExternal: [/.*/],   // bundle ALL deps including chalk
    banner: { js: "#!/usr/bin/env node" },
    define: { __PACKAGE_VERSION__: JSON.stringify(version) },
    outDir: "dist",
  },
]);
