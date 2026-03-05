<p align="center">
  <img src="https://ecap.iminsp.com/image-generation/0e19b4cbb4ac4ebc8766c31eccb2760d.png" alt="OpenClaw Doctor" width="400" />
</p>

<h1 align="center">OpenClaw Doctor</h1>

<p align="center">
  让你的 OpenClaw 服务永不宕机。
</p>

<p align="center">
  <a href="./README.md">English</a>
</p>

## 开始使用

```bash
npm install -g openclaw-doctor
openclaw-doctor watch -d
```

就这样。Doctor 在后台监控你的 OpenClaw 网关，挂了自动重启，全程通知你。无需任何配置——它会自动读取你现有的 OpenClaw 设置。

## 核心命令

```bash
openclaw-doctor watch            # 开始监控（前台）
openclaw-doctor watch -d         # 开始监控（后台）
openclaw-doctor unwatch          # 停止监控

openclaw-doctor status           # 快速健康检查
```

这四个命令覆盖日常 90% 的使用场景。

## 网关管理

```bash
openclaw-doctor gateway start    # 启动 OpenClaw 网关
openclaw-doctor gateway stop     # 停止网关
openclaw-doctor gateway restart  # 重启网关
```

## 诊断和日志

```bash
openclaw-doctor doctor           # 完整诊断（二进制、网关、通道）
openclaw-doctor logs             # 查看网关日志
openclaw-doctor logs --error     # 只看错误日志
openclaw-doctor logs --doctor    # 查看 Doctor 自身事件日志
openclaw-doctor dashboard        # Web 管理面板（http://localhost:9090）
```

## 安装

```bash
# npm（推荐）
npm install -g openclaw-doctor

# 或免安装直接跑
npx openclaw-doctor status
```

需要 Node >= 22（和 OpenClaw 一致）。

## 工作原理

Doctor 自动探测你的 OpenClaw 安装：

- 读取 `~/.openclaw/openclaw.json` 获取网关端口、通道、Agent 信息
- 扫描 `~/Library/LaunchAgents/` 找到 launchd 服务
- 通过 `openclaw health --json` 检查健康（真正的网关 RPC，不是 HTTP 探测）
- 需要时通过 `launchctl kickstart` 重启

**你不需要配置 OpenClaw 的任何信息。** Doctor 会自动搞定。

## 完整命令

| 命令 | 说明 |
|------|------|
| **监控** | |
| `watch` | 开始健康监控（前台） |
| `watch -d` | 开始健康监控（后台） |
| `watch -d --dashboard` | 后台监控 + Web 面板 |
| `unwatch` | 停止监控 |
| **网关** | |
| `gateway start` | 启动 OpenClaw 网关 |
| `gateway stop` | 停止网关 |
| `gateway restart` | 重启网关 |
| **信息** | |
| `status` | 显示网关和通道健康状态 |
| `status --json` | 机器可读的 JSON 输出 |
| `doctor` | 运行完整诊断 |
| `dashboard` | 启动 Web 管理面板 |
| `logs` | 查看网关日志 |
| `logs --error` | 只看错误日志 |
| `logs --doctor` | 查看 Doctor 事件日志 |

## 配置

配置文件位于 `~/.openclaw-doctor/config.json`，首次运行时自动创建。只包含 Doctor 自身的偏好——无需配置 OpenClaw 的信息。

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

| 字段 | 说明 | 默认值 |
|------|------|--------|
| `checkInterval` | 健康检查间隔（秒） | `30` |
| `failThreshold` | 连续失败几次后重启 | `3` |
| `dashboardPort` | Web 面板端口 | `9090` |
| `maxRestartsPerHour` | 每小时最多重启次数 | `5` |
| `openclawProfile` | 监控的 OpenClaw 配置（`default`、`dev`...） | `default` |
| `notify.webhook.url` | Webhook 通知地址 | -- |
| `notify.system.enabled` | macOS 系统通知 | `true` |

## 通知系统

Doctor 在整个生命周期都会通知你：

| 事件 | 示例消息 |
|------|----------|
| 开始监控 | "Doctor 正在守护你的 OpenClaw 服务" |
| 状态异常 | "服务异常（第 2/3 次检测）" |
| 准备重启 | "正在重启网关..." |
| 重启成功 | "网关已恢复上线" |
| 重启失败 | "重启失败：[错误详情]" |
| 重启受限 | "重启次数过多，需要人工介入" |
| 自行恢复 | "服务自行恢复，无需重启" |
| 停止监控 | "Doctor 已停止" |

支持渠道：**Webhook**（钉钉、飞书、Slack、企业微信等）+ **macOS 系统通知**。

## Skills 集成

Doctor 作为独立守护进程运行，可被 OpenClaw 或其他工具调用：

```bash
openclaw-doctor status --json    # 机器可读输出
openclaw-doctor watch -d         # 幂等——重复调用安全
```

即使调用方崩溃，Doctor 继续运行。

## 架构

```
                          +-----------------+
                          |     通知系统     |
                          |  (Webhook/OS)   |
                          +--------^--------+
                                   |
+-------------+    CLI    +--------+--------+    RPC      +-----------+
|  OpenClaw   | --------> |                 | ---------> |  OpenClaw |
|  / 脚本     |           | openclaw-doctor |            |    网关    |
|  / Skills   | <-------- |   (守护进程)     | <--------- |  :18789   |
+-------------+  stdout   +--------+--------+   health   +-----------+
                                   |
                          +--------v--------+
                          | ~/.openclaw/logs |
                          |   (读取并分析)    |
                          +-----------------+
```

## 开发

```bash
git clone https://github.com/openclaw/openclaw-doctor.git
cd openclaw-doctor
npm install

npm run dev -- status          # 快速测试
npm run dev -- watch           # 前台监控
npm run dev -- watch -d        # 后台守护
npm run dev -- unwatch         # 停止守护

npm run build                  # 构建发布版本
```

## 路线图

- [x] 通过 `openclaw health --json` 检查健康 + 自动重启（含频率限制）
- [x] 自动探测 OpenClaw 配置（网关端口、通道、Agent、launchd）
- [x] 后台守护模式（`watch -d` / `unwatch`）
- [x] 网关管理（`gateway start/stop/restart`）
- [x] 读取并展示 OpenClaw 网关日志
- [x] Web 状态面板
- [x] `status --json` 输出
- [ ] 通知系统（Webhook + macOS）
- [ ] `logs --tail`（实时跟踪）
- [ ] `config` 命令（get/set）
- [ ] 多服务监控
- [ ] Linux systemd 支持

## 协议

[MIT](./LICENSE)
