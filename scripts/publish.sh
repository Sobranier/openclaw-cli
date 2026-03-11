#!/bin/bash
set -euo pipefail

REGISTRY="https://registry.npmjs.org"
HOMEBREW_TAP_DIR="$HOME/Documents/project/github/homebrew-openclaw"

MAIN_NAME=$(node -p "require('./package.json').name")
VERSION=$(node -p "require('./package.json').version")

echo "🚀 Release: ${MAIN_NAME}@${VERSION}"

# Collect alias manifests dynamically to avoid hand-maintained lists.
ALIAS_MANIFESTS=()
while IFS= read -r f; do
  ALIAS_MANIFESTS+=("$f")
done < <(ls package.*.json 2>/dev/null | sort || true)

echo "🔄 Syncing version ${VERSION} to alias manifests..."
for manifest in "${ALIAS_MANIFESTS[@]}"; do
  node -e "
    const fs = require('fs');
    const p = JSON.parse(fs.readFileSync('${manifest}', 'utf8'));
    p.version = '${VERSION}';
    fs.writeFileSync('${manifest}', JSON.stringify(p, null, 2) + '\n');
  "
done

echo "🔨 Building..."
npm run build

publish_with_manifest() {
  local manifest="$1"
  local readme="$2"

  cp package.json package.json.bak
  cp README.md README.md.bak

  cp "$manifest" package.json
  if [ -f "$readme" ]; then
    cp "$readme" README.md
  fi

  local pkg_name
  pkg_name=$(node -p "require('./package.json').name")
  echo "📦 Publishing ${pkg_name}@${VERSION}..."

  if npm publish --registry "$REGISTRY"; then
    echo "✅ ${pkg_name} published"
  else
    echo "⚠️  ${pkg_name} publish failed (continuing)"
  fi

  mv package.json.bak package.json
  mv README.md.bak README.md
}

echo ""
echo "📦 Publishing main package ${MAIN_NAME}@${VERSION}..."
npm publish --registry "$REGISTRY"

for manifest in "${ALIAS_MANIFESTS[@]}"; do
  alias_name=$(node -p "require('./${manifest}').name")
  # Skip duplicate publish for main package alias manifest.
  if [ "$alias_name" = "$MAIN_NAME" ]; then
    continue
  fi

  readme="README.${alias_name}.md"
  echo ""
  publish_with_manifest "$manifest" "$readme"
done

echo ""
echo "🍺 Updating Homebrew tap..."
if [ ! -d "$HOMEBREW_TAP_DIR" ]; then
  echo "⚠️  Homebrew tap not found at $HOMEBREW_TAP_DIR, skipping."
else
  TAG="v$VERSION"
  TARBALL_URL="https://github.com/Sobranier/openclaw-cli/archive/refs/tags/${TAG}.tar.gz"

  echo "⏳ Computing sha256 from: $TARBALL_URL"
  SHA256=$(curl -sL "$TARBALL_URL" | shasum -a 256 | awk '{print $1}')

  if [ -z "$SHA256" ] || [ "$SHA256" = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" ]; then
    echo "❌ sha256 invalid — push tag first: git tag v$VERSION && git push origin v$VERSION"
    exit 1
  fi

  echo "🔑 sha256: $SHA256"

  formulas=(
    "$HOMEBREW_TAP_DIR/Formula/openclaw-cli.rb"
    "$HOMEBREW_TAP_DIR/Formula/openclaw-doctor.rb"
    "$HOMEBREW_TAP_DIR/Formula/openclaw-gateway.rb"
    "$HOMEBREW_TAP_DIR/Formula/openclaw-manage.rb"
  )

  for formula in "${formulas[@]}"; do
    [ ! -f "$formula" ] && continue
    sed -i '' "s|/tags/v[0-9.]*\.tar\.gz|/tags/${TAG}.tar.gz|g" "$formula"
    sed -i '' "s/sha256 \"[a-f0-9]*\"/sha256 \"$SHA256\"/" "$formula"
    echo "✅ Updated $(basename "$formula")"
  done

  cd "$HOMEBREW_TAP_DIR"
  git add Formula/
  git commit -m "chore: update formulas to $VERSION" && git push origin main || true
  cd - >/dev/null
fi

echo ""
echo "🎉 Release $VERSION complete!"
