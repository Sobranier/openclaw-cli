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
  openclaw-setup
  openclaw-install
  openclaw-run
  openclaw-start
  openclaw-watch
  openclaw-health
)

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
