# 斗鱼直播页 DOM 参考

采样自 `https://www.douyu.com/6657`（裸页面，未装扩展），视口 `1920×963`。
原始 dump：`docs/douyu-dom-snapshot.json`。

斗鱼用 CSS Modules，**所有 class 名带哈希后缀**（如 `stream__T55I3`、`player__jsy1T`）。后缀可能随版本变化，**选择器必须用 `[class*="prefix-"]` 通配**，不能写死完整 class。

---

## 顶层布局

```
<html> 963px
└─ <body> 3923px (overflow: auto scroll；带 inline CSS var `--player-proxy-holder-ratio: 0.5625` = 9/16)
   └─ <main class="main__S3hsk">
      └─ #root
         ├─ .wm-general          ← 顶部装饰条 / 切换房间条 → 隐藏
         ├─ .playerWrap__        ← 播放器外层容器（1920×868）
         │  ├─ .playerBackgroundBlur__   ← 背景模糊层 → 隐藏
         │  ├─ .playerBackground__       ← 背景图 → 隐藏
         │  └─ <div>                     ← 无 class 中间层（1582×852）
         │     ├─ #js-super-menu .menu__ → 隐藏
         │     └─ .stage__              ← 1582×852，含播放器+侧栏
         │        ├─ #js-player-main .main__   ← 1194×852，播放器主体
         │        │  └─ .player__              ← 1194×852
         │        │     ├─ .title__.info__     ← 顶部信息栏（1194×72）→ 隐藏
         │        │     ├─ .stream__           ← ★视频容器（1194×672，absolute top=72）
         │        │     └─ .interactive__      ← 底部互动+控制栏（1194×108）→ 隐藏
         │        └─ .sidebar__         ← 右侧聊天 380×852 → 隐藏
         └─ ...                  ← 滚动区下方还有 ~3000px 推荐/详情内容
```

### 关键尺寸事实

- `playerWrap__` inline `height: 1019px` 但 computed 是 868px（CSS class 用了 max-height 覆盖）
- `stream__` 是 **absolute 定位**，宽度由父 `player__` 决定（1194），**高度按 16:9 自动计算**（672 = 1194 × 9/16）
- 这意味着：**如果想让 stream 铺满视口**，要么强制 stream `width:100vw; height:100vh`，要么让 `player__` 容器变成视口尺寸再依赖 16:9 自适应
- 视频 contain 模式下黑边方向取决于视口比例：视口比 16:9 更宽 → 左右黑边；更高 → 上下黑边

---

## Video 元素父链（从内到外）

stream 内部嵌套很深，但**每一层尺寸都跟 stream 完全相同**（1194×672），不存在 padding/aspect-ratio hack 锁比例（之前怀疑的 `customBc-` 元素**不存在**）：

```
<video #__video2 object-fit:contain>
  └─ <div>                       无 class，包 video
     └─ #js-player-video-first .layout-Player-videoEntity
        └─ #js-player-multiContainer .layout-Player-multiContainer
           └─ <div .player__6-Nuo>
              └─ <div .container__3RvjJ>
                 └─ #js-player-video .core__
                    └─ #js-player-video-case .core__
                       └─ <div .video__VfhVg.cursor__>
                          └─ <div .stream__T55I3>   ← 视频边界由这里决定
```

`video` 元素本身有 `object-fit: contain`、宽高 100%，会自动按容器尺寸渲染，无需直接操作。

---

## 关键操作锚点

### 播放/暂停按钮

斗鱼有自己的播放状态管理，**不要直接 `video.play()`**，要点击原生按钮：

```js
document.querySelector('#js-player-controlbar [class*="left-"] > i[class*="icon-"]:first-child').click();
```

原生控制栏 DOM 结构（节选）：
```
#js-player-controlbar .controlbar__
  └─ .ControlBar-
     ├─ .left-              ← 第1个 i 是播放/暂停，第2个 i 是刷新
     │  ├─ <i .icon-> 暂停 svg
     │  └─ <i .icon-> 刷新 svg
     └─ .right-
        ├─ .wonderful-     ← 精彩集锦
        ├─ <i .icon->      ← 画中画
        ├─ .volume-
        │  ├─ <i .icon->   ← 音量图标
        │  └─ .VolumeBar-  ← 垂直音量条
        └─ .showdanmuWrap-  ← 弹幕开关
        └─ ...
```

### 画质选择器

```js
const rateEl = document.querySelector('[class*="rate-"]');
```

DOM 结构：

```
.rate-
  ├─ .panelWrapFill-
  ├─ .tip-                          ← 展开后的下拉面板（默认 display:none）
  │  ├─ .tipItem-                   ← 线路选择
  │  ├─ .tipItem- > ul > li         ← 画质列表：原画1080P60 / 蓝光4M / 超清 / 高清
  │  │                                选中项带 .selected- class
  │  └─ .tipItem-.enhance-          ← 画质增强开关
  └─ .text- > .textLabel-           ← 当前画质标签文本
```

切换画质：`mouseenter` 触发展开 → 找 `li` 文本匹配 → click。当前实现 `dom-bridge.ts#autoSelectQuality` 即此模式。

### 音量

直接操作 `video.volume / video.muted`，不需要走原生按钮。

### 全屏

页面**没有原生 fullscreen 按钮**（`fullscreenCandidates` 空），需自己调 Fullscreen API：

```js
document.documentElement.requestFullscreen();   // 推荐：整个 html 进全屏，避免局部元素布局副作用
document.exitFullscreen();
```

### 弹幕

弹幕节点 class 前缀：
- `.comment-` ← 弹幕外壳
- `.danmu-` ← 单条弹幕
- `.danmuItem-.scroll-` ← 滚动弹幕项
- `.DanmuEffectDom` ← 弹幕特效层

---

## 需要隐藏的节点

按 CSS 选择器（带 `!important` + `display: none` 即可）：

| 元素 | 选择器 | 用途 |
|---|---|---|
| body 顶部 svg 雪碧图 | `#__SVG_SPRITE_NODE__` | 已隐藏（0×0） |
| 页面 header | `#js-header .header__` | 顶栏 |
| 左侧悬浮 ASIDE | `aside[class*="container__"]` | 全局侧栏 |
| Toast 容器 | `.Toastify` | 通知 |
| 装饰条 | `[class*="wm-general"]` | 切换房间条 |
| 背景模糊 | `[class*="playerBackgroundBlur"]` | playerWrap 装饰 |
| 背景图 | `[class*="playerBackground__"]` | playerWrap 装饰 |
| 顶部信息栏 | `[class*="title__"][class*="info__"]` | 主播名+人数 |
| 底部互动栏 | `[class*="interactive__"]` | 关注/送礼按钮 |
| 右侧聊天侧栏 | `[class*="sidebar__"]` | 聊天面板 |
| 悬浮广告 | `[class*="advert__"]`、`.aside-top-uspension-*` | |
| 房间切换菜单 | `#js-super-menu` | |
| 原生控制栏 | `#js-player-controlbar`、`[class*="ControlBar-"]`、`[class*="controlbar-"]` | 保留 DOM 供 .click 委托 |

---

## CSS Module 类名前缀清单

带 `__XxXx`（驼峰组件）或 `-abc123`（短哈希）后缀的关键 class：

- `playerWrap__` `playerBackground__` `playerBackgroundBlur__`
- `stage__` `main__` `player__` `stream__` `video__`
- `title__` `info__` `interactive__` `sidebar__`
- `controlbar__` `ControlBar-` `left-` `right-` `volume-` `wonderful-` `showdanmuWrap-`
- `rate-` `tip-` `tipItem-` `text-` `textLabel-` `selected-`
- `comment-` `danmu-` `danmuItem-` `scroll-`
- `advert__` `buff__` `watermark-`

短横线哈希型（如 `controlbar__LhZiJ`、`rate-ec9440`）相对稳定，但**永远用 `[class*="prefix"]` 不要写死完整 hash**。

---

## 已知的 inline style 干扰

- `<body>` 有 `style="--player-proxy-holder-ratio: 0.5625;"`（9/16，斗鱼自己用的 CSS 变量）
- `.playerWrap__` 内联 `style="height:1019px; ..."`（外层强行写像素值，但 class CSS 有 max-height 覆盖）
- 视频内层（`#__h5player`、`#player-control-video`、`[class*="video-container-"]`）**斗鱼 JS 会动态写 inline `width/height` 像素值**，必须用 MutationObserver 监听并强制重置为 `100%`（已实现于 `dom-bridge.ts#watchInnerDimensions`）

---

## 扩展激活态对照（pl-active + pl-mode-page）

采样自同一 viewport `1920×963`，注入了真实 `GLOBAL_CSS` 后。完整 dump：`docs/douyu-dom-snapshot-active.json`。

### 实测尺寸（自里向外）

| 元素 | rect | computed h | position | 备注 |
|---|---|---|---|---|
| `<video>` | 1920×963 @ (0,0) | 963px | absolute | object-fit:contain ✓ |
| `.video__VfhVg` | 1920×963 @ (0,0) | 963px | relative | 我们改的 |
| `.stream__T55I3` | **1920×963 @ (0,0)** | 963px | **fixed** | mode-page 规则生效 ✓ |
| `.player__jsy1T` | 1920×**887** @ (0,0) | **max-height: 887px** | relative | ⚠ 被 class CSS 锁高 |
| `#js-player-main` | 1920×887 | 887px | relative | 继承 player 高度 |
| `.stage__` | 1920×887 | 887px | relative | |
| `.playerWrap__` | 1920×963 | 963px | relative | 我们改成 100% 后 OK，inline `height:1019px` 被 class 的 max-height 覆盖到 963 |

### 关键结论

- ✅ **`stream__` fixed inset:0 100vw×100vh 规则正常生效**，整条 stream 内部链路一路到 `<video>` 都是 1920×963，video 元素本身已经铺满视口
- ⚠ **`player__jsy1T` 有 `max-height: 887px`** 的 class 样式锁住自己（887 ≈ 963 - 顶部 60px header 占位 - 16px padding），但这**不影响 stream 子树**（stream 是 fixed 脱离了 player 流），仅影响 player 自身可见区域
- ✅ 视频 `object-fit: contain` 在 1920×963（比例 1.99 ≈ 16:9.6）视口里渲染 16:9 视频应该有**左右各 ~104px 黑边**，不是上下黑边

### 用户实际看到底部黑边的可能原因（推测）

1. **真全屏模式**（`pl-mode-fullscreen`）下，`requestFullscreen` 在 `stream` 元素上调用 → stream 进入 top layer，但 `:fullscreen` 元素的尺寸 = 物理屏幕分辨率，与 `100vh` 在某些浏览器/平台下可能不一致；**建议改成对 `document.documentElement.requestFullscreen()` 调用**，让整个 html 全屏，stream 100vh 必然等于屏幕高度
2. **物理屏幕比例**：若用户屏幕是 16:10（如 MBP）而非 16:9，object-fit:contain 会自然产生上下黑边（约 5% 高度），这是正确行为而非 bug
3. **网页全屏模式（page）**下 100vh 包含浏览器 chrome 之外的视口，理论上无 bug

---

## 重采样脚本

把下面这段贴到斗鱼页 Console，会重新生成一份 `dump` 对象（同结构），可对比 schema 变化：

```js
// 见 docs/douyu-dom-snapshot.json 顶层结构
// 字段：viewport, htmlStyle, bodyStyle, videoChain[], bodyChildren[],
//       mainTree, controlbarHTML, rateHTML, fullscreenCandidates[],
//       sidebarCandidates[], danmuCandidates[]
```

具体代码见 git 历史中 `playwright_browser_evaluate` 调用。
