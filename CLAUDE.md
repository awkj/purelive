# 沉浸式直播 · PureLive

清理直播 / 录播页面，仅保留播放器与弹幕，替换原生控制栏为自定义玻璃态控制器。

支持两种站点，运行时通过 `location.hostname` 分流（`entrypoints/content/host.ts` 导出 `IS_VOD`）：

- **直播页 `www.douyu.com/<room>`**：完整玻璃态控制器（底部居中：播放/音量/弹幕/画质/模式）。
- **录播页 `v.douyu.com/show/<id>`**：播放器是 `<demand-video>` 自定义元素 + 内置 Shadow DOM，原生控制条直接沿用；扩展只渲染**迷你 ModeButtons**（右上角，始终可见），并清理外围 UI。

## 技术选型

| 层 | 选型 | 原因 |
|---|---|---|
| 框架 | [WXT](https://wxt.dev/) 0.20.x | 浏览器扩展开发框架，支持 Shadow DOM content script、auto-import、HMR |
| UI | React 19 | 控制器组件化，useSyncExternalStore 实现轻量状态管理 |
| 样式 | Tailwind CSS v4 | CSS-first 配置（`@import "tailwindcss"` + `@theme`），无 tailwind.config.js |
| 构建 | Vite 8 + `@tailwindcss/vite` | WXT 内置 Vite，Tailwind 通过 Vite 插件集成 |
| 包管理 | pnpm | workspace 模式 |

## 架构：两层分离

扩展的 CSS 分为两个运行域，**不能合并**：

### 1. 全局页面 CSS（按域名分两份）

注入到斗鱼页面 `<head>` 的 `<style>` 标签，选择器以 `html.pl-active` 为前缀。`global-styles.ts` 是协调入口，按 `IS_VOD` 选择注入哪一份；两份规则的 DOM 完全不同，不能合并：

- **`styles/live.ts` → 直播页**：隐藏原生控制栏（`#js-player-controlbar`、`[class*="ControlBar-"]`）、侧边栏、广告（`[class*="advert__"]`、`[class*="IconCardAdCard"]`）、水印；让 `[class*="stream__"]` / `[class*="video__"]` 铺满视口；居中/网页全屏/真全屏三种模式布局；弹幕（`[class*="danmu"]`、`.DanmuEffectDom`）开关。
- **`styles/vod.ts` → 录播页**：隐藏 `demand-header` / `demand-video-title` / `demand-player-extension` / `demand-video-toolbar` / `demand-video-desc` / `demand-yuba` / `.layout-Aside`；让 `demand-video-app` / `.Layout-Main` / `.layout-Main` 撑满；按 mode 控制 `.Video` 容器尺寸（居中模式用 `aspect-ratio: 16/9` 强制 16:9，避免 `.Video` 比内部视频高、底部留黑栏）。

**这些规则操作的是斗鱼自身的 DOM 元素，必须在宿主页面作用域，不能放进 Shadow DOM。**

### 2. 控制器 UI（React + Tailwind，Shadow DOM 内）

通过 WXT 的 `createShadowRootUi()` 挂载，Tailwind 样式自动注入 Shadow Root，与斗鱼页面样式完全隔离。

## 目录结构

```
entrypoints/
  content/
    index.tsx              # 入口：全局 CSS 注入 + Shadow DOM 挂载 + storage 监听
    state.ts               # 发布/订阅 store（useSyncExternalStore，无外部依赖）
    host.ts                # 导出 IS_VOD = location.hostname === 'v.douyu.com'
    global-styles.ts       # 注入入口：按 IS_VOD 选择 LIVE_CSS / VOD_CSS + applyModeClasses()
    dom-bridge.ts          # 操作直播页真实 DOM（播放、画质、音量、尺寸监听）；录播页全是 no-op
    idle-tracking.ts       # 鼠标闲置 3s 自动隐藏控制栏（绑定在宿主 DOM，非 Shadow DOM）
    components/
      Controller.tsx       # 控制栏根组件；IS_VOD 时只渲染 ModeButtons（右上角，始终可见）
      PlayPauseButton.tsx  # 委托给斗鱼原生按钮 .click()
      VolumeControl.tsx    # 静音按钮 + 垂直滑块（向上弹出）
      DanmakuToggle.tsx    # 弹幕开关
      QualityLabel.tsx     # 当前画质文本
      ModeButtons.tsx      # 居中 / 网页全屏 / 全屏
      Separator.tsx
      icons.tsx            # SVG 图标 React 组件
    hooks/
      useVideoSync.ts      # 监听 <video> 事件同步播放/音量状态
      useAutoQuality.ts    # 自动选最高画质（原画2K60 > 原画 > 蓝光8M > 蓝光4M）
    styles/
      controller.css       # Tailwind v4 入口（@import "tailwindcss" + @theme）
      slider.css           # 垂直音量滑块的自定义样式
      live.ts              # 直播页全局 CSS 字符串（导出 LIVE_CSS）
      vod.ts               # 录播页全局 CSS 字符串（导出 VOD_CSS）
  popup/
    index.html             # Popup 页面
    main.tsx               # Popup 入口
    App.tsx                # 开关 UI（通过 browser.storage.local 与 content script 通信）
    style.css              # Popup Tailwind 样式
  background.ts            # 空，仅满足 manifest 要求
```

## 状态管理

`state.ts` 实现了一个无依赖的发布订阅 store：

- **React 侧**：通过 `useStore()` / `useStoreSelect()` 消费（基于 `useSyncExternalStore`）
- **非 React 侧**：`subscribe()` + `getState()` + `setState()`
- **持久化**：`mode`、`hideBarrage`、`enabled` 存储在 `browser.storage.local`
- **Popup 通信**：Popup 写 storage → content script 监听 `browser.storage.onChanged` → 更新 store

## 开发命令

```bash
pnpm dev          # 开发模式（HMR + 自动重载扩展）
pnpm build        # 生产构建，输出到 .output/chrome-mv3/
pnpm wxt zip      # 打包为 .zip
```

## 截图与调试产物

- 所有截图统一放在项目根的 `screenshots/`，已被 `_gitignore` 忽略
- Playwright MCP 的 `outputDir` 已指向 `screenshots/`（见 `.playwright-mcp/config.json`），默认截图直接落进去
- 调用 `browser_take_screenshot` 时 **不要** 传绝对路径作为 `filename`，只给文件名（如 `vod-fix.png`），让它走 `outputDir`
- 临时调试图也不要放根目录

## 注意事项

### Tailwind CSS v4

- **无 tailwind.config.js**，配置写在 CSS 文件的 `@theme {}` 块中
- 入口为 `@import "tailwindcss"`，不是 v3 的 `@tailwind base/components/utilities`
- 通过 `@tailwindcss/vite` 插件集成，不需要 PostCSS 配置

### Shadow DOM 事件隔离

- `createShadowRootUi` 设置了 `isolateEvents: true`，键盘事件不会冒泡到斗鱼页面
- 鼠标闲置跟踪绑定在 **宿主页面的视频容器** 上（不在 Shadow DOM 内），否则 `pointer-events: none` 会阻止事件触发

### 斗鱼 DOM 交互

- **播放/暂停**：不直接调用 `video.play()`，而是 `.click()` 斗鱼原生按钮（`#js-player-controlbar` 内），因为斗鱼有自己的播放状态管理
- **音量**：直接操作 `video.volume` / `video.muted`
- **画质**：模拟 `mouseenter` 展开下拉 → 找到目标 `<li>` → `.click()`
- **原生控制栏**：CSS 移至屏幕外（保留 DOM 供 `.click()` 委托），不用 `display: none`

### 画面裁剪防治

- 居中模式用 `min()` 计算明确宽高，不依赖 `aspect-ratio`
- `overflow: clip`（非 `hidden`）配合 `border-radius`
- MutationObserver 监听内部容器 `style` 属性变化，强制重置为 `100%`（对抗斗鱼 JS 动态设置像素尺寸）

### WXT autoMount + 锚点同步替换陷阱（必看）

`ui.autoMount()` 处理常规场景下的 anchor 出现/消失。但对斗鱼直播页有一个**致命盲点**：

斗鱼是 Next.js 应用，首次访问时 HTML 里的 `[class*="video__"]` 只是 SSR 骨架占位；JS 加载完 + 流地址拿到后，**React 会销毁骨架节点并 mount 一个全新的真实播放器节点**。两个节点 className 都含 `video__`，但 DOM 对象不同，且 **remove + add 在同一个 microtask 内同步完成**——任何时候 `document.querySelector('[class*="video__"]')` 都查得到"某个 video__"。

WXT autoMount 的 `customMatcher` 就是 `() => document.querySelector(anchor)`，它的 `detector(isNotExist)` 永远不满足 → **不会触发 unmount → host 永远孤悬在已被 detach 的旧骨架里**。
表现：控制栏 mount 上去，过 ~500ms 视频流就绪、播放器重建，控制栏跟着旧骨架被废弃，视觉上"先出现，过一会儿消失"。

为什么刷新看起来"没问题"：JS/CSS/HLS 都在 Chrome disk cache，毫秒级就绪，content script `document_end` 注入时 React 早就 hydrate 完毕，骨架→真节点的替换已经发生过了，content script 一开始就挂在了最终真节点上——bug 一直在，被缓存掩盖。

**修复**：`index.tsx` 在 `ui.autoMount()` 之外加了一个独立 `MutationObserver`（`healIfStale`）。每次 `document.body` 子树变化时：
- 若 `shadowHostEl.isConnected === false` 且 `document.querySelector(anchor)` 仍能查到元素
- 调 `ui.remove()` + `ui.autoMount()` 把 host 重新挂到当前真节点上

不要删这个自愈逻辑——只要斗鱼前端继续用"骨架→替换"模式，它就是必需的。诊断 host 失联时，看 `shadowHost.isConnected`（true/false）配合 `shadowHost.parentElement.className` 才有意义；只看 parentElement 会被骗（detach 的节点 parent 还在）。

### Shadow Root Reset 陷阱

WXT 在 shadow root 内默认注入 `:host { all: initial !important }` 作为 reset。Shadow DOM 的层叠规则规定：**shadow tree 内部的 `!important` 规则胜过 document 的 inline `!important`**。所以从外部用 `shadowHost.style.setProperty('position', 'absolute', 'important')` 设置 host 样式**不会生效**，host 实际 `position: static` + `0×0`。

解决方法：在 shadow root 内**追加一条新的 `:host` 规则**（见 `index.tsx` 的 `onMount`），源码顺序晚于 WXT reset，相同特异性 + 相同 `!important` 时后者胜出。host 的 `display: none / block` 切换也用 `:host([data-pl-hidden])` 配合 attribute，而不是 inline style。

直播页之前没暴露这个 bug，是因为完整控制器用 `fixed bottom-2 left-1/2`（相对视口定位，不依赖 host 是否 positioned）。录播页迷你控制器需要 `absolute top-2 right-2` 定位到 `.Video` 容器内右上角，host 必须 `absolute` 才行，才暴露出问题。

### 录播页与直播页的差异

| 项 | 直播页 (`www.douyu.com`) | 录播页 (`v.douyu.com`) |
|---|---|---|
| 播放器 | 普通 `<video>` + 斗鱼自己的 React 控制层 | `<demand-video>` 自定义元素 + 内置 Shadow DOM，`<video>` 在 shadow root 内访问不到 |
| 控制器 | 完整玻璃态（底部居中，闲置 3s 自动隐藏） | 迷你 ModeButtons（右上角，始终可见，不参与 idle-tracking） |
| `ui.autoMount` 锚点 | `[class*="video__"]` | `.Video` |
| dom-bridge | 实际操作真实 DOM | 全部安全 no-op（`getVideo()` 返回 null 早退） |
| 弹幕开关 | 通过 `[class*="danmu"]` 等 CSS 命中 | 弹幕在 `<demand-player-barrage>` shadow DOM 内，CSS 选择器穿不进去，扩展不显示弹幕开关按钮 |

录播页的设计取舍是**只清外围，沿用 `<demand-video>` 自带控制条**：原生控制条已经很简洁（播放/进度/清晰度/全屏），且 Shadow DOM 内部 API 不稳定，重做成本高收益低。
