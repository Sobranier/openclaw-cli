import { defineConfig } from "tsup";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { version } = require("./package.json");

// Read .env for GA4 secrets (build-time injection)
function loadEnv(): Record<string, string> {
  try {
    const content = readFileSync(".env", "utf-8");
    const vars: Record<string, string> = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      vars[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
    }
    return vars;
  } catch {
    return {};
  }
}

const env = loadEnv();
const ga4MeasurementId = env.OPENCLAW_GA4_MEASUREMENT_ID || "";
const ga4ApiSecret = env.OPENCLAW_GA4_API_SECRET || "";

const sharedDefine = {
  __PACKAGE_VERSION__: JSON.stringify(version),
  "process.env.GA4_MEASUREMENT_ID": JSON.stringify(ga4MeasurementId),
  "process.env.GA4_API_SECRET": JSON.stringify(ga4ApiSecret),
};

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
    define: sharedDefine,
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
    define: sharedDefine,
    outDir: "dist",
  },
]);
