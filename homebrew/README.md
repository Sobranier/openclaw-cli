# Homebrew Tap — OpenClaw

This directory contains Homebrew formulas for OpenClaw tools.

## Setup

1. Create a new GitHub repo: `Sobranier/homebrew-openclaw`
2. Copy the `.rb` files from this directory into `Formula/` in that repo
3. After creating a GitHub Release (e.g. `v0.3.0`), update the `sha256` in each formula:

```bash
curl -sL https://github.com/Sobranier/openclaw-doctor/archive/refs/tags/v0.3.0.tar.gz | shasum -a 256
```

## Installation (once published)

```bash
brew tap Sobranier/openclaw
brew install openclaw-cli

# Or the doctor alias (backward compat)
brew install openclaw-doctor
```

## Update formula on new release

When you publish a new version:

1. Update `url` version tag in both `.rb` files
2. Recalculate `sha256`:
   ```bash
   curl -sL https://github.com/Sobranier/openclaw-doctor/archive/refs/tags/vX.X.X.tar.gz | shasum -a 256
   ```
3. Update `sha256` in both `.rb` files
4. Commit and push to `homebrew-openclaw` repo

> Tip: Add this to `scripts/publish.sh` to automate the sha256 update.
