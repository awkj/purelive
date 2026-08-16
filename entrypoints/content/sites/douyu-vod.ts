// 斗鱼录播站点 adapter（v.douyu.com/show/<id>）。
// 录播页播放器是 <demand-video> 自定义元素 + 内置 Shadow DOM；<video> 在 shadow root
// 内部，外部 DOM 操作不到 —— 所以播放/音量/画质/弹幕这些 capability 一律不声明，
// 沿用 <demand-video> 自带控制条；扩展只清理外围 + 提供 modeSwitch（迷你 ModeButtons 浮窗）。

import type { SiteAdapter } from './types';

const GLOBAL_CSS = `
/* ═══ body 级清理：只留 <demand-video-app> ═══ */
html.pl-active > body > *:not(demand-video-app):not(script):not(style):not(link):not(svg) {
  display: none !important;
}

/* ═══ layout-Main 内：只保留 .Video 容器（隐藏标题/扩展条/工具栏/简介/鱼吧），右侧推荐栏也隐藏 ═══ */
html.pl-active .layout-Main > :not(.Video),
html.pl-active .Layout-Main > .layout-Aside {
  display: none !important;
}

/* ═══ demand-video-app / Layout-Main / layout-Main 一路撑满视口 ═══ */
html.pl-active,
html.pl-active body {
  overflow: hidden !important;
  background: #000 !important;
  margin: 0 !important;
  padding: 0 !important;
  width: 100% !important;
  height: 100% !important;
}
html.pl-active demand-video-app,
html.pl-active .Layout-Main,
html.pl-active .layout-Main {
  width: 100% !important;
  height: 100% !important;
  max-width: none !important;
  padding: 0 !important;
  margin: 0 !important;
  display: block !important;
}

/* ═══ 居中模式：.Video 居中，严格 16:9（用 aspect-ratio 避免容器比视频高、留出黑栏） ═══ */
html.pl-mode-centered .Video {
  position: fixed !important;
  top: 50% !important;
  left: 50% !important;
  transform: translate(-50%, -50%) !important;
  width: min(90vw, calc(90vh * 16 / 9), 1280px) !important;
  height: auto !important;
  aspect-ratio: 16 / 9 !important;
  max-height: 90vh !important;
  z-index: 2147483646 !important;
  background: #000 !important;
  border: none !important;
  box-shadow: 0 0 60px 10px rgba(255,255,255,0.04), 0 0 120px 30px rgba(255,255,255,0.02), 0 4px 30px rgba(0,0,0,0.6) !important;
  overflow: clip !important;
}

/* ═══ 影院模式 / 真全屏：.Video 铺满视口 ═══ */
html.pl-mode-page .Video,
html.pl-mode-fullscreen .Video {
  position: fixed !important;
  inset: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  max-width: none !important;
  max-height: none !important;
  z-index: 2147483646 !important;
  background: #000 !important;
}

/* ═══ .Video 内部 demand-video 跟随父级（.Video 自身尺寸由 mode 规则决定） ═══ */
html.pl-active .Video > demand-video {
  width: 100% !important;
  height: 100% !important;
  max-width: none !important;
  max-height: none !important;
  display: block !important;
}
`;

export const DOUYU_VOD: SiteAdapter = {
  id: 'douyu-vod',
  match: { hosts: ['v.douyu.com'], path: /^\/show\// },
  globalCss: GLOBAL_CSS,
  anchor: '.Video',
  capabilities: {
    // 录播页 <video> 在 demand-video 的 shadow root 内部，外部 dom-bridge 拿不到；
    // 播放 / 音量 / 画质 / 弹幕 一律沿用 <demand-video> 自带控制条。
    // 提供 fullscreen 让 ModeButtons 的"全屏"调浏览器 fullscreen API。
    fullscreen: {
      request: () => document.documentElement.requestFullscreen?.().catch(() => {}),
      exit: () => document.exitFullscreen?.().catch(() => {}),
    },
    modeSwitch: true,
  },
};
