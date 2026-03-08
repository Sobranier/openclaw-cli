#!/bin/bash
set -e

REGISTRY="https://registry.npmjs.org"

ALL_ALIASES=(
  openclaw-cli
  openclaw-manage
  openclaw-service
  openclaw-daemon
  openclaw-monitor
  openclaw-helper
  openclaw-tools
  openclaw-utils
  openclaw-gateway
  openclaw-install
  openclaw-run
  openclaw-start
  openclaw-watch
  openclaw-health
)

# Sync version from main package.json to all alias package.json files
VERSION=$(node -p "require('./package.json').version")
echo "🔄 Syncing version $VERSION to all alias packages..."
for pkg in "${ALL_ALIASES[@]}"; do
  if [ -f "package.${pkg}.json" ]; then
    node -e "
      const fs = require('fs');
      const p = JSON.parse(fs.readFileSync('package.${pkg}.json', 'utf8'));
      p.version = '$VERSION';
      fs.writeFileSync('package.${pkg}.json', JSON.stringify(p, null, 2) + '\n');
    "
  fi
done

echo "🔨 Building..."
npm run build

echo ""
echo "📦 Publishing openclaw-doctor..."
npm publish --registry $REGISTRY

for pkg in "${ALL_ALIASES[@]}"; do
  echo ""
  echo "📦 Publishing $pkg..."
  cp package.json package.json.bak
  cp README.md README.md.bak
  cp "package.${pkg}.json" package.json
  cp "README.${pkg}.md" README.md
  npm publish --registry $REGISTRY || {
    mv package.json.bak package.json
    mv README.md.bak README.md
    echo "❌ $pkg publish failed"
    exit 1
  }
  mv package.json.bak package.json
  mv README.md.bak README.md
done

echo ""
echo "✅ All 16 packages published successfully"
