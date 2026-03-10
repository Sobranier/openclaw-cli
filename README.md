<p align="center">
  <img src="https://raw.githubusercontent.com/Sobranier/openclaw-cli/main/assets/welcome.png" alt="OpenClaw Doctor" width="400" />
</p>

<h1 align="center">OpenClaw CLI</h1>

<p align="center">
  Keep your OpenClaw service alive. Automatically.
</p>

<p align="center">
  <a href="./README.zh-CN.md">中文文档</a> | <a href="https://openclaw-cli.app">🌐 官网</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/openclaw-doctor"><img src="https://img.shields.io/npm/v/openclaw-cli?label=openclaw-cli&color=blue" alt="npm version" /></a>
  &nbsp;
  <a href="https://www.npmjs.com/package/openclaw-doctor"><img src="https://img.shields.io/npm/dm/openclaw-cli?color=blue" alt="npm downloads" /></a>
  &nbsp;
  <a href="https://www.npmjs.com/package/openclaw-cli"><img src="https://img.shields.io/npm/v/openclaw-cli?label=openclaw-cli&color=blue" alt="npm openclaw-cli" /></a>
  &nbsp;
  <a href="https://www.npmjs.com/package/openclaw-manage"><img src="https://img.shields.io/npm/v/openclaw-manage?label=openclaw-manage&color=green" alt="npm openclaw-manage" /></a>
  &nbsp;
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-brightgreen" alt="License" /></a>
  &nbsp;
  <img src="https://img.shields.io/node/v/openclaw-doctor" alt="Node version" />
</p>

---

## Why Doctor?

OpenClaw runs as a local daemon. When it crashes — network hiccup, system wake, bad update — your AI assistant goes dark. You notice only when you try to use it.

**Doctor watches the gateway for you.** It detects failures, restarts the service automatically, and notifies you. No config, no babysitting.

## Primary Package

> **`openclaw-cli` is the primary package.** All package names (`openclaw-doctor`, `openclaw-manage`, `qclaw`, `aiclaw`, etc.) point to the same tool — install whichever name feels right, it works identically.
>
> `openclaw-doctor` is the original name and is kept for backward compatibility.

## Get Started

```bash
npm install -g openclaw-doctor
openclaw-doctor watch -d
```

That's it. Doctor is now running in the background. It reads everything from your existing OpenClaw setup — no configuration needed.

<p align="center">
  <img src="https://raw.githubusercontent.com/Sobranier/openclaw-cli/main/assets/demo.gif" alt="OpenClaw Doctor demo" width="700" />
</p>

## Core Commands

```bash
openclaw-doctor watch            # Start monitoring (foreground)
openclaw-doctor watch -d         # Start monitoring (background)
openclaw-doctor unwatch          # Stop monitoring

openclaw-doctor status           # Quick health check
```

These four cover 90% of daily use.

## Gateway Management

```bash
openclaw-doctor gateway start    # Start the OpenClaw gateway
openclaw-doctor gateway stop     # Stop the gateway
openclaw-doctor gateway restart  # Restart the gateway
```

## Diagnostics & Logs

```bash
openclaw-doctor doctor           # Full diagnostics (binary, gateway, channels)
openclaw-doctor logs             # View gateway logs
openclaw-doctor logs --error     # Error logs only
openclaw-doctor logs --doctor    # Doctor's own event logs
openclaw-doctor dashboard        # Web management UI → http://localhost:9090
```

## Install

```bash
# npm (recommended)
npm install -g openclaw-doctor

# Run without installing
npx openclaw-doctor status
```

> Requires Node.js >= 22 (same as OpenClaw).

## How It Works

Doctor auto-detects your OpenClaw installation — no manual config:

- Reads `~/.openclaw/openclaw.json` for gateway port, channels, and agents
- Finds the launchd service under `~/Library/LaunchAgents/`
- Checks health via `openclaw health --json` (real gateway RPC, not HTTP ping)
- Restarts via `launchctl kickstart` when consecutive failures exceed the threshold

## All Commands

| Command | Description |
|---------|-------------|
| `watch` | Start health monitoring (foreground) |
| `watch -d` | Start health monitoring (background) |
| `watch -d --dashboard` | Background monitoring + web dashboard |
| `unwatch` | Stop monitoring |
| `gateway start` | Start the OpenClaw gateway |
| `gateway stop` | Stop the gateway |
| `gateway restart` | Restart the gateway |
| `status` | Show gateway and channel health |
| `status --json` | Machine-readable JSON output |
| `doctor` | Run full diagnostics |
| `dashboard` | Start web management UI |
| `logs` | Show gateway logs |
| `logs --error` | Error logs only |
| `logs --doctor` | Doctor event logs |

## Configuration

Auto-created at `~/.openclaw-doctor/config.json` on first run.

```json
{
  "checkInterval": 30,
  "failThreshold": 3,
  "dashboardPort": 9090,
  "maxRestartsPerHour": 5,
  "openclawProfile": "default",
  "notify": {
    "webhook": {
      "enabled": false,
      "url": "",
      "bodyTemplate": "{\"msgtype\":\"text\",\"text\":{\"content\":\"{{message}}\"}}"
    },
    "system": {
      "enabled": true
    }
  }
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `checkInterval` | `30` | Seconds between health checks |
| `failThreshold` | `3` | Consecutive failures before restart |
| `dashboardPort` | `9090` | Web dashboard port |
| `maxRestartsPerHour` | `5` | Restart throttle (prevents restart loops) |
| `openclawProfile` | `"default"` | OpenClaw profile to monitor |
| `notify.webhook.url` | — | Webhook URL (DingTalk, Feishu, Slack, etc.) |
| `notify.system.enabled` | `true` | macOS native notifications |

## Notifications

Doctor covers the full restart lifecycle:

| Event | Message |
|-------|---------|
| Started | "Doctor is watching your OpenClaw service" |
| Degraded | "Service unhealthy (attempt 2/3)" |
| Restarting | "Restarting gateway..." |
| Recovered | "Gateway back online" |
| Failed | "Restart failed: [error]" |
| Throttled | "Too many restarts — manual intervention needed" |
| Self-recovered | "Service recovered on its own" |
| Stopped | "Doctor stopped" |

**Channels:** Webhook (DingTalk, Feishu, Slack, custom) + macOS system notifications.

## Architecture

```
                          +-----------------+
                          |  Notification   |
                          |  (Webhook/OS)   |
                          +--------^--------+
                                   |
+-------------+    CLI    +--------+--------+    RPC      +-----------+
|  OpenClaw   | --------> |                 | ---------> |  OpenClaw |
|  / Scripts  |           | openclaw-doctor |            |  Gateway  |
|  / Skills   | <-------- |  (daemon)       | <--------- | :18789    |
+-------------+  stdout   +--------+--------+  health    +-----------+
                                   |
                          +--------v--------+
                          | ~/.openclaw/logs |
                          | (read & analyze) |
                          +-----------------+
```

Doctor runs as a standalone daemon. If the calling process crashes, Doctor keeps running.

```bash
openclaw-doctor status --json    # Machine-readable — pipe into scripts or agents
openclaw-doctor watch -d         # Idempotent — safe to call repeatedly
```

## Roadmap

- [x] Health check via `openclaw health --json` + auto-restart with throttling
- [x] Auto-detect OpenClaw config (gateway port, channels, agents, launchd)
- [x] Background daemon mode (`watch -d` / `unwatch`)
- [x] Gateway management (`gateway start/stop/restart`)
- [x] Read and display OpenClaw gateway logs
- [x] Web status dashboard
- [x] `--json` output for status
- [ ] Notification system (Webhook + macOS)
- [ ] `logs --tail` (real-time follow)
- [ ] `config` command (get/set)
- [ ] Multiple service monitoring
- [ ] Linux systemd support

## Development

```bash
git clone https://github.com/Sobranier/openclaw-cli.git
cd openclaw-doctor
npm install

npm run dev -- status          # Quick test
npm run dev -- watch           # Foreground monitoring
npm run dev -- watch -d        # Background daemon
npm run dev -- unwatch         # Stop daemon

npm run build                  # Build for distribution
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the release and publish workflow.

## License

[MIT](./LICENSE)

---

Works with [OpenClaw](https://openclaw.ai) · Built for the OpenClaw ecosystem
