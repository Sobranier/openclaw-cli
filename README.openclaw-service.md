<p align="center">
  <img src="https://raw.githubusercontent.com/Sobranier/openclaw-cli/main/assets/welcome.png" alt="OpenClaw service" width="400" />
</p>

<h1 align="center">OpenClaw service</h1>

<p align="center">
  Keep your OpenClaw service alive. Automatically.
</p>

<p align="center">
  <a href="./README.zh-CN.md">中文文档</a>
</p>

## Get Started

```bash
npm install -g openclaw-service
openclaw-service watch -d
```

That's it. Doctor monitors your OpenClaw gateway in the background, restarts it when it goes down, and tells you what happened. Zero configuration needed -- it reads everything from your existing OpenClaw setup.

## Core Commands

```bash
openclaw-service watch            # Start monitoring (foreground)
openclaw-service watch -d         # Start monitoring (background)
openclaw-service unwatch          # Stop monitoring

openclaw-service status           # Quick health check
```

These four commands cover 90% of daily use.

## Gateway Management

```bash
openclaw-service gateway start    # Start the OpenClaw gateway
openclaw-service gateway stop     # Stop the gateway
openclaw-service gateway restart  # Restart the gateway
```

## Diagnostics & Logs

```bash
openclaw-service doctor           # Full diagnostics (binary, gateway, channels)
openclaw-service logs             # View gateway logs
openclaw-service logs --error     # View error logs only
openclaw-service logs --doctor    # View Doctor's own event logs
openclaw-service dashboard        # Web management UI (http://localhost:9090)
```

## Install

```bash
# npm (recommended)
npm install -g openclaw-service

# or run without installing
npx openclaw-service status
```

Requires Node >= 22 (same as OpenClaw).

## How It Works

Doctor auto-detects your OpenClaw installation:

- Reads `~/.openclaw/openclaw.json` for gateway port, channels, agents
- Finds the launchd service from `~/Library/LaunchAgents/`
- Checks health via `openclaw health --json` (real gateway RPC, not HTTP)
- Restarts via `launchctl kickstart` when needed

**You don't configure OpenClaw details.** Doctor figures them out.

## All Commands

| Command | Description |
|---------|-------------|
| **Monitoring** | |
| `watch` | Start health monitoring (foreground) |
| `watch -d` | Start health monitoring (background) |
| `watch -d --dashboard` | Background monitoring + web dashboard |
| `unwatch` | Stop monitoring |
| **Gateway** | |
| `gateway start` | Start the OpenClaw gateway |
| `gateway stop` | Stop the gateway |
| `gateway restart` | Restart the gateway |
| **Info** | |
| `status` | Show gateway and channel health |
| `status --json` | Machine-readable JSON output |
| `doctor` | Run full diagnostics |
| `dashboard` | Start web management UI |
| `logs` | Show gateway logs |
| `logs --error` | Show error logs only |
| `logs --doctor` | Show Doctor event logs |

## Configuration

Config is stored at `~/.openclaw-doctor/config.json`. Created automatically on first run. Only Doctor's own preferences -- no OpenClaw settings needed.

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

| Field | Description | Default |
|-------|-------------|---------|
| `checkInterval` | Seconds between health checks | `30` |
| `failThreshold` | Consecutive failures before restart | `3` |
| `dashboardPort` | Web dashboard port | `9090` |
| `maxRestartsPerHour` | Restart throttle | `5` |
| `openclawProfile` | OpenClaw profile to monitor (`default`, `dev`, ...) | `default` |
| `notify.webhook.url` | Webhook for notifications | -- |
| `notify.system.enabled` | macOS native notifications | `true` |

## Notifications

Doctor notifies you across the full lifecycle:

| Event | Example |
|-------|---------|
| Monitoring started | "Doctor is watching your OpenClaw service" |
| Health degraded | "Service unhealthy (attempt 2/3)" |
| Restarting | "Restarting gateway..." |
| Restart succeeded | "Gateway back online" |
| Restart failed | "Restart failed: [error]" |
| Throttled | "Too many restarts, manual intervention needed" |
| Recovered | "Service recovered on its own" |
| Monitoring stopped | "Doctor stopped" |

Channels: **Webhook** (DingTalk, Feishu, Slack, etc.) + **macOS system notifications**.

## Skills Integration

Doctor runs as a standalone daemon, callable by OpenClaw or other tools:

```bash
openclaw-service status --json    # Machine-readable output
openclaw-service watch -d         # Idempotent -- safe to call repeatedly
```

If the caller crashes, Doctor keeps running.

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

## Development

```bash
git clone https://github.com/openclaw/openclaw-doctor.git
cd openclaw-doctor
npm install

npm run dev -- status          # Quick test
npm run dev -- watch           # Foreground monitoring
npm run dev -- watch -d        # Background daemon
npm run dev -- unwatch         # Stop daemon

npm run build                  # Build for distribution
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

## License

[MIT](./LICENSE)

## Publishing

This repo publishes two npm packages from the same codebase:

- **`openclaw-service`** — the main package (`package.json`)
- **`openclaw-service`** — alias package (`package.openclaw-service.json`)

Both packages share the same version number and dist output.

### Release a new version

```bash
# 1. Bump version (patch / minor / major)
npm version patch

# 2. Build + publish both packages
npm run release
```

`npm run release` calls `scripts/publish.sh`, which:
1. Builds once (`npm run build`)
2. Publishes `openclaw-service` with the default `package.json`
3. Temporarily swaps in `package.openclaw-service.json`, publishes `openclaw-service`, then restores

To update the `openclaw-service` package metadata (description, keywords, bin name, etc.), edit `package.openclaw-service.json`. Keep `version` in sync — it's automatically picked up from whichever `package.json` is active during publish.
