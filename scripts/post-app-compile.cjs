const fs = require("fs");
fs.writeFileSync("app-dist/package.json", JSON.stringify({ type: "commonjs" }, null, 2) + "\n");
console.log("✓ app-dist/package.json (commonjs)");
