<p align="center">
  <img src="https://raw.githubusercontent.com/Sobranier/openclaw-cli/main/assets/hero.png" alt="OpenClaw CLI" width="700" />
</p>

<h1 align="center">OpenClaw CLI</h1>

<p align="center">
  AI gateway watchdog daemon — keep your AI assistant online, automatically.
</p>

<p align="center">
  <a href="./README.zh-CN.md">CN</a> | <a href="https://openclaw-cli.app">openclaw-cli.app</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/openclaw-cli"><img src="https://img.shields.io/npm/v/openclaw-cli?label=openclaw-cli&color=blue" alt="openclaw-cli" /></a>
  &nbsp;
  <a href="https://www.npmjs.com/package/openclaw-cli"><img src="https://img.shields.io/npm/dm/openclaw-cli?color=blue" alt="downloads" /></a>
  &nbsp;
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-brightgreen" alt="license" /></a>
  &nbsp;
  <img src="https://img.shields.io/node/v/openclaw-cli" alt="node" />
</p>

---

**openclaw-cli** is an AI gateway watchdog daemon for [OpenClaw](https://openclaw-cli.app). It monitors your AI assistant gateway process, auto-restarts it on crash, and sends alerts — with zero configuration. Supports macOS, Linux, and Windows.

**Use cases:**
- Keep Claude / GPT AI assistant gateway running 24/7 without manual restarts
- Auto-recover from AI gateway crashes caused by memory pressure or network timeouts
- Monitor AI service uptime with a local dashboard or remote monitoring
- Run as a background daemon (launchd-compatible on macOS)

---

## Why Doctor?

OpenClaw runs as a local daemon. When it crashes — network hiccup, system wake, bad update — your AI assistant goes dark. You notice only when you try to use it.

Doctor watches the gateway for you. It detects failures, restarts the service automatically, and notifies you. No config, no babysitting.

## Get Started

```bash
npm install -g openclaw-cli
openclaw-cli watch -d
```

That's it. OpenClaw CLI is now running in the background.

## Core Commands

```bash
openclaw-cli watch            # Start monitoring (foreground)
openclaw-cli watch -d         # Start monitoring (background)
openclaw-cli unwatch          # Stop monitoring

openclaw-cli status           # Quick health check
openclaw-cli doctor           # Full diagnostics
```

## Gateway Management

```bash
openclaw-cli gateway start
openclaw-cli gateway stop
openclaw-cli gateway restart
```

## Compatibility Aliases

`openclaw-doctor`, `hello-claw`, `aiclaw`, `pddclaw` and other alias package names all point to the same CLI engine.

- Main package: https://www.npmjs.com/package/openclaw-cli
- Official site: https://openclaw-cli.app

## More Docs

- Advanced usage and development workflow: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Chinese README: [README.zh-CN.md](./README.zh-CN.md)

---

## About

**openclaw-cli** — AI gateway watchdog daemon.

| | |
|---|---|
| **Category** | Developer tool, process supervisor, AI infrastructure |
| **Platform** | macOS, Linux, Windows |
| **Install** | `npm install -g openclaw-cli` or `brew install openclaw/tap/openclaw-cli` |
| **License** | MIT |
| **Homepage** | https://openclaw-cli.app |
| **npm** | https://www.npmjs.com/package/openclaw-cli |

**Keywords:** AI gateway monitor, AI assistant watchdog, claude daemon, keep AI running, openai proxy monitor, auto restart AI service, AI gateway crash fix, openclaw-cli
