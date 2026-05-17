# Playwright + WXT 自动化调试回路

**日期**：2026-05-16
**目标**：让 Claude 通过 Playwright MCP 直接驱动一个加载了开发版扩展的 Chrome 实例，保留斗鱼登录态，并与 `pnpm dev` 的热重载链路联动，免去人工进控制台的步骤。

## 当前痛点

`@playwright/mcp` 默认启动的 chromium **不加载本地解压扩展**，所以以前调试时，必须在自己的 Chrome 手动 reload 扩展，再把现象口述给 Claude，或让 Claude 让用户进 DevTools 跑命令——回路冗长。

## 方案：项目级 MCP 配置 + 持久化 profile + WXT dev 单独跑

### 三条链路

| 链路 | 职责 | 由谁启动 |
|---|---|---|
| **WXT dev server** | 监听源码变化、重建 `.output/chrome-mv3-dev/`、通过 WS 通知扩展 reload 自身 | `pnpm dev`（终端常驻） |
| **Chrome 实例** | 加载 `.output/chrome-mv3-dev/`、持久化用户数据 | Playwright MCP（按需启动，Claude 操作时拉起） |
| **MCP 工具通道** | Claude 调用 `browser_navigate` / `browser_console_messages` / `browser_evaluate` 等 | `@playwright/mcp` |

WXT dev 不再自己开浏览器（`webExt.disabled = true`），但扩展构建产物里的 WS 客户端仍会连 WXT dev server，所以热重载链路完整保留——只是浏览器换成了 Playwright 启动的那个。

### 配置改动清单

#### 1. `wxt.config.ts`

```ts
export default defineConfig({
  // ... 原有字段
  webExt: { disabled: true },
});
```

#### 2. `.mcp.json`（项目根，新文件）

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest",
        "--config=./.playwright-mcp/config.json"
      ]
    }
  }
}
```

项目级 `.mcp.json` 会覆盖全局 `~/.claude.json` 中的同名 MCP，仅在本项目生效，不污染其他项目。

#### 3. `.playwright-mcp/config.json`（新文件）

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
  "outputDir": "./.playwright-mcp"
}
```

- `channel: "chrome"`：用系统 Chrome，而不是 Playwright 自带的 chromium（扩展兼容性更好）
- `isolated: false` + `userDataDir`：profile 持久化到 `.playwright-mcp/chrome-profile/`，首次登录斗鱼后 cookies / localStorage 留存
- `--load-extension`：用 **绝对路径**，因为 Chrome 解析这个 flag 时的 cwd 不可控
- `outputDir: "./.playwright-mcp"`：MCP 的 console log / page snapshot 写到项目内（沿用现状）

#### 4. `_gitignore`

> 项目当前不是 git 仓库（WXT scaffold 留了 `_gitignore` 模板）。若后续 `git init`，把以下两行加入忽略列表：
>
> ```
> .playwright-mcp/chrome-profile/
> .mcp.json
> ```
>
> `.mcp.json` 不入库的取舍见下文"为什么 .mcp.json 不入库"。

## 工作流（最终形态）

1. **每次开始调试时（终端 A）**：`pnpm dev`，等首次构建完成
2. **首次使用前一次性操作**：让 Claude `browser_navigate` 到 douyu.com，在弹出的 Chrome 里手动登录一次；之后 profile 持久化，无需再登
3. **平常调试**：Claude 调 `browser_navigate('https://www.douyu.com/<房间号>')` → 扩展已加载 → 调 `browser_console_messages` 看 log、`browser_evaluate` 跑 JS、`browser_take_screenshot` 截图
4. **代码改动**：Claude 编辑源码 → WXT 自动 rebuild → 扩展自动 reload → 当前 tab 触发 content script 重注入（或 Claude 主动 `browser_navigate` 重载）

## 关键决策与取舍

### 为什么不让 WXT 自己开浏览器

WXT 的 `webExt` runner 用 `web-ext` 启动 Firefox/Chromium，profile 是临时的，每次 dev 都新建——登录态无法持久化。而且它启动的窗口 Playwright MCP 抓不到（除非 attach CDP，多一层复杂度）。直接让 Playwright MCP 全权管浏览器，链路更短。

### 为什么 `.mcp.json` 不入库

`launchOptions.args` 里的扩展路径是绝对路径（Chrome 要求），换台机器路径就失效。仓库里放一份 `.mcp.json.example` 模板可以；真正生效的 `.mcp.json` 让每个开发者自己生成。

> 备选：用 `${workspaceFolder}` 占位符——但 Playwright MCP 当前不支持变量插值，所以现阶段只能写死。如果未来支持了再迁移。

### 为什么 channel 用 chrome 而非 chromium

- Playwright 自带的 chromium 是 Chromium 主线版，有些扩展 API（如 `chrome.action`）行为可能与正式 Chrome 略有差异
- 我们目标用户跑的就是真 Chrome，用真 Chrome 调试更贴近线上
- 前提：本机已装 Google Chrome（确认 `/Applications/Google Chrome.app/` 存在）

### 为什么扩展路径用绝对路径

Chrome 启动时 `--load-extension` 的相对路径解析以 Chrome 自己的 cwd 为基准（通常是 `/`），不是 Playwright 进程的 cwd。试图传相对路径会导致扩展加载失败且不报错。

## 故障排查清单

| 现象 | 排查 |
|---|---|
| Chrome 启动了但扩展图标不存在 | 检查 `.output/chrome-mv3-dev/manifest.json` 是否存在；`pnpm dev` 是否已完成首次构建 |
| 改了代码扩展没自动 reload | 看 `pnpm dev` 终端是否还在跑、是否报错；扩展的 service worker console 里有无 `[wxt] reloading` 日志 |
| 登录后下次启动又退出 | `.playwright-mcp/chrome-profile/` 是否存在且非空；MCP 配置中 `isolated` 是否真为 `false` |
| Playwright MCP 报 "executable not found" | `npx playwright install chrome` 装一次；或检查 `/Applications/Google Chrome.app/` |
| `.mcp.json` 改了不生效 | 重启 Claude Code（MCP 配置只在会话启动时加载） |

## 不在本次范围

- 自动化登录脚本（涉及验证码/二维码，性价比低，手动登录一次即可）
- Firefox 支持（项目有 `dev:firefox` 但本调试链路只覆盖 Chrome）
- CI 集成（本调试链路是本地开发用，CI 另说）

## 启用须知（每次新机器/首次配置后）

1. 关闭并重新打开 Claude Code（MCP 配置只在会话启动时加载）。重启后 `.mcp.json` 信任弹窗会出现，点信任。
2. 终端 A 运行 `pnpm dev`，等 `Built extension` 出现。
3. 让 Claude `browser_navigate('https://www.douyu.com/')`，弹出的 Chrome 里手动登录斗鱼一次（仅首次需要）。
4. 此后 Claude 可直接 `browser_navigate` 到任意房间、`browser_console_messages` 看日志、`browser_evaluate` 跑 JS。
