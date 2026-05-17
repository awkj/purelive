# Site Adapter 抽象层设计

**日期**：2026-05-16
**状态**：设计已对齐，待写实施计划

## 背景

"沉浸式直播"扩展当前只支持斗鱼直播 + 斗鱼录播两个站点，靠 `host.ts` 导出的 `IS_VOD` 二选一分流。目标是兼容更多站点：

1. `www.douyu.com`（斗鱼直播，已实现）
2. `v.douyu.com`（斗鱼录播，已实现）
3. `www.huya.com`（虎牙直播）
4. 虎牙回放（host 待确认）
5. `www.bilibili.com`（B 站视频）
6. `live.bilibili.com`（B 站直播）

继续用 `IS_VOD` 这种字面分支扩到 6 个站点会让 `index.tsx` `Controller.tsx` `dom-bridge.ts` 全部充斥 `IS_XXX` 判断，无法维护。本设计引入一个声明式的 site adapter 抽象层。

## 决策摘要

| 决策点 | 选择 |
|---|---|
| 抽象范围 | "够用即可"——精准支撑 6 个目标站点，不为未知站点过度设计 |
| Controller 渲染策略 | **声明式 capability**：adapter 声明能做什么，Controller 看清单渲染 |
| URL 匹配机制 | adapter 导出 `match: { hosts: string[], path?: RegExp }`（声明式元数据，loader 可逆向生成 manifest matches） |
| 迁移策略 | 三步走（PR1 = 基础设施 + 斗鱼直播；PR2 = 斗鱼录播；PR3+ = 每站独立 PR） |

## 总体架构

引入 `entrypoints/content/sites/` 目录，每站一个 adapter 文件。Adapter 是一个声明式对象，描述 4 件事：

1. **`match`**：自己适用哪些 URL（host + 可选 path）
2. **`globalCss`**：注入到宿主页面的全局 CSS（隐藏外围、模式布局等）
3. **`anchor`**：玻璃态控制器要挂到的元素 CSS selector
4. **`capabilities`**：能提供的能力，声明式（`playPause`、`volume`、`quality`、`barrage`、`fullscreen`、`modeSwitch`、`cursorHide`、`video` 等）

`content/index.tsx` 启动时通过 `site-loader.ts` 选出当前 URL 对应的 adapter，注入 CSS、用 anchor 挂控制器、把 capabilities 通过 React context 传给组件。

老的 `dom-bridge.ts` 退化为 `sites/douyu-live.ts` 内部的实现，不再作为独立模块存在。`host.ts`、`styles/live.ts`、`styles/vod.ts` 都被 adapter 文件吸收。

## Capability 接口形状

`sites/types.ts`：

```ts
type VideoCap = {
  getVideo: () => HTMLVideoElement | null;
};

type PlayPauseCap = {
  click: () => void;            // 触发播放/暂停（委托原生或直接 video.play()，由 adapter 决定）
};

type VolumeCap = {
  set: (v: number) => void;
  toggleMute: () => void;
};

type QualityCap = {
  read: () => string;
  autoSelect: (preferences: string[]) => void;
};

type BarrageCap = {
  setHidden: (hidden: boolean) => void;
};

type FullscreenCap = {
  request: () => void;
  exit: () => void;
};

type CursorHideCap = {
  setHidden: (hidden: boolean) => void;
};

type ModeSwitchCap = true;       // marker：该站支持 centered/page/fullscreen 三模式，CSS 在 globalCss 内

export interface SiteAdapter {
  id: string;                                       // 'douyu-live' | 'douyu-vod' | ...
  match: { hosts: string[]; path?: RegExp };
  globalCss: string;
  anchor: string;                                   // shadow host 挂载锚点
  capabilities: {
    video?: VideoCap;
    playPause?: PlayPauseCap;
    volume?: VolumeCap;
    quality?: QualityCap;
    barrage?: BarrageCap;
    fullscreen?: FullscreenCap;
    cursorHide?: CursorHideCap;
    modeSwitch?: ModeSwitchCap;
  };
}
```

### Controller 渲染规则

- `playPause` 存在 → 渲染 `<PlayPauseButton>`
- `volume` + `video` 同时存在 → 渲染 `<VolumeControl>`（音量同步需要 video 事件）
- `quality` 存在 → 渲染 `<QualityLabel>` + 启动 `useAutoQuality`
- `barrage` 存在 → 渲染 `<DanmakuToggle>`
- `modeSwitch` 存在 → 渲染 `<ModeButtons>`
- 没有任何"播放控制"能力但有 `modeSwitch` → 走"迷你形态"（容器从 `fixed bottom-2 left-1/2` 改为 `absolute top-2 right-2`，且始终可见不参与 idle-tracking，跟现在录播页一致）

各站典型形态：

| Adapter | 声明的 capabilities | 形态 |
|---|---|---|
| `douyu-live` | video/playPause/volume/quality/barrage/fullscreen/cursorHide/modeSwitch | 完整玻璃态（底部居中） |
| `douyu-vod` | modeSwitch | 迷你形态（右上角） |
| `huya-live` | 预期同 douyu-live（待实施时确认 DOM 结构） | 完整玻璃态 |
| `bilibili-video` | 视 BPX 播放器能否取到 `<video>` 决定 | 完整或迷你 |

## 数据流

```
[ content-script 启动 ]
       │
       ▼
content/index.tsx
  ├─ const adapter = getCurrentAdapter()       // 没匹配 → return
  ├─ injectGlobalStyles(adapter.globalCss)
  ├─ document.documentElement.classList.add('pl-active')
  ├─ createShadowRootUi({ anchor: adapter.anchor, onMount: ... })
  └─ React 渲染：
       <AdapterContext.Provider value={adapter.capabilities}>
         <Controller />
       </AdapterContext.Provider>

Controller 内：
  const caps = useAdapter();
  caps.playPause && <PlayPauseButton onClick={caps.playPause.click} />
  caps.volume    && <VolumeControl onSet={caps.volume.set} ... />
  caps.quality   && <QualityLabel />（+ 启动 useAutoQuality(caps.quality)）
  caps.video     && 启动 useVideoSync(caps.video)（把 video 事件同步到 store）
  caps.barrage   && <DanmakuToggle ... />
  caps.modeSwitch && <ModeButtons />
```

`state.ts` 的 store 结构保持不变 —— `mode` / `hideBarrage` / `enabled` / `volume` / `muted` / `isPlaying` / `qualityLabel` / `isIdle` 都还在。adapter 没声明的 capability 对应字段就是"无人写入"，组件不渲染也就读不到，没问题。

`idle-tracking` 仍绑定在 `shadowHost.parentElement`，与 adapter 无关（所有站点共用）。但 `cursorHide` capability 决定鼠标隐藏时是否同步藏宿主光标（斗鱼直播需要，录播不需要）。

## URL 匹配 / Manifest 同步

`sites/site-loader.ts`：

```ts
import { DOUYU_LIVE } from './douyu-live';
import { DOUYU_VOD } from './douyu-vod';
// ...

const ADAPTERS: SiteAdapter[] = [DOUYU_LIVE, DOUYU_VOD, /* ... */];

export function getCurrentAdapter(): SiteAdapter | null {
  const { hostname, pathname } = location;
  for (const a of ADAPTERS) {
    if (!a.match.hosts.includes(hostname)) continue;
    if (a.match.path && !a.match.path.test(pathname)) continue;
    return a;
  }
  return null;
}

// 用于构建期生成 manifest matches
export function getAllMatchPatterns(): string[] {
  return [...new Set(ADAPTERS.flatMap(a => a.match.hosts.map(h => `*://${h}/*`)))];
}
```

`wxt.config.ts` 在 content script 配置里调用 `getAllMatchPatterns()`，避免 manifest 跟 adapter 注册表手动同步。

## 错误处理

- **没匹配的 adapter**：`getCurrentAdapter()` 返回 `null`，content script `return`，不做任何注入。manifest `matches` 应该已过滤掉这种 URL，但作为防御保留。
- **anchor 当下不存在**：WXT `ui.autoMount()` 等待 anchor 出现再挂载，SPA 路由也会重挂。沿用现有行为，不需要改。
- **capability 调用时 DOM 已变（如 `getVideo()` 返回 null）**：每个 capability 实现内部用 `?.` 早退（沿用现有 `dom-bridge` 的策略）。
- **多 adapter 匹配同一 URL**：site-loader 按数组顺序找第一个匹配的就停。adapter 顺序在 `site-loader.ts` 内显式列出，避免歧义。
- **Shadow DOM Reset 陷阱**：仍然在 `onMount` 内追加 `<style>:host{...}</style>` 到 shadow root（保留现有修复），与 adapter 无关。

## 文件结构变化

```
entrypoints/content/
  index.tsx              [改] 用 site-loader 选 adapter，提供 AdapterContext
  global-styles.ts       [改] injectGlobalStyles(css) 通用化，CSS 字符串由 adapter 提供
  state.ts               [不动]
  idle-tracking.ts       [不动]
  host.ts                [删] 被 site-loader 取代
  dom-bridge.ts          [删] 逻辑搬进 sites/douyu-live.ts
  components/
    Controller.tsx       [改] 从 AdapterContext 读 caps，按 caps 渲染
    AdapterContext.tsx   [新] React context for adapter.capabilities
    PlayPauseButton.tsx  [改] 从 props 拿 click 回调
    VolumeControl.tsx    [改] 同上
    DanmakuToggle.tsx    [改] 同上
    QualityLabel.tsx     [不动]
    ModeButtons.tsx      [不动]
  hooks/
    useVideoSync.ts      [改] 参数化 getVideo
    useAutoQuality.ts    [改] 参数化 quality 操作
  sites/                 [新]
    types.ts             SiteAdapter / capability 类型
    site-loader.ts       注册表 + 匹配逻辑 + getAllMatchPatterns()
    douyu-live.ts        PR1
    douyu-vod.ts         PR2
    huya-live.ts         PR3
    huya-vod.ts          PR4（如果有回放 host）
    bilibili-video.ts    PR5
    bilibili-live.ts     PR6
    _shared/             跨 adapter 复用工具（按需）
  styles/
    controller.css       [不动]
    slider.css           [不动]
    live.ts              [删] 搬进 sites/douyu-live.ts.globalCss
    vod.ts               [删] 搬进 sites/douyu-vod.ts.globalCss
```

## 迁移计划

**PR1：基础设施 + 斗鱼直播**

1. 新建 `sites/types.ts` `sites/site-loader.ts` `sites/AdapterContext.tsx`
2. 新建 `sites/douyu-live.ts`：CSS 字符串从 `styles/live.ts` 整体搬来；capabilities 实现从 `dom-bridge.ts` 各函数搬来；anchor `[class*="video__"]`；声明全部 capability
3. 改 `index.tsx`：用 `getCurrentAdapter()` 替换 `IS_VOD` 分支；用 adapter context 包裹 Controller；删 `dom-bridge` import
4. 改 Controller / 三个 button 组件 / 两个 hook：从 context 而非 import 拿 capability
5. 改 `global-styles.ts`：`injectGlobalStyles(css: string)` 接受参数；删 `LIVE_CSS` / `VOD_CSS` 选择逻辑
6. 改 `wxt.config.ts`：content script `matches` 从 `getAllMatchPatterns()` 生成
7. 删 `host.ts` `dom-bridge.ts` `styles/live.ts`
8. 手测斗鱼直播全部功能（参见测试策略）

**PR2：斗鱼录播迁过去**

1. 新建 `sites/douyu-vod.ts`：CSS 从 `styles/vod.ts` 搬；capabilities 只声明 `modeSwitch`；anchor `.Video`
2. 注册到 site-loader
3. 删 `styles/vod.ts`
4. 手测录播页

**PR3+：每个新站点一个 PR**

按 PR2 的形态走。每个 PR 需要先在浏览器侧用 Playwright MCP 摸该站 DOM 结构、确认 anchor 和能否取到 `<video>`、再写 capabilities。

## 测试策略

无自动化测试基础设施 —— 手测 + Playwright MCP 自驱浏览器验证。每个 PR 的验收路径：

- **PR1（斗鱼直播）**：开 `www.douyu.com/<room>`，玻璃态控制器底部居中显示，**所有现有功能**（播放/音量/弹幕/画质/3 模式切换）行为一致；测一次 SPA 内导航（点房间 A → 点房间 B），autoMount 重挂正常。
- **PR2（斗鱼录播）**：开 `v.douyu.com/show/<id>`，右上角迷你 ModeButtons 浮窗显示，三个模式都能切；视频严格 16:9 居中。
- **PR3+（每个新站点）**：至少手测 mode 切换 + 浏览器 fullscreen API；如果声明了 video 相关 capability，测播放/音量/画质。
- **跨 PR 回归**：每个 PR 完成后都要回前面已经接入的站点跑一遍，确认 capability 接口在新 adapter 接入时保持稳定。

## 不在范围内

明确不在本次抽象层内做的事：

- 不引入插件化加载（动态 import adapter）—— 直接静态 import，6 个站点的 bundle 体积可接受。
- 不引入自动化测试框架。
- 不抽象 popup（popup 当前只有总开关，跟 adapter 无关）。
- 不支持"一个 host 多个 adapter"动态切换（如 B 站登录态 vs 未登录态用不同 adapter）——每个 URL 只匹配一个 adapter。

## 风险

| 风险 | 缓解 |
|---|---|
| 虎牙 / B 站 DOM 结构差异比预期大，capability 接口需要扩展 | PR3 第一次接入新站点时如果发现接口不够用，先扩 `types.ts` 加可选 capability，再回头给 douyu-live 补声明（保持向后兼容） |
| 多个 adapter 共享逻辑出现重复（如三模式 CSS 写法） | 在 `sites/_shared/` 提取 helper，但仅在出现"第二次重复"时再抽，避免预先抽象 |
| WXT manifest matches 从 adapter 注册表生成时，构建期能否拿到所有 adapter 的 hosts | 在 `wxt.config.ts` 内 import `site-loader` 应该可行（vite 构建期 ES module 解析），PR1 验证 |
