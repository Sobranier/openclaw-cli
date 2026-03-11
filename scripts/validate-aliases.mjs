#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const manifests = fs.readdirSync(cwd).filter((f) => /^package\..+\.json$/.test(f));

const requiredLinks = [
  "https://openclaw-cli.app",
  "https://www.npmjs.com/package/openclaw-cli",
  "https://github.com/Sobranier/openclaw-cli",
];

const errors = [];

for (const manifest of manifests) {
  const filePath = path.join(cwd, manifest);
  const pkg = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const name = pkg.name;

  if (!name) {
    errors.push(`${manifest}: missing name`);
    continue;
  }

  if (pkg.homepage !== "https://openclaw-cli.app") {
    errors.push(`${name}: homepage must be https://openclaw-cli.app`);
  }

  if (!pkg.bin || pkg.bin[name] !== "./dist/index.js") {
    errors.push(`${name}: bin must map ${name} -> ./dist/index.js`);
  }

  const readme = path.join(cwd, `README.${name}.md`);
  if (!fs.existsSync(readme)) {
    errors.push(`${name}: missing README.${name}.md`);
    continue;
  }

  const readmeText = fs.readFileSync(readme, "utf8");
  for (const link of requiredLinks) {
    if (!readmeText.includes(link)) {
      errors.push(`${name}: README missing link ${link}`);
    }
  }

  if (!readmeText.includes(`${name} watch -d`)) {
    errors.push(`${name}: README should include alias command example (${name} watch -d)`);
  }
}

if (errors.length > 0) {
  console.error(`❌ Alias validation failed (${errors.length} errors):`);
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}

console.log(`✅ Alias validation passed for ${manifests.length} package manifests.`);
