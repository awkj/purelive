# Playwright + WXT 自动化调试回路 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Claude 通过 Playwright MCP 直接驱动一个加载了开发版扩展的 Chrome 实例，保留斗鱼登录态，并与 `pnpm dev` 热重载联动。

**Architecture:** WXT dev server 只负责构建 + WS 通知扩展自重载（不开浏览器）；Playwright MCP 启动持久化 profile 的真 Chrome，通过 `launchOptions.args` 加载 `.output/chrome-mv3-dev/`；Claude 直接走 MCP 工具调用浏览器。

**Tech Stack:** WXT 0.20、`@playwright/mcp@latest`、Google Chrome（系统安装）、JSON 配置

**Spec:** `docs/superpowers/specs/2026-05-16-playwright-debug-loop-design.md`

---

## File Structure

| 文件 | 操作 | 责任 |
|---|---|---|
| `wxt.config.ts` | 修改 | 加 `webExt: { disabled: true }` 阻止 WXT 开浏览器 |
| `.playwright-mcp/config.json` | 新建 | Playwright MCP 的浏览器配置（channel、profile 路径、launch args） |
| `.mcp.json` | 新建 | 项目级 MCP 配置，覆盖全局 playwright MCP 启动参数 |
| `.playwright-mcp/chrome-profile/` | 自动生成 | 首次启动后由 Chrome 创建，存放 cookies / localStorage |

---

## 环境前置检查（Task 0）

### Task 0: 验证 Chrome 安装位置

**Files:** 无

- [ ] **Step 1: 检查 Google Chrome 是否已装在系统标准位置**

Run: `ls -d "/Applications/Google Chrome.app" 2>&1`
Expected: 输出 `/Applications/Google Chrome.app`，无 "No such file" 错误。

若不存在：
- 若装的是 Chrome Canary：`ls -d "/Applications/Google Chrome Canary.app"`，后续 config.json 里 `channel` 改 `"chrome-canary"`
- 若装的是 Edge：`channel` 改 `"msedge"`，并确认 `/Applications/Microsoft Edge.app/` 存在
- 都没有：先装 Chrome，再继续

- [ ] **Step 2: 记录 channel 选择**

把下一步用到的 channel 值记下：默认 `"chrome"`。

---

## Task 1: 禁用 WXT 自启动浏览器

**Files:**
- Modify: `wxt.config.ts`

- [ ] **Step 1: 阅读当前配置**

Run: `cat /Users/doctor/Developer/personal/awkj/purelive/wxt.config.ts`
Expected output:
```ts
import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  manifest: {
    name: '沉浸式直播 · PureLive',
    description: '清理斗鱼直播页面，仅保留播放器与弹幕，支持居中 / 网页全屏 / 真正全屏。',
    permissions: ['storage'],
    host_permissions: ['*://*.douyu.com/*'],
    action: {},
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
```

- [ ] **Step 2: 在 defineConfig 对象里加 `webExt: { disabled: true }`**

最终内容应为：

```ts
import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  manifest: {
    name: '沉浸式直播 · PureLive',
    description: '清理斗鱼直播页面，仅保留播放器与弹幕，支持居中 / 网页全屏 / 真正全屏。',
    permissions: ['storage'],
    host_permissions: ['*://*.douyu.com/*'],
    action: {},
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  webExt: { disabled: true },
});
```

- [ ] **Step 3: 类型检查**

Run: `cd /Users/doctor/Developer/personal/awkj/purelive && pnpm compile`
Expected: 退出码 0，无报错。

- [ ] **Step 4: 冒烟测试 — pnpm dev 不应再开浏览器**

Run（后台 5 秒后 kill）：
```bash
cd /Users/doctor/Developer/personal/awkj/purelive && timeout 8 pnpm dev 2>&1 | head -40
```
Expected: 看到 `[wxt] ✔ Built extension in ...` 之类的字样，**没有**看到 `Opening browser` / `web-ext` / Chrome 窗口弹出的提示。日志里出现 `runner: disabled` 之类描述也属正常。

> 若仍然弹浏览器：检查字段是否真的写成 `webExt`（不是 `webext` / `Webext`）。

---

## Task 2: 创建 Playwright MCP 配置文件

**Files:**
- Create: `.playwright-mcp/config.json`

- [ ] **Step 1: 确认 `.playwright-mcp/` 目录已存在**

Run: `ls -d /Users/doctor/Developer/personal/awkj/purelive/.playwright-mcp`
Expected: 输出该目录路径（之前用过 Playwright MCP，目录已自动建好）。若不存在，先 `mkdir -p`。

- [ ] **Step 2: 创建 config.json**

把以下内容写到 `/Users/doctor/Developer/personal/awkj/purelive/.playwright-mcp/config.json`：

```json
{
  "browser": {
    "isolated": false,
    "userDataDir": "/Users/doctor/Developer/personal/awkj/purelive/.playwright-mcp/chrome-profile",
    "launchOptions": {
      "channel": "chrome",
      "headless": false,
      "args": [
        "--disable-extensions-except=/Users/doctor/Developer/personal/awkj/purelive/.output/chrome-mv3-dev",
        "--load-extension=/Users/doctor/Developer/personal/awkj/purelive/.output/chrome-mv3-dev"
      ]
    }
  },
  "outputDir": "/Users/doctor/Developer/personal/awkj/purelive/.playwright-mcp"
}
```

> 若 Task 0 选了非默认 channel，把 `"chrome"` 改成对应值。

- [ ] **Step 3: JSON 语法校验**

Run:
```bash
node -e "JSON.parse(require('fs').readFileSync('/Users/doctor/Developer/personal/awkj/purelive/.playwright-mcp/config.json','utf8'))" && echo OK
```
Expected: 输出 `OK`。

- [ ] **Step 4: 验证扩展输出目录存在（dev server 可能还没启过）**

Run:
```bash
ls /Users/doctor/Developer/personal/awkj/purelive/.output/chrome-mv3-dev/manifest.json 2>&1
```
Expected: 输出 manifest.json 路径，无报错。
若报错：先 `cd /Users/doctor/Developer/personal/awkj/purelive && timeout 15 pnpm dev` 触发一次构建，等看到 `Built extension` 后 Ctrl-C，再重试。

---

## Task 3: 创建项目级 .mcp.json

**Files:**
- Create: `.mcp.json`

- [ ] **Step 1: 创建 .mcp.json**

把以下内容写到 `/Users/doctor/Developer/personal/awkj/purelive/.mcp.json`：

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest",
        "--config=/Users/doctor/Developer/personal/awkj/purelive/.playwright-mcp/config.json"
      ]
    }
  }
}
```

> `--config` 用绝对路径，避免 Claude Code 启动 MCP 时的 cwd 不确定。

- [ ] **Step 2: JSON 语法校验**

Run:
```bash
node -e "JSON.parse(require('fs').readFileSync('/Users/doctor/Developer/personal/awkj/purelive/.mcp.json','utf8'))" && echo OK
```
Expected: 输出 `OK`。

- [ ] **Step 3: 干跑 Playwright MCP CLI 看参数解析正常**

Run:
```bash
timeout 5 npx -y @playwright/mcp@latest --config=/Users/doctor/Developer/personal/awkj/purelive/.playwright-mcp/config.json 2>&1 | head -10
```
Expected: 输出包含 "Listening" 或服务启动日志；**不应**出现 `Unknown option` / `Cannot find config`。`timeout` 终止时退出码 124 属正常。

---

## Task 4: 端到端冒烟（需要重启 Claude Code）

**Files:** 无（仅验证）

> 此 Task 必须在用户层面操作，Claude 自己无法重启自己。把以下步骤交给用户。

- [ ] **Step 1: 写一份"使用须知"到 spec 同目录**

把以下内容追加到 `docs/superpowers/specs/2026-05-16-playwright-debug-loop-design.md` 末尾（如尚未存在 "使用须知" 章节）：

```markdown
## 启用须知（每次新机器/首次配置后）

1. 关闭并重新打开 Claude Code（MCP 配置只在会话启动时加载）。重启后 `.mcp.json` 信任弹窗会出现，点信任。
2. 终端 A 运行 `pnpm dev`，等 `Built extension` 出现。
3. 让 Claude `browser_navigate('https://www.douyu.com/')`，弹出的 Chrome 里手动登录斗鱼一次（仅首次需要）。
4. 此后 Claude 可直接 `browser_navigate` 到任意房间、`browser_console_messages` 看日志、`browser_evaluate` 跑 JS。
```

- [ ] **Step 2: 终端 A 跑 `pnpm dev`**

Run（保持终端 A 常驻）：
```bash
cd /Users/doctor/Developer/personal/awkj/purelive && pnpm dev
```
Expected: 看到 `Built extension in <ms>` 字样，进程不退出，开始 watch。

- [ ] **Step 3: 用户重启 Claude Code**

在 Claude Code 内执行 `/exit`（或直接关掉窗口重开）。重启后会有 `.mcp.json` 信任提示，选信任。

- [ ] **Step 4: Claude 调用 browser_navigate 验证扩展加载**

新会话里告诉 Claude："验证 Playwright 加载扩展是否成功。" Claude 应：

1. 调 `mcp__playwright__browser_navigate` 打开 `chrome://extensions/`
2. 调 `mcp__playwright__browser_snapshot` 抓页面
3. 在 snapshot 中确认能看到 "沉浸式直播 · PureLive" 这个扩展条目

Expected: snapshot 中包含扩展名字符串。

- [ ] **Step 5: 验证斗鱼页面上扩展生效**

Claude 调：
1. `browser_navigate('https://www.douyu.com/')`
2. `browser_console_messages` 看是否有 content script 注入相关日志
3. `browser_evaluate` 跑 `document.documentElement.classList.contains('pl-active')` —— 这个 class 由扩展添加，是验证扩展激活的最小信号

Expected: evaluate 返回 `true`（或扩展未默认开启的话返回 `false`，但 popup 操作后能切到 `true`）。

- [ ] **Step 6: 验证登录态持久化**

Claude 调 `browser_navigate('https://www.douyu.com/')`，让用户在弹出的 Chrome 里完成斗鱼登录。然后 Claude 关掉浏览器（不关 MCP server，只是关页面），再 `browser_navigate('https://www.douyu.com/')`：

Expected: 仍是登录态，无需重新登录。

- [ ] **Step 7: 验证热重载**

Claude 故意改一处 content script 里的 console.log 文案（比如 `entrypoints/content/index.tsx` 里加一行 `console.log('[dyc] hot-reload-test-token')`），然后：
1. 等 `pnpm dev` 终端出现 `Built extension`
2. `browser_navigate` 重新打开斗鱼页面（或直接 `browser_evaluate('location.reload()')`）
3. `browser_console_messages` 应看到 `[dyc] hot-reload-test-token`

之后撤销那条 console.log。

Expected: 看到刚加的日志，证明改代码 → 自动重建 → 扩展自动 reload → Claude 通过 MCP 能读到新日志 的全链路通。

---

## Self-Review 记录

- ✅ Spec coverage：四章节（链路图、配置改动、工作流、故障排查）每一条都映射到 Task 0–4。
- ✅ No placeholders：所有 JSON 内容、命令、预期输出都是字面值。
- ✅ Type consistency：`webExt` 拼写一致；channel `"chrome"` 在 spec 与 plan 一致；扩展路径绝对路径在三处一致。
- ✅ 项目非 git 仓库这点已在 spec 注明，plan 中无 `git commit` 步骤（因为没法 commit）。
