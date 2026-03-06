#!/bin/bash
set -e

REGISTRY="https://registry.npmjs.org"

echo "🔨 Building..."
npm run build

echo ""
echo "📦 Publishing openclaw-doctor..."
npm publish --registry $REGISTRY

echo ""
echo "📦 Publishing openclaw-cli..."
cp package.json package.json.bak
cp README.md README.md.bak
cp package.openclaw-cli.json package.json
cp README.openclaw-cli.md README.md
npm publish --registry $REGISTRY || {
  mv package.json.bak package.json
  mv README.md.bak README.md
  echo "❌ openclaw-cli publish failed"
  exit 1
}
mv package.json.bak package.json
mv README.md.bak README.md

echo ""
echo "✅ Both packages published successfully"
