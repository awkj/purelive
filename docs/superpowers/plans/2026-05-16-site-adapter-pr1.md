# Site Adapter PR1 实施计划：基础设施 + 斗鱼直播迁移

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 引入 `sites/` adapter 抽象层，把现有斗鱼直播逻辑迁入第一个 adapter（`douyu-live`），验证 adapter 接口设计、capability 模型、site-loader 路由、manifest 自动生成全链路可行。

**Architecture:** 新建 `entrypoints/content/sites/` 目录承载 adapter；`site-loader.ts` 按 URL 选 adapter；`AdapterContext` 通过 React context 把 capabilities 传给组件；组件按 capability 是否存在条件渲染。`dom-bridge.ts` 整个被吸收进 `sites/douyu-live.ts`。

**Tech Stack:** WXT 0.20 + React 19 + TypeScript + Tailwind v4 + Vite 8。无自动化测试基础设施 —— 每个 task 末尾用 WXT dev log（`/tmp/wxt-dev.log`）确认 build 成功，最终任务用 Playwright MCP 跑回归。

**前置条件：** WXT dev server 已启动（`pgrep -fl "wxt dev"` 有进程，端口 3001 被占用）。如果没启动，先 `nohup pnpm dev > /tmp/wxt-dev.log 2>&1 < /dev/null &`。

**PR1 完成后的状态：** 斗鱼直播 `www.douyu.com/*` 行为与重构前**完全一致**。录播页 `v.douyu.com/*` 暂时**扩展不生效**（site-loader 找不到 vod adapter 直接 return），原生页面回归 —— PR2 再恢复。

---

## 文件结构（PR1 范围）

### 新建

| 路径 | 职责 |
|---|---|
| `entrypoints/content/sites/types.ts` | `SiteAdapter` 接口 + 8 个 capability 类型 |
| `entrypoints/content/sites/AdapterContext.tsx` | React context + `useAdapter()` / `useCapabilities()` hook |
| `entrypoints/content/sites/site-loader.ts` | adapter 注册表 + `getCurrentAdapter()` + `getAllMatchPatterns()` |
| `entrypoints/content/sites/douyu-live.ts` | 斗鱼直播 adapter：CSS 字符串 + 所有 capability 实现 |

### 修改

| 路径 | 改动 |
|---|---|
| `entrypoints/content/index.tsx` | 用 `getCurrentAdapter()` 选 adapter，找不到 return；`AdapterContext.Provider` 包裹 Controller；anchor / globalCss 从 adapter 取 |
| `entrypoints/content/global-styles.ts` | `injectGlobalStyles(css: string)` 接受参数；删除 `IS_VOD` import 和选择逻辑 |
| `entrypoints/content/components/Controller.tsx` | 用 `useCapabilities()`；按 caps 是否存在条件渲染各子组件；删除 `IS_VOD` 分支 |
| `entrypoints/content/components/PlayPauseButton.tsx` | 从 capabilities 拿 `playPause.click` 和 `video.getVideo`（不再 import `dom-bridge`） |
| `entrypoints/content/components/VolumeControl.tsx` | 同上，从 capabilities 拿 `volume.set` / `volume.toggleMute` / `video.getVideo` |
| `entrypoints/content/components/DanmakuToggle.tsx` | 不再 import `dom-bridge`；逻辑保持（CSS-driven）但接受 `barrage` capability 作为存在标记 |
| `entrypoints/content/hooks/useVideoSync.ts` | 参数化：接收 `getVideo` 和 `onSync` |
| `entrypoints/content/hooks/useAutoQuality.ts` | 参数化：接收 `quality` capability |
| `entrypoints/content/idle-tracking.ts` | `setupIdleTracking(videoContainer, onCursorHide?)` 接收可选回调代替直接 `import { setCursorHidden }` |
| `wxt.config.ts` | content script `matches` 从 `getAllMatchPatterns()` 生成 |

### 删除

| 路径 | 原因 |
|---|---|
| `entrypoints/content/host.ts` | 被 `site-loader.ts` 取代 |
| `entrypoints/content/dom-bridge.ts` | 函数搬进 `sites/douyu-live.ts.capabilities` |
| `entrypoints/content/styles/live.ts` | CSS 字符串搬进 `sites/douyu-live.ts.globalCss` |

`entrypoints/content/styles/vod.ts` 在 PR1 内**保留**（PR2 再迁），但已经没人 import；保留是为避免 PR2 时漏文件。

---

## Task 1：定义 SiteAdapter 与 capability 类型

**Files:**
- Create: `entrypoints/content/sites/types.ts`

- [ ] **Step 1：写类型定义文件**

写入完整内容：

```ts
// entrypoints/content/sites/types.ts
// Site adapter 抽象层的类型契约。各 capability 都是可选的；adapter 只声明能提供的。

export type VideoCap = {
  getVideo: () => HTMLVideoElement | null;
};

export type PlayPauseCap = {
  click: () => void;
};

export type VolumeCap = {
  set: (v: number) => void;
  toggleMute: () => void;
};

export type QualityCap = {
  read: () => string;
  autoSelect: (preferences: string[]) => void;
};

export type BarrageCap = {
  setHidden: (hidden: boolean) => void;
};

export type FullscreenCap = {
  request: () => void;
  exit: () => void;
};

export type CursorHideCap = {
  setHidden: (hidden: boolean) => void;
};

export type ModeSwitchCap = true;

export interface SiteCapabilities {
  video?: VideoCap;
  playPause?: PlayPauseCap;
  volume?: VolumeCap;
  quality?: QualityCap;
  barrage?: BarrageCap;
  fullscreen?: FullscreenCap;
  cursorHide?: CursorHideCap;
  modeSwitch?: ModeSwitchCap;
}

export interface SiteAdapter {
  id: string;
  match: { hosts: string[]; path?: RegExp };
  globalCss: string;
  anchor: string;
  capabilities: SiteCapabilities;
}
```

- [ ] **Step 2：等 HMR rebuild，确认无 TS error**

```bash
sleep 2 && tail -10 /tmp/wxt-dev.log
```

Expected：output 包含 `✔ Built extension` 不含 `error`。

- [ ] **Step 3：commit（跳过——非 git 仓库）**

项目根目录非 git，跳过 commit。如果是 git 项目则 `git add entrypoints/content/sites/types.ts && git commit -m "feat(sites): add SiteAdapter type definitions"`。

---

## Task 2：建 AdapterContext + hooks

**Files:**
- Create: `entrypoints/content/sites/AdapterContext.tsx`

- [ ] **Step 1：写 context 文件**

```tsx
// entrypoints/content/sites/AdapterContext.tsx
import { createContext, useContext } from 'react';
import type { SiteCapabilities } from './types';

const AdapterContext = createContext<SiteCapabilities | null>(null);

export const AdapterProvider = AdapterContext.Provider;

export function useCapabilities(): SiteCapabilities {
  const caps = useContext(AdapterContext);
  if (!caps) throw new Error('useCapabilities called outside AdapterProvider');
  return caps;
}
```

- [ ] **Step 2：等 HMR rebuild，确认无 TS error**

```bash
sleep 2 && tail -10 /tmp/wxt-dev.log
```

Expected：包含 `✔ Built extension`、无 error。

---

## Task 3：建 site-loader（先不注册任何 adapter）

**Files:**
- Create: `entrypoints/content/sites/site-loader.ts`

- [ ] **Step 1：写 loader 骨架**

```ts
// entrypoints/content/sites/site-loader.ts
import type { SiteAdapter } from './types';

// 注册表 —— 顺序决定匹配优先级（多个 adapter 匹配同一 URL 时第一个胜出）。
// PR1 只注册 douyu-live；PR2 加入 douyu-vod；后续 PR 加虎牙 / B 站等。
const ADAPTERS: SiteAdapter[] = [
  // 注：先留空，Task 4 实现 douyu-live 后再注册
];

export function getCurrentAdapter(): SiteAdapter | null {
  const { hostname, pathname } = location;
  for (const a of ADAPTERS) {
    if (!a.match.hosts.includes(hostname)) continue;
    if (a.match.path && !a.match.path.test(pathname)) continue;
    return a;
  }
  return null;
}

// 构建期 wxt.config.ts 调用此函数生成 manifest matches，避免手动同步。
export function getAllMatchPatterns(): string[] {
  return [...new Set(ADAPTERS.flatMap((a) => a.match.hosts.map((h) => `*://${h}/*`)))];
}
```

- [ ] **Step 2：等 HMR rebuild，确认无 error**

```bash
sleep 2 && tail -10 /tmp/wxt-dev.log
```

Expected：包含 `✔ Built extension`、无 error。

---

## Task 4：让 global-styles.ts 接受 css 参数

**Files:**
- Modify: `entrypoints/content/global-styles.ts`

- [ ] **Step 1：改写文件**

全文替换为：

```ts
// entrypoints/content/global-styles.ts
// 注入入口：实际 CSS 字符串由 adapter 提供，由调用方传入。

import type { DycState } from './state';

const STYLE_ID = 'pl-injected-style';

export function injectGlobalStyles(css: string) {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);
}

export function removeGlobalStyles() {
  document.getElementById(STYLE_ID)?.remove();
}

export function applyModeClasses(s: Pick<DycState, 'mode' | 'hideBarrage' | 'enabled'>) {
  const root = document.documentElement;
  if (s.enabled) {
    root.classList.add('pl-active');
    root.classList.toggle('pl-mode-centered', s.mode === 'centered');
    root.classList.toggle('pl-mode-page', s.mode === 'page');
    root.classList.toggle('pl-mode-fullscreen', s.mode === 'fullscreen');
    root.classList.toggle('pl-hide-barrage', s.hideBarrage);
  } else {
    root.classList.remove(
      'pl-active',
      'pl-mode-centered',
      'pl-mode-page',
      'pl-mode-fullscreen',
      'pl-hide-barrage',
    );
  }
}
```

注意：

- 删除了 `import { IS_VOD } from './host'`
- 删除了 `import { LIVE_CSS } from './styles/live'` 和 `VOD_CSS`
- `injectGlobalStyles` 签名从无参变成接收 `css: string`

- [ ] **Step 2：等 HMR rebuild。会临时报错 —— index.tsx 还在用旧签名调用 injectGlobalStyles()**

```bash
sleep 2 && tail -20 /tmp/wxt-dev.log
```

预期：build 错（Type error: Expected 1 arguments, but got 0）。这是预期的，Task 10 改 index.tsx 后会消失。继续下一个 task，不要回退。

---

## Task 5：建 sites/douyu-live.ts —— 第一个完整 adapter

**Files:**
- Create: `entrypoints/content/sites/douyu-live.ts`

- [ ] **Step 1：把 styles/live.ts 的 CSS 和 dom-bridge.ts 的函数全部搬入新文件**

```ts
// entrypoints/content/sites/douyu-live.ts
// 斗鱼直播站点 adapter。包揽：CSS（原 styles/live.ts）+ 所有 capability 实现（原 dom-bridge.ts）。

import { getState, setState } from '../state';
import type { SiteAdapter } from './types';

const QUALITY_TARGETS = ['原画2K60', '原画', '蓝光8M', '蓝光4M'];

// ─── 视频元素 ─────────────────────────────────────────
function getVideo(): HTMLVideoElement | null {
  return document.querySelector('video');
}

// ─── 播放/暂停（委托原生按钮 .click()，斗鱼有自己的播放状态管理） ───
function clickNativePlayPause() {
  const btn = document.querySelector(
    '#js-player-controlbar [class*="left-"] > i[class*="icon-"]:first-child',
  ) as HTMLElement | null;
  btn?.click();
}

// ─── 音量 ─────────────────────────────────────────────
function setVideoVolume(v: number) {
  const video = getVideo();
  if (!video) return;
  video.volume = v;
  video.muted = v === 0;
}

function toggleMute() {
  const video = getVideo();
  if (!video) return;
  const { volume } = getState();
  if (video.muted || video.volume === 0) {
    video.muted = false;
    video.volume = volume || 0.5;
  } else {
    setState({ volume: video.volume });
    video.muted = true;
  }
}

function syncVideoState() {
  const video = getVideo();
  if (!video) return;
  setState({
    isPlaying: !video.paused,
    volume: video.muted ? getState().volume : video.volume,
    muted: video.muted || video.volume === 0,
  });
}

// ─── 画质 ─────────────────────────────────────────────
function readCurrentQuality(): string {
  const rateEl = document.querySelector('[class*="rate-"]');
  if (!rateEl) return '';
  const textLabel = rateEl.querySelector('[class*="textLabel-"]');
  const selected = rateEl.querySelector('[class*="selected-"]');
  return textLabel?.textContent?.trim() || selected?.textContent?.trim() || '';
}

function autoSelectQuality(preferences: string[], retries = 0) {
  if (retries >= 10) return;
  const rateEl = document.querySelector('[class*="rate-"]');
  if (!rateEl) {
    setTimeout(() => autoSelectQuality(preferences, retries + 1), 1000);
    return;
  }
  const selected = rateEl.querySelector('[class*="selected-"]');
  if (selected?.textContent?.trim() === preferences[0]) {
    const label = readCurrentQuality();
    if (label) setState({ qualityLabel: label });
    return;
  }
  rateEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
  setTimeout(() => {
    const items = Array.from(rateEl.querySelectorAll('li'));
    let picked = false;
    for (const target of preferences) {
      const match = items.find((li) => li.textContent?.trim() === target);
      if (match) {
        (match as HTMLElement).click();
        picked = true;
        setTimeout(() => {
          const label = readCurrentQuality();
          if (label) setState({ qualityLabel: label });
        }, 300);
        break;
      }
    }
    rateEl.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    if (!picked) setTimeout(() => autoSelectQuality(preferences, retries + 1), 2000);
  }, 300);
}

// ─── 全屏 ─────────────────────────────────────────────
function requestFullscreen() {
  document.documentElement.requestFullscreen?.().catch(() => {});
}

function exitFullscreen() {
  document.exitFullscreen?.().catch(() => {});
}

// ─── 鼠标隐藏（idle-tracking 时调用） ─────────────────
function setCursorHidden(hidden: boolean) {
  const vc = document.querySelector('[class*="video__"]');
  vc?.classList.toggle('pl-cursor-hidden', hidden);
}

// ─── 内部容器尺寸监听（对抗斗鱼 JS 动态设像素尺寸） ──
// 注：原 watchInnerDimensions 是 index.tsx 在 state.enabled 时启用的非 capability 逻辑。
// 为不复杂化 adapter 接口，这部分保留在 sites/douyu-live.ts 内导出函数，PR1 由 index.tsx 直接调用。
let dimensionObserver: MutationObserver | null = null;

export function watchInnerDimensions() {
  if (dimensionObserver) return;
  const selectors = ['#__h5player', '#player-control-video', '[class*="video-container-"]'];
  dimensionObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      const el = m.target as HTMLElement;
      if (el.style.width || el.style.height) {
        el.style.setProperty('width', '100%', 'important');
        el.style.setProperty('height', '100%', 'important');
      }
    }
  });
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) dimensionObserver.observe(el, { attributes: true, attributeFilter: ['style'] });
  }
}

export function unwatchInnerDimensions() {
  dimensionObserver?.disconnect();
  dimensionObserver = null;
}

// ─── 全局 CSS（原 styles/live.ts） ────────────────────
const GLOBAL_CSS = `
/* ═══ 隐藏原生控制栏（保留 DOM 供 .click() 调用） ═══ */
html.pl-active #js-player-controlbar,
html.pl-active [class*="ControlBar-"],
html.pl-active [class*="controlbar-"],
html.pl-active [class*="controlBar-"] {
  position: fixed !important;
  left: -9999px !important;
  top: -9999px !important;
  width: 0 !important;
  height: 0 !important;
  overflow: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
  visibility: hidden !important;
}

/* ═══ 鼠标指针 ═══ */
html.pl-active [class*="video__"],
html.pl-active #__h5player,
html.pl-active #player-control-video,
html.pl-active [class*="video-container-"],
html.pl-active [class*="customBc-"] {
  cursor: default !important;
}
html.pl-active [class*="video__"].pl-cursor-hidden,
html.pl-active [class*="video__"].pl-cursor-hidden #__h5player,
html.pl-active [class*="video__"].pl-cursor-hidden #player-control-video,
html.pl-active [class*="video__"].pl-cursor-hidden [class*="video-container-"],
html.pl-active [class*="video__"].pl-cursor-hidden [class*="customBc-"] {
  cursor: none !important;
}

/* ═══ body 级清理：只留 main ═══ */
html.pl-active > body > *:not(main):not(script):not(style):not(link):not(svg) {
  display: none !important;
}

/* ═══ #root 内清理 ═══ */
html.pl-active [class*="wm-general"] { display: none !important; }
html.pl-active [class*="bc-wrapper"] { display: none !important; }

/* ═══ playerWrap 内 ═══ */
html.pl-active [class*="playerBackgroundBlur"],
html.pl-active [class*="playerBackground__"],
html.pl-active [class*="snapbar__"],
html.pl-active #js-account-security,
html.pl-active #js-super-menu { display: none !important; }

/* ═══ player 内：隐藏信息栏 + 互动栏 + 侧边栏 ═══ */
html.pl-active [class*="title__"][class*="info__"] { display: none !important; }
html.pl-active [class*="interactive__"] { display: none !important; }
html.pl-active [class*="sidebar__"] { display: none !important; }

/* ═══ 视频内叠加物 ═══ */
html.pl-active .player-dialog > * { display: none !important; }
html.pl-active .VRTips,
html.pl-active .EffectPlayerDom,
html.pl-active .XinghaiAd,
html.pl-active [class*="advert__"],
html.pl-active [class*="IconCardAdCard"],
html.pl-active .PIPAdLayer,
html.pl-active .roomSmallPlayerFloatLayout,
html.pl-active .room-Player-Box.is-smallDangling,
html.pl-active [class*="buff__"],
html.pl-active [class*="watermark-"] { display: none !important; }

/* ═══ 播放器铺满 ═══ */
html.pl-active,
html.pl-active body {
  overflow: hidden !important;
  background: #000 !important;
  margin: 0 !important;
  padding: 0 !important;
  width: 100% !important;
  height: 100% !important;
}
html.pl-active main,
html.pl-active #root,
html.pl-active [class*="playerWrap__"] {
  width: 100% !important;
  height: 100% !important;
  max-width: none !important;
  padding: 0 !important;
  margin: 0 !important;
  background: #000 !important;
}
html.pl-active [class*="playerWrap__"] { background-image: none !important; }
html.pl-active [class*="stage__"],
html.pl-active #js-player-main,
html.pl-active #js-player-main > [class*="player__"] {
  width: 100% !important;
  height: 100% !important;
  max-width: none !important;
  padding: 0 !important;
  margin: 0 !important;
}
html.pl-active [class*="stream__"],
html.pl-active [class*="video__"] {
  position: relative !important;
  width: 100% !important;
  height: 100% !important;
  max-width: none !important;
  max-height: none !important;
  padding: 0 !important;
  margin: 0 !important;
}
html.pl-active #js-player-video-case,
html.pl-active #js-player-video {
  width: 100% !important;
  height: 100% !important;
}
html.pl-active #js-player-video > [class*="container__"] {
  width: 100% !important;
  height: 100% !important;
}
html.pl-active #js-player-video > [class*="container__"] > [class*="player__"],
html.pl-active #js-player-multiContainer,
html.pl-active #__video_container {
  width: 100% !important;
  height: 100% !important;
}
html.pl-active #__h5player,
html.pl-active #player-control-video,
html.pl-active [class*="video-container-"] {
  width: 100% !important;
  height: 100% !important;
  transform: none !important;
}
html.pl-active video {
  width: 100% !important;
  height: 100% !important;
  object-fit: contain !important;
  max-width: none !important;
  max-height: none !important;
}

/* ═══ 居中窗口模式 ═══ */
html.pl-mode-centered [class*="stream__"] {
  position: fixed !important;
  top: 50% !important;
  left: 50% !important;
  transform: translate(-50%, -50%) !important;
  width: min(90vw, calc(90vh * 16 / 9)) !important;
  height: min(90vh, calc(90vw * 9 / 16)) !important;
  max-width: min(90vw, 1280px) !important;
  max-height: 90vh !important;
  z-index: 2147483646 !important;
  background: #000 !important;
  border: none !important;
  box-shadow: 0 0 60px 10px rgba(255,255,255,0.04), 0 0 120px 30px rgba(255,255,255,0.02), 0 4px 30px rgba(0,0,0,0.6) !important;
  overflow: clip !important;
}
html.pl-mode-centered [class*="video__"],
html.pl-mode-centered #js-player-video-case,
html.pl-mode-centered #js-player-video,
html.pl-mode-centered #js-player-video > [class*="container__"],
html.pl-mode-centered #js-player-video > [class*="container__"] > [class*="player__"],
html.pl-mode-centered #__h5player,
html.pl-mode-centered #player-control-video,
html.pl-mode-centered [class*="video-container-"],
html.pl-mode-centered #js-player-multiContainer,
html.pl-mode-centered #__video_container {
  width: 100% !important;
  height: 100% !important;
  max-width: 100% !important;
  max-height: 100% !important;
  transform: none !important;
}

/* ═══ 网页全屏 / 真全屏 ═══ */
html.pl-mode-page [class*="stream__"],
html.pl-mode-fullscreen [class*="stream__"] {
  position: fixed !important;
  inset: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  z-index: 2147483646 !important;
  background: #000 !important;
}

/* ═══ 弹幕隐藏 ═══ */
html.pl-hide-barrage [class*="comment-"],
html.pl-hide-barrage .DanmuEffectDom,
html.pl-hide-barrage [class*="danmu"] {
  display: none !important;
}
`;

// ─── Adapter 定义 ─────────────────────────────────────
export const DOUYU_LIVE: SiteAdapter = {
  id: 'douyu-live',
  match: { hosts: ['www.douyu.com'] },
  globalCss: GLOBAL_CSS,
  anchor: '[class*="video__"]',
  capabilities: {
    video: { getVideo },
    playPause: {
      click: () => {
        clickNativePlayPause();
        setTimeout(syncVideoState, 150);
      },
    },
    volume: { set: setVideoVolume, toggleMute },
    quality: { read: readCurrentQuality, autoSelect: autoSelectQuality },
    barrage: {
      // 弹幕实际由 globalCss + applyModeClasses 的 .pl-hide-barrage 类驱动，
      // 此处提供 setHidden 让 Controller 能调用（实现就是写 store，DanmakuToggle 已经这么做）。
      setHidden: (hidden) => setState({ hideBarrage: hidden }),
    },
    fullscreen: { request: requestFullscreen, exit: exitFullscreen },
    cursorHide: { setHidden: setCursorHidden },
    modeSwitch: true,
  },
};
```

- [ ] **Step 2：等 HMR rebuild**

```bash
sleep 3 && tail -15 /tmp/wxt-dev.log
```

Expected：`✔ Built extension` 没有新的 error（之前 Task 4 留下的 injectGlobalStyles 旧调用错仍在，是已知的，Task 10 会修）。

---

## Task 6：把 douyu-live 注册到 site-loader

**Files:**
- Modify: `entrypoints/content/sites/site-loader.ts`

- [ ] **Step 1：在文件顶部加 import，更新 ADAPTERS**

替换原 `ADAPTERS` 那一行：

```ts
import type { SiteAdapter } from './types';
import { DOUYU_LIVE } from './douyu-live';

const ADAPTERS: SiteAdapter[] = [DOUYU_LIVE];
```

完整文件最终内容：

```ts
// entrypoints/content/sites/site-loader.ts
import type { SiteAdapter } from './types';
import { DOUYU_LIVE } from './douyu-live';

const ADAPTERS: SiteAdapter[] = [DOUYU_LIVE];

export function getCurrentAdapter(): SiteAdapter | null {
  const { hostname, pathname } = location;
  for (const a of ADAPTERS) {
    if (!a.match.hosts.includes(hostname)) continue;
    if (a.match.path && !a.match.path.test(pathname)) continue;
    return a;
  }
  return null;
}

export function getAllMatchPatterns(): string[] {
  return [...new Set(ADAPTERS.flatMap((a) => a.match.hosts.map((h) => `*://${h}/*`)))];
}
```

- [ ] **Step 2：等 HMR rebuild**

```bash
sleep 2 && tail -10 /tmp/wxt-dev.log
```

Expected：`✔ Built extension`，无新 error。

---

## Task 7：改写 useVideoSync 参数化

**Files:**
- Modify: `entrypoints/content/hooks/useVideoSync.ts`

- [ ] **Step 1：全文替换**

```ts
// entrypoints/content/hooks/useVideoSync.ts
import { useEffect } from 'react';
import type { VideoCap } from '../sites/types';

export function useVideoSync(
  video: VideoCap | undefined,
  onSync: (() => void) | undefined,
) {
  useEffect(() => {
    if (!video || !onSync) return;
    let el: HTMLVideoElement | null = null;
    let retryTimer: number;

    function bind() {
      el = video!.getVideo();
      if (!el) {
        retryTimer = window.setTimeout(bind, 1000);
        return;
      }
      el.addEventListener('play', onSync!);
      el.addEventListener('pause', onSync!);
      el.addEventListener('playing', onSync!);
      el.addEventListener('volumechange', onSync!);
      onSync!();
    }

    bind();

    return () => {
      clearTimeout(retryTimer);
      if (el) {
        el.removeEventListener('play', onSync!);
        el.removeEventListener('pause', onSync!);
        el.removeEventListener('playing', onSync!);
        el.removeEventListener('volumechange', onSync!);
      }
    };
  }, [video, onSync]);
}
```

注意：

- `syncVideoState` 从 `dom-bridge` import 已删除；改为由调用方（Controller）传入 `onSync` 回调。Controller 会传入一个调用 `getVideo()` 后写 store 的函数（见 Task 12）。
- 实际上 `syncVideoState` 的内部逻辑（读 video.paused/volume/muted 写 store）跟 capability 无关，可以在 Controller 内直接定义。

- [ ] **Step 2：等 HMR rebuild**

```bash
sleep 2 && tail -10 /tmp/wxt-dev.log
```

Expected：build 仍可能报错（Controller 还在用旧签名）。Task 12 修。

---

## Task 8：改写 useAutoQuality 参数化

**Files:**
- Modify: `entrypoints/content/hooks/useAutoQuality.ts`

- [ ] **Step 1：全文替换**

```ts
// entrypoints/content/hooks/useAutoQuality.ts
import { useEffect } from 'react';
import { getState, setState } from '../state';
import type { QualityCap } from '../sites/types';

const PREFERENCES = ['原画2K60', '原画', '蓝光8M', '蓝光4M'];

export function useAutoQuality(quality: QualityCap | undefined) {
  useEffect(() => {
    if (!quality) return;
    if (!getState().enabled) return;

    const startTimer = setTimeout(() => quality.autoSelect(PREFERENCES), 500);

    const pollTimer = setInterval(() => {
      const label = quality.read();
      if (label) setState({ qualityLabel: label });
    }, 3000);

    return () => {
      clearTimeout(startTimer);
      clearInterval(pollTimer);
    };
  }, [quality]);
}
```

- [ ] **Step 2：等 HMR rebuild**

```bash
sleep 2 && tail -10 /tmp/wxt-dev.log
```

Expected：build 错（Controller 还没改）。继续。

---

## Task 9：改写 PlayPauseButton 用 props 取 capability

**Files:**
- Modify: `entrypoints/content/components/PlayPauseButton.tsx`

- [ ] **Step 1：全文替换**

```tsx
// entrypoints/content/components/PlayPauseButton.tsx
import { useStoreSelect } from '../state';
import type { PlayPauseCap } from '../sites/types';
import { IconPlay, IconPause } from './icons';

interface Props {
  cap: PlayPauseCap;
  disabled?: boolean;
}

export default function PlayPauseButton({ cap, disabled }: Props) {
  const isPlaying = useStoreSelect((s) => s.isPlaying);

  return (
    <button
      onClick={() => cap.click()}
      disabled={disabled}
      title="播放/暂停"
      className="inline-flex items-center justify-center w-[38px] h-[38px] rounded-[10px] text-white/88 cursor-pointer transition-all duration-150 shrink-0 hover:bg-white/10 hover:text-white active:scale-92 disabled:opacity-30 disabled:pointer-events-none"
    >
      {isPlaying ? <IconPause /> : <IconPlay />}
    </button>
  );
}
```

注意：

- 原本 `clickNativePlayPause(); setTimeout(syncVideoState, 150)` 的 150ms 延迟同步逻辑已经被吸收进 `DOUYU_LIVE.capabilities.playPause.click`（Task 5 step 1）。组件这边只调 cap.click 就行。

- [ ] **Step 2：等 HMR rebuild**

```bash
sleep 2 && tail -10 /tmp/wxt-dev.log
```

Expected：build 错（Controller 还没传 cap）。

---

## Task 10：改写 VolumeControl 用 props 取 capability

**Files:**
- Modify: `entrypoints/content/components/VolumeControl.tsx`

- [ ] **Step 1：全文替换**

```tsx
// entrypoints/content/components/VolumeControl.tsx
import { useStoreSelect } from '../state';
import type { VolumeCap } from '../sites/types';
import { IconVolHigh, IconVolLow, IconVolMute } from './icons';

interface Props {
  cap: VolumeCap;
  onSync: () => void;       // 改动后立即同步 store
  disabled?: boolean;
}

export default function VolumeControl({ cap, onSync, disabled }: Props) {
  const volume = useStoreSelect((s) => s.volume);
  const muted = useStoreSelect((s) => s.muted);

  const displayVol = muted ? 0 : volume;
  const Icon = muted ? IconVolMute : volume < 0.5 ? IconVolLow : IconVolHigh;

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value) / 100;
    cap.set(v);
    onSync();
  };

  return (
    <div className="relative flex items-center group">
      <button
        onClick={() => { cap.toggleMute(); onSync(); }}
        disabled={disabled}
        title={muted ? '取消静音' : '静音'}
        className={`inline-flex items-center justify-center w-[38px] h-[38px] rounded-[10px] cursor-pointer transition-all duration-150 shrink-0 hover:bg-white/10 hover:text-white active:scale-92 disabled:opacity-30 disabled:pointer-events-none ${muted ? 'text-white/50' : 'text-white/88'}`}
      >
        <Icon />
      </button>

      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all duration-200 z-10">
        <div className="flex flex-col items-center bg-[rgba(20,20,20,0.85)] backdrop-blur-[24px] rounded-xl p-2.5 border border-white/6 shadow-[0_8px_32px_rgba(0,0,0,0.45)]">
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(displayVol * 100)}
            onChange={handleSlider}
            onClick={(e) => e.stopPropagation()}
            className="pl-vslider"
          />
          <span className="text-[11px] text-white/50 mt-1.5 font-medium tabular-nums">
            {Math.round(displayVol * 100)}
          </span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2：等 HMR rebuild**

```bash
sleep 2 && tail -10 /tmp/wxt-dev.log
```

Expected：build 错（Controller 没传 props）。

---

## Task 11：改写 DanmakuToggle（移除 dom-bridge import）

**Files:**
- Modify: `entrypoints/content/components/DanmakuToggle.tsx`

- [ ] **Step 1：检查现有文件**

DanmakuToggle 当前没有 import `dom-bridge`（已确认），逻辑全靠 setState 触发 CSS class —— 不需要任何 capability 调用。但 Controller 要根据 `caps.barrage` 是否存在决定渲染，所以 props 接口要标记。

为对齐"capability-driven 渲染"的设计原则，给组件加一个空 props 类型即可（不用真正传 cap，因为它不需要调用 cap.setHidden —— setState 直接做了相同的事）。

```tsx
// entrypoints/content/components/DanmakuToggle.tsx
import { useStoreSelect, setState } from '../state';
import { IconDanmakuOn, IconDanmakuOff } from './icons';

interface Props {
  disabled?: boolean;
}

export default function DanmakuToggle({ disabled }: Props) {
  const hideBarrage = useStoreSelect((s) => s.hideBarrage);

  return (
    <button
      onClick={() => setState({ hideBarrage: !hideBarrage })}
      disabled={disabled}
      title="弹幕"
      className={`inline-flex items-center justify-center w-[38px] h-[38px] rounded-[10px] cursor-pointer transition-all duration-150 shrink-0 hover:bg-white/10 hover:text-white active:scale-92 disabled:opacity-30 disabled:pointer-events-none ${hideBarrage ? 'text-white/50' : 'text-white/88'}`}
    >
      {hideBarrage ? <IconDanmakuOff /> : <IconDanmakuOn />}
    </button>
  );
}
```

实际上和现有文件几乎一致 —— 只是加了 Props interface 让类型更明确。

- [ ] **Step 2：等 HMR rebuild**

```bash
sleep 2 && tail -10 /tmp/wxt-dev.log
```

Expected：仍有 Controller 相关的 error。

---

## Task 12：改写 Controller 用 useCapabilities 条件渲染

**Files:**
- Modify: `entrypoints/content/components/Controller.tsx`

- [ ] **Step 1：全文替换**

```tsx
// entrypoints/content/components/Controller.tsx
import { useCallback } from 'react';
import { useStore, getState, setState } from '../state';
import { useVideoSync } from '../hooks/useVideoSync';
import { useAutoQuality } from '../hooks/useAutoQuality';
import { markBarHover } from '../idle-tracking';
import { useCapabilities } from '../sites/AdapterContext';
import PlayPauseButton from './PlayPauseButton';
import VolumeControl from './VolumeControl';
import DanmakuToggle from './DanmakuToggle';
import QualityLabel from './QualityLabel';
import ModeButtons from './ModeButtons';
import Separator from './Separator';

const GLASS_BAR =
  "flex items-center gap-0.5 py-1.5 px-2.5 rounded-[14px] bg-[rgba(20,20,20,0.7)] backdrop-blur-[24px] saturate-200 border border-white/6 shadow-[0_8px_32px_rgba(0,0,0,0.45),inset_0_0.5px_0_rgba(255,255,255,0.06)] select-none font-[-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,sans-serif] transition-opacity duration-300 z-[2147483647]";

export default function Controller() {
  const { enabled, isIdle } = useStore();
  const caps = useCapabilities();

  // 把 video 同步逻辑（读 video 写 store）就近定义，避免循环依赖。
  const syncVideoState = useCallback(() => {
    if (!caps.video) return;
    const v = caps.video.getVideo();
    if (!v) return;
    setState({
      isPlaying: !v.paused,
      volume: v.muted ? getState().volume : v.volume,
      muted: v.muted || v.volume === 0,
    });
  }, [caps.video]);

  useVideoSync(caps.video, syncVideoState);
  useAutoQuality(caps.quality);

  if (!enabled) return null;

  const fade = isIdle ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto';

  // 形态判断：没有任何"播放控制"类 capability 但有 modeSwitch → 迷你形态（右上角，始终可见）
  const hasPlaybackControls = caps.playPause || caps.volume || caps.quality || caps.barrage;
  const isMini = !hasPlaybackControls && caps.modeSwitch;

  if (isMini) {
    return (
      <div className={`absolute top-2 right-2 ${GLASS_BAR} opacity-100 pointer-events-auto`}>
        <ModeButtons />
      </div>
    );
  }

  return (
    <div
      className={`fixed bottom-2 left-1/2 -translate-x-1/2 ${GLASS_BAR} ${fade}`}
      onMouseEnter={() => markBarHover(true)}
      onMouseLeave={() => markBarHover(false)}
    >
      {caps.playPause && <PlayPauseButton cap={caps.playPause} />}
      {caps.volume && <VolumeControl cap={caps.volume} onSync={syncVideoState} />}
      {caps.barrage && <DanmakuToggle />}
      {(caps.quality || caps.modeSwitch) && <Separator />}
      {caps.quality && <QualityLabel />}
      {caps.modeSwitch && <ModeButtons />}
    </div>
  );
}
```

注意：

- 删除 `import { IS_VOD } from '../host'`
- 录播页的"迷你形态"分支由 capability 缺失自动驱动（不再依赖 IS_VOD）
- `<ModeButtons />` 用到的 `requestFullscreen` / `exitFullscreen` 仍然 import 自 dom-bridge —— 但 dom-bridge 在 Task 14 才删。Step 1 后这个 import 仍是合法的；Task 14 改 ModeButtons 用 capability。

啊，等等 —— ModeButtons.tsx 现在 import `{ requestFullscreen, exitFullscreen } from '../dom-bridge'`。这一行在 Task 14 删 dom-bridge 时会断。让我把 ModeButtons 也加入此次重构。

- [ ] **Step 2：改 ModeButtons.tsx 用 capability**

```tsx
// entrypoints/content/components/ModeButtons.tsx
import { useStoreSelect, setState, type Mode } from '../state';
import { useCapabilities } from '../sites/AdapterContext';
import { IconCentered, IconPageFs, IconFullscreen } from './icons';
import Tooltip from './Tooltip';

const modes: { key: Mode; icon: React.ReactNode; label: string }[] = [
  { key: 'centered', icon: <IconCentered />, label: '居中' },
  { key: 'page', icon: <IconPageFs />, label: '网页全屏' },
  { key: 'fullscreen', icon: <IconFullscreen />, label: '全屏' },
];

export default function ModeButtons() {
  const current = useStoreSelect((s) => s.mode);
  const { fullscreen } = useCapabilities();

  const setMode = (target: Mode) => {
    if (current === 'fullscreen') fullscreen?.exit();
    setState({ mode: target });
    if (target === 'fullscreen') fullscreen?.request();
  };

  return (
    <>
      {modes.map(({ key, icon, label }) => (
        <Tooltip key={key} label={label}>
          <button
            onClick={() => setMode(key)}
            className={`inline-flex items-center justify-center w-[38px] h-[38px] rounded-[10px] cursor-pointer transition-all duration-150 shrink-0 hover:bg-white/10 hover:text-white active:scale-92 ${current === key ? 'text-[#3ea6ff]' : 'text-white/88'}`}
          >
            {icon}
          </button>
        </Tooltip>
      ))}
    </>
  );
}
```

`fullscreen?.exit()` / `fullscreen?.request()` 用可选链 —— 如果 adapter 没声明 fullscreen，按 page 模式处理（不调浏览器 API）。

- [ ] **Step 3：等 HMR rebuild**

```bash
sleep 2 && tail -10 /tmp/wxt-dev.log
```

Expected：build 错（index.tsx 还在 import dom-bridge / host）。

---

## Task 13：改写 idle-tracking 不再 import dom-bridge

**Files:**
- Modify: `entrypoints/content/idle-tracking.ts`

- [ ] **Step 1：全文替换**

```ts
// entrypoints/content/idle-tracking.ts
import { getState, setState } from './state';

const IDLE_TIMEOUT = 3000;
let timer: number | undefined;
let barHovered = false;
let cursorHideCallback: ((hidden: boolean) => void) | undefined;

function show() {
  if (!getState().enabled) return;
  setState({ isIdle: false });
  cursorHideCallback?.(false);
}

function hide() {
  if (barHovered) return;
  setState({ isIdle: true });
  cursorHideCallback?.(true);
}

function resetTimer() {
  if (timer) clearTimeout(timer);
  timer = window.setTimeout(hide, IDLE_TIMEOUT);
}

export function markBarHover(hovered: boolean) {
  barHovered = hovered;
  if (hovered) {
    if (timer) clearTimeout(timer);
  } else {
    resetTimer();
  }
}

export function setupIdleTracking(
  videoContainer: Element,
  onCursorHide?: (hidden: boolean) => void,
) {
  cursorHideCallback = onCursorHide;

  videoContainer.addEventListener('mousemove', () => {
    show();
    resetTimer();
  });
  videoContainer.addEventListener('mouseenter', () => {
    show();
    resetTimer();
  });
  videoContainer.addEventListener('mouseleave', () => {
    if (timer) clearTimeout(timer);
    hide();
  });
}

export function teardownIdleTracking() {
  if (timer) clearTimeout(timer);
  cursorHideCallback = undefined;
}
```

注意：用模块级变量 `cursorHideCallback` 承接 capability（最近一次 setup 的覆盖前一次，符合单页单 adapter 模型）。

- [ ] **Step 2：等 HMR rebuild**

```bash
sleep 2 && tail -10 /tmp/wxt-dev.log
```

Expected：仍报错，但 idle-tracking 自身错应已消失。

---

## Task 14：改写 index.tsx 集成 site-loader + AdapterProvider

**Files:**
- Modify: `entrypoints/content/index.tsx`

- [ ] **Step 1：全文替换**

```tsx
// entrypoints/content/index.tsx
import ReactDOM from 'react-dom/client';
import { injectGlobalStyles, applyModeClasses } from './global-styles';
import { getState, setState, subscribe, loadPersistedState, persistState } from './state';
import { setupIdleTracking } from './idle-tracking';
import { getCurrentAdapter } from './sites/site-loader';
import { AdapterProvider } from './sites/AdapterContext';
import { watchInnerDimensions, unwatchInnerDimensions } from './sites/douyu-live';
import Controller from './components/Controller';
import './styles/controller.css';

export default defineContentScript({
  matches: ['*://*.douyu.com/*'],  // Task 15 改为从 site-loader 生成
  runAt: 'document_end',
  cssInjectionMode: 'ui',

  async main(ctx) {
    const adapter = getCurrentAdapter();
    if (!adapter) return;   // 没匹配的 adapter（如 PR1 后的 v.douyu.com）—— 不注入

    injectGlobalStyles(adapter.globalCss);
    await loadPersistedState();
    applyModeClasses(getState());
    if (getState().enabled && adapter.id === 'douyu-live') watchInnerDimensions();

    let shadowHostEl: HTMLElement | null = null;

    function syncShadowHostVisibility() {
      if (!shadowHostEl) return;
      const { enabled } = getState();
      if (enabled) shadowHostEl.removeAttribute('data-pl-hidden');
      else shadowHostEl.setAttribute('data-pl-hidden', '');
    }

    subscribe(() => {
      const s = getState();
      applyModeClasses(s);
      persistState();
      if (s.enabled && adapter.id === 'douyu-live') {
        watchInnerDimensions();
      } else {
        unwatchInnerDimensions();
      }
      syncShadowHostVisibility();
    });

    browser.storage.onChanged.addListener((changes) => {
      if (changes.enabled) {
        setState({ enabled: changes.enabled.newValue !== false });
      }
    });

    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && getState().mode === 'fullscreen') {
        setState({ mode: 'centered' });
      }
    });

    const ui = await createShadowRootUi(ctx, {
      name: 'pl-controller',
      position: 'inline',
      anchor: adapter.anchor,
      isolateEvents: true,
      onMount(container, _shadow, shadowHost) {
        shadowHostEl = shadowHost;

        // 见 docs/superpowers/specs/2026-05-16-site-adapter-design.md 「Shadow Root Reset 陷阱」
        const hostStyle = document.createElement('style');
        hostStyle.textContent = `
          :host {
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
            height: 100% !important;
            pointer-events: none !important;
            z-index: 2147483647 !important;
            display: block !important;
          }
          :host([data-pl-hidden]) { display: none !important; }
        `;
        _shadow.appendChild(hostStyle);

        container.style.width = '100%';
        container.style.height = '100%';

        syncShadowHostVisibility();

        const videoContainer = shadowHost.parentElement;
        if (videoContainer) {
          setupIdleTracking(videoContainer, adapter.capabilities.cursorHide?.setHidden);
        }

        const root = ReactDOM.createRoot(container);
        root.render(
          <AdapterProvider value={adapter.capabilities}>
            <Controller />
          </AdapterProvider>,
        );
        return root;
      },
      onRemove(root) {
        shadowHostEl = null;
        root?.unmount();
      },
    });

    ui.autoMount();
  },
});
```

注意：

- `watchInnerDimensions` / `unwatchInnerDimensions` 现在从 `sites/douyu-live.ts` 导出（Task 5 已经导出）。仅在 douyu-live 启用时调用。
- `setupIdleTracking` 第二个参数传 `adapter.capabilities.cursorHide?.setHidden`。adapter 没声明 cursorHide 时为 undefined，idle-tracking 内做了 `?.()` 防御。

- [ ] **Step 2：等 HMR rebuild**

```bash
sleep 2 && tail -15 /tmp/wxt-dev.log
```

Expected：`✔ Built extension`，无 error。从这里开始项目应该重新可编译。

---

## Task 15：让 wxt.config.ts 的 matches 从 site-loader 生成

**Files:**
- Modify: `wxt.config.ts`

- [ ] **Step 1：改写**

```ts
// wxt.config.ts
import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import { getAllMatchPatterns } from './entrypoints/content/sites/site-loader';

const patterns = getAllMatchPatterns();

export default defineConfig({
  manifest: {
    name: '沉浸式直播 · PureLive',
    description: '清理斗鱼直播页面，仅保留播放器与弹幕，支持居中 / 网页全屏 / 真正全屏。',
    permissions: ['storage'],
    host_permissions: patterns,
    action: {},
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  webExt: { disabled: true },
});
```

注意：

- `host_permissions` 用 `patterns`。content script 的 `matches`（写在 `defineContentScript` 内）仍然是 hardcoded `'*://*.douyu.com/*'` —— content script 配置是运行期 WXT 自动管理 的，build 时会读 `defineContentScript({ matches })` 注入 manifest。要让 content script matches 也走 patterns，要在 entry 文件里 import getAllMatchPatterns —— 但 entry 在浏览器侧运行，import wxt.config 的依赖路径不通。
- 折中：content script `matches` 仍然 hardcoded（PR1 内是 `'*://*.douyu.com/*'`，PR2+ 加新站点时再扩），host_permissions 从 site-loader 生成。两者必须保持兼容（matches ⊆ host_permissions）。PR2 时 v.douyu.com 加入 site-loader 自动出现在 host_permissions 中；content script 的 matches 仍是 `'*://*.douyu.com/*'` 同时覆盖直播录播，OK。新增虎牙时 content script matches 改为 `['*://*.douyu.com/*', '*://*.huya.com/*']` 同步加。

- [ ] **Step 2：改 entrypoints/content/index.tsx 的 matches**

仍然先用 hardcoded：

```ts
defineContentScript({
  matches: ['*://*.douyu.com/*'],
  ...
})
```

这一步不需要再编辑（Task 14 已经是这个值）。仅记录该限制：matches 在 PR2+ 接入新 host 时要手动加。

- [ ] **Step 3：等 HMR rebuild**

```bash
sleep 3 && tail -20 /tmp/wxt-dev.log
```

Expected：`✔ Built extension`，无 error。manifest.json 输出中 `host_permissions` 应为 `["*://www.douyu.com/*"]`。

- [ ] **Step 4：验证 manifest 内容**

```bash
cat /Users/doctor/Developer/personal/awkj/purelive/.output/chrome-mv3-dev/manifest.json | python3 -c "import json,sys; m=json.load(sys.stdin); print('host_permissions:', m['host_permissions']); print('content_scripts matches:', [cs.get('matches') for cs in m.get('content_scripts', [])])"
```

Expected：`host_permissions: ['*://www.douyu.com/*']`。

---

## Task 16：删除老文件

**Files:**
- Delete: `entrypoints/content/host.ts`
- Delete: `entrypoints/content/dom-bridge.ts`
- Delete: `entrypoints/content/styles/live.ts`

- [ ] **Step 1：删除三个文件**

```bash
rm /Users/doctor/Developer/personal/awkj/purelive/entrypoints/content/host.ts
rm /Users/doctor/Developer/personal/awkj/purelive/entrypoints/content/dom-bridge.ts
rm /Users/doctor/Developer/personal/awkj/purelive/entrypoints/content/styles/live.ts
```

`styles/vod.ts` **保留**（PR2 才用上）。

- [ ] **Step 2：等 HMR rebuild**

```bash
sleep 3 && tail -15 /tmp/wxt-dev.log
```

Expected：`✔ Built extension`，无 error。如果有 "Cannot find module" 类报错，说明某个文件还在 import 已删除文件，需要回查。

- [ ] **Step 3：grep 残留 import**

```bash
cd /Users/doctor/Developer/personal/awkj/purelive && grep -rn "from.*dom-bridge\|from.*\./host\|from.*styles/live" entrypoints/ 2>&1
```

Expected：空输出（grep 返回 1）。如果有匹配，说明漏改了文件。

---

## Task 17：Playwright MCP 验收测试 - 斗鱼直播

**前置**：WXT dev 运行中，Playwright MCP 持久 Chrome 已加载扩展。

- [ ] **Step 1：navigate 到直播页**

调用 `mcp__playwright__browser_navigate` 到 `https://www.douyu.com/9999`。等 4 秒 SPA 落定。

- [ ] **Step 2：验证全局 CSS 注入 + pl-active 类**

调用 `mcp__playwright__browser_evaluate`：

```js
() => ({
  htmlClasses: document.documentElement.className,
  styleInjected: !!document.getElementById('pl-injected-style'),
  controlbarLeft: getComputedStyle(document.querySelector('#js-player-controlbar')).left,
  shadowHostExists: !!document.querySelector('pl-controller'),
})
```

Expected：

- `htmlClasses` 包含 `pl-active pl-mode-centered`
- `styleInjected: true`
- `controlbarLeft: '-9999px'`
- `shadowHostExists: true`

- [ ] **Step 3：验证控制器渲染了所有按钮（完整玻璃态形态）**

调用 `mcp__playwright__browser_evaluate`：

```js
() => {
  const host = document.querySelector('pl-controller');
  const buttons = host?.shadowRoot?.querySelectorAll('button');
  return { buttonCount: buttons?.length, titles: Array.from(buttons || []).map(b => b.getAttribute('title')) };
}
```

Expected：`buttonCount >= 6`（1 播放 + 1 静音 + 1 弹幕 + 3 模式 = 至少 6）。titles 应该包含 `'播放/暂停'`, `'静音'`/`'取消静音'`, `'弹幕'`, `'居中'`, `'网页全屏'`, `'全屏'`。

- [ ] **Step 4：测播放/暂停**

调用 `mcp__playwright__browser_evaluate` 取 video 当前 paused 状态；点击 PlayPauseButton（shadow root 内第一个 button）；等 300ms；再读 paused —— 状态应该反转。

```js
() => {
  const host = document.querySelector('pl-controller');
  const btn = host?.shadowRoot?.querySelectorAll('button')[0];
  const v0 = document.querySelector('video');
  const before = v0?.paused;
  btn?.click();
  return new Promise(r => setTimeout(() => {
    r({ before, after: document.querySelector('video')?.paused });
  }, 400));
}
```

Expected：`before !== after`。

- [ ] **Step 5：测 mode 切换**

```js
() => {
  const host = document.querySelector('pl-controller');
  const btns = Array.from(host.shadowRoot.querySelectorAll('button'));
  const pageBtn = btns.find(b => b.getAttribute('title') === '网页全屏');
  pageBtn.click();
  return new Promise(r => requestAnimationFrame(() => {
    r({
      classes: document.documentElement.className,
      streamRect: (() => { const r = document.querySelector('[class*="stream__"]')?.getBoundingClientRect(); return r ? { w: Math.round(r.width), h: Math.round(r.height) } : null; })(),
    });
  }));
}
```

Expected：`classes` 含 `pl-mode-page`，`streamRect` 接近视口尺寸（1920×963 在 1080p 屏）。

切回居中模式（点 `居中` 按钮）验证 stream 尺寸变回 `min(90vw, 1280px)` 范围。

- [ ] **Step 6：测 SPA 内导航 autoMount 重挂**

```bash
mcp__playwright__browser_navigate 到 https://www.douyu.com/<另一个房间号，如 6979222>
```

等 4 秒，重复 Step 3 验证控制器仍正常挂载、按钮齐全。

- [ ] **Step 7：测录播页 PR1 后扩展不生效（预期降级）**

```bash
mcp__playwright__browser_navigate 到 https://v.douyu.com/show/<任一 ID>
```

调用 `mcp__playwright__browser_evaluate`：

```js
() => ({
  htmlClasses: document.documentElement.className,
  styleInjected: !!document.getElementById('pl-injected-style'),
  shadowHostExists: !!document.querySelector('pl-controller'),
})
```

Expected：

- `htmlClasses` 不包含 `pl-active`（content script 因 getCurrentAdapter 返回 null 而 return）
- `styleInjected: false`
- `shadowHostExists: false`

页面应该是斗鱼原生录播页（PR2 之前的预期降级状态）。

如果 Step 1-6 全通过：PR1 验收通过。

---

## 风险与回滚

- **Task 4 后 build 报错持续到 Task 14 完成**：这是预期的，多个互相依赖的接口同时迁移期间会暂时不可编译。不要中途 commit，整组 task 完成再视情况打 tag。
- **Step 7 录播页降级超出预期**：如果用户在 PR1 期间需要录播页可用，可以临时把 `styles/vod.ts` 包装成最简 adapter 也注册进 site-loader（约 30 分钟工作量），但不在 PR1 范围。

---

## Spec 覆盖核查

- ✅ Adapter 接口形状：Task 1 实现完整类型，Task 5 实现第一个 adapter
- ✅ URL 匹配 / Manifest 自动生成：Task 3 / Task 6 / Task 15
- ✅ Controller 按 capability 条件渲染：Task 12
- ✅ React context 传 capability：Task 2 / Task 14
- ✅ hooks 参数化：Task 7 / Task 8
- ✅ idle-tracking 解耦 dom-bridge：Task 13
- ✅ Shadow Root Reset 陷阱修复：Task 14 step 1 保留 `:host` 样式注入
- ✅ 删除老文件：Task 16
- ✅ 验收测试：Task 17（覆盖播放/音量/画质/弹幕/3 模式/SPA 路由）

无 Spec 项目漏写。
