# Contributing to OpenClaw Doctor

Thanks for taking the time to contribute!

## Development Setup

```bash
git clone https://github.com/Sobranier/openclaw-cli.git
cd openclaw-doctor
npm install
```

### Running locally

```bash
npm run dev -- status          # Quick health check
npm run dev -- watch           # Foreground monitoring
npm run dev -- watch -d        # Background daemon
npm run dev -- unwatch         # Stop daemon
```

### Building

```bash
npm run build
```

Output goes to `dist/`.

## Project Structure

```
src/
  commands/      # CLI command handlers (watch, status, gateway, logs, ...)
  core/          # Health check, restart logic, daemon management
  dashboard/     # Web UI (Express + static assets)
  notify/        # Notification channels (webhook, macOS system)
  utils/         # OpenClaw config auto-detection, launchd helpers
scripts/
  publish.sh     # Multi-package publish script
```

## Making Changes

1. Fork the repo and create a branch from `main`:
   ```bash
   git checkout -b fix/your-change
   ```
2. Make your changes and test locally with `npm run dev`.
3. Build to make sure nothing is broken:
   ```bash
   npm run build
   ```
4. Open a Pull Request against `main`.

## Release Workflow

This repo publishes multiple npm packages from the same codebase. **Do not publish manually.**

### Packages

| Package | Config |
|---------|--------|
| `openclaw-doctor` | `package.json` |
| `openclaw-cli` | `package.openclaw-cli.json` |
| `openclaw-manage` | `package.openclaw-manage.json` |
| _(and others)_ | `package.openclaw-*.json` |

All packages share the same version number and `dist/` output.

### Cutting a release

```bash
# 1. Pull latest
git pull origin main

# 2. Bump version (patch / minor / major)
npm version patch   # e.g. 0.3.0 → 0.3.1

# 3. Build + publish all packages
npm run release
```

`npm run release` calls `scripts/publish.sh`, which:
1. Builds once (`npm run build`)
2. Publishes `openclaw-doctor` with `package.json`
3. For each `package.openclaw-*.json`: temporarily swaps it in as `package.json`, publishes, then restores

### Version sync

All `package.openclaw-*.json` files must stay in sync with `package.json`. The publish script reads whichever `package.json` is active — keep `version` consistent across all of them.

To update a sub-package metadata (description, keywords, bin), edit its `package.openclaw-*.json` directly.

## Reporting Issues

Open an issue on GitHub with:
- Your OpenClaw version (`openclaw --version`)
- Your OS and Node.js version
- The output of `openclaw-doctor doctor`
- What you expected vs. what happened

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
