<p align="center">
  <img src="https://raw.githubusercontent.com/Sobranier/openclaw-cli/main/assets/welcome.png" alt="OpenClaw CLI" width="400" />
</p>

<h1 align="center">OpenClaw CLI</h1>

<p align="center">
  Keep your OpenClaw service alive. Automatically.
</p>

<p align="center">
  <a href="./README.zh-CN.md">中文文档</a> | <a href="https://openclaw-cli.app">🌐 官网</a>
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

## Why Doctor?

OpenClaw runs as a local daemon. When it crashes — network hiccup, system wake, bad update — your AI assistant goes dark. You notice only when you try to use it.

Doctor watches the gateway for you. It detects failures, restarts the service automatically, and notifies you. No config, no babysitting.

## Get Started

```bash
npm install -g openclaw-cli
openclaw-cli watch -d
```

That's it. OpenClaw CLI is now running in the background.

<p align="center">
  <img src="https://raw.githubusercontent.com/Sobranier/openclaw-cli/main/assets/demo.gif" alt="OpenClaw CLI demo" width="700" />
</p>

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
