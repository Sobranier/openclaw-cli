#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f dist/index.js ]; then
  echo "dist/index.js not found. Run npm run build first."
  exit 1
fi

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

# Sample aliases for runtime checks (can expand if needed)
ALIASES=(openclaw-cli openclaw-doctor hello-claw amazonclaw pddclaw)

echo "🔎 Smoke testing alias commands..."

for alias in "${ALIASES[@]}"; do
  ln -sf "$(pwd)/dist/index.js" "$TMP_DIR/$alias"
  chmod +x "$TMP_DIR/$alias"

  echo "\n== $alias =="
  "$TMP_DIR/$alias" --help >/dev/null
  "$TMP_DIR/$alias" gateway --help >/dev/null
  "$TMP_DIR/$alias" watch --help >/dev/null
  echo "✅ $alias"
done

echo "\n✅ Smoke tests passed."
