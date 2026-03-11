# Contributing to OpenClaw CLI

Thanks for helping improve OpenClaw CLI.

## Development Setup

```bash
git clone https://github.com/Sobranier/openclaw-cli.git
cd openclaw-cli
npm install
```

## Run Locally

```bash
npm run dev -- status
npm run dev -- watch
npm run dev -- gateway status
```

## Build

```bash
npm run build
```

Output is in `dist/`.

## Project Structure

```text
src/
  commands/      # watch/status/doctor/gateway/logs handlers
  core/          # health check, restart logic, daemon management
  dashboard/     # local web UI
  utils/         # OpenClaw detection and helpers
scripts/
  publish.sh     # nightly multi-package publish script
```

## Package Model

This repository publishes one core package plus many aliases.

- Primary package: `openclaw-cli`
- Alias examples: `openclaw-doctor`, `hello-claw`, `aiclaw`, `pddclaw`
- All aliases share the same runtime (`dist/index.js`)

### Alias rules

For every alias package:

- `bin` must map alias name to `./dist/index.js`
- README should keep command examples in alias name (`hello-claw watch -d`)
- README links should point to:
  - `https://openclaw-cli.app`
  - `https://www.npmjs.com/package/openclaw-cli`

## Quality Gate Before Release

Run these before nightly release:

```bash
npm run build
node scripts/validate-aliases.mjs
bash scripts/smoke-aliases.sh
```

`validate-aliases.mjs` checks alias package metadata + README links.
`smoke-aliases.sh` checks real command execution for sampled aliases.

## Release Policy (Important)

- Do **not** push directly to `main` during daytime.
- Work on a release branch, e.g. `release/YYYYMMDD-2300`.
- Nightly release window: **23:00 Asia/Shanghai**.
- Publish and merge in the nightly window only.

## License

By contributing, you agree your contributions are licensed under [MIT](./LICENSE).
