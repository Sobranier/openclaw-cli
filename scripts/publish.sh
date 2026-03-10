#!/bin/bash
set -e

REGISTRY="https://registry.npmjs.org"
HOMEBREW_TAP_DIR="$HOME/Documents/project/github/homebrew-openclaw"

ALL_ALIASES=(
  openclaw-cli
  openclaw-upgrade
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
  # new aliases
  qclaw
  qclaw-cli
  autoopenclaw
  claw-open
  open-claw
  clawjs
  aliclaw
  fastclaw
  smartclaw
  aiclaw
  megaclaw
  volclaw
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

# ─── Homebrew tap update ───────────────────────────────────────────────────
echo ""
echo "🍺 Updating Homebrew tap..."

if [ ! -d "$HOMEBREW_TAP_DIR" ]; then
  echo "⚠️  Homebrew tap not found at $HOMEBREW_TAP_DIR, skipping."
else
  TAG="v$VERSION"

  # Create GitHub Release tag first (requires git push --tags done before this script)
  TARBALL_URL="https://github.com/Sobranier/openclaw-doctor/archive/refs/tags/${TAG}.tar.gz"

  echo "⏳ Fetching tarball to compute sha256: $TARBALL_URL"
  SHA256=$(curl -sL "$TARBALL_URL" | shasum -a 256 | awk '{print $1}')

  if [ -z "$SHA256" ] || [ "$SHA256" = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" ]; then
    echo "❌ sha256 is empty or invalid — did you push the git tag before running release?"
    echo "   Run: git tag v$VERSION && git push origin v$VERSION"
    exit 1
  fi

  echo "🔑 sha256: $SHA256"

  for formula in "$HOMEBREW_TAP_DIR/Formula/openclaw-cli.rb" "$HOMEBREW_TAP_DIR/Formula/openclaw-doctor.rb"; do
    if [ -f "$formula" ]; then
      # Update url tag
      sed -i '' "s|/tags/v[0-9.]*\.tar\.gz|/tags/${TAG}.tar.gz|g" "$formula"
      # Update sha256
      sed -i '' "s/sha256 \"[a-f0-9]*\"/sha256 \"$SHA256\"/" "$formula"
      echo "✅ Updated $(basename $formula)"
    fi
  done

  cd "$HOMEBREW_TAP_DIR"
  git add Formula/
  git commit -m "chore: update formulas to $VERSION" && git push origin main
  cd - > /dev/null

  echo "🍺 Homebrew tap updated!"
fi

echo ""
echo "🎉 Release $VERSION complete!"
