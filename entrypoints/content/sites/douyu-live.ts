// 斗鱼直播站点 adapter。包揽：CSS（原 styles/live.ts）+ 所有 capability 实现（原 dom-bridge.ts）。

import { getState, setState } from '../state';
import type { SiteAdapter } from './types';

function getVideo(): HTMLVideoElement | null {
  return document.querySelector('video');
}

function clickNativePlayPause() {
  const btn = document.querySelector(
    '#js-player-controlbar [class*="left-"] > i[class*="icon-"]:first-child',
  ) as HTMLElement | null;
  btn?.click();
}

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

function requestFullscreen() {
  document.documentElement.requestFullscreen?.().catch(() => {});
}

function exitFullscreen() {
  document.exitFullscreen?.().catch(() => {});
}

function setCursorHidden(hidden: boolean) {
  const vc = document.querySelector('[class*="video__"]');
  vc?.classList.toggle('pl-cursor-hidden', hidden);
}

// 内部容器尺寸监听（对抗斗鱼 JS 动态设像素尺寸）。
// 不在 capability 接口里，由 index.tsx 在 douyu-live 启用时直接调用导出函数。
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

/* 切到真全屏时，Chrome 把 :fullscreen 元素提升到独立渲染层，第一帧会使用 user-agent
   默认背景（白色）；用 :fullscreen 伪类强制兜底为黑色，避免下方/全屏过程瞬间泛白。 */
html.pl-active:fullscreen,
html.pl-active:fullscreen body,
html.pl-active :fullscreen {
  background: #000 !important;
}

/* 永久黑色底层：fixed 铺满视口、z-index 极低，无论 stream__ / video 还没铺到底（fullscreen
   切换瞬间 / mode 切换的 reflow gap）都不会露出 body 默认背景。stream__ 自己 z-index
   2147483646，永远盖在底层之上。 */
html.pl-active body::before {
  content: '';
  position: fixed !important;
  inset: 0 !important;
  background: #000 !important;
  z-index: 0;
  pointer-events: none;
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
  /* 防御 is-smallDangling 状态：斗鱼会给 #js-player-video-case 设 inset:-60/65/60/-65
     向左上偏移，被 stream__ 的 overflow: clip 切掉左 65px + 上 60px。强制 reset。 */
  inset: 0 !important;
  top: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  left: 0 !important;
}

/* 防御 is-smallDangling 状态：斗鱼把 .room-Player-Box.is-smallDangling 渲染成右下角画中画
   小窗口（fixed; right:65; bottom:60; 515×290），弹幕容器在它内部，导致弹幕条只在右下
   515×290 范围里出现（"从中间出来滚到边缘就消失"）。把它拉回铺满父级。 */
html.pl-active .room-Player-Box.is-smallDangling {
  position: absolute !important;
  inset: 0 !important;
  top: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  left: 0 !important;
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
/* 用 aspect-ratio: 16/9 严格锁视频比例，避免 max-width 限制把容器拉成 4:3 留出黑边 */
html.pl-mode-centered [class*="stream__"] {
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
/* 显式重置 centered 模式的 transform / aspect-ratio / max-height —— 否则模式切换瞬间
   旧规则在下一帧才被新规则覆盖，元素短暂错位 / 高度不足，露出底层 body 背景（"下方泛白"）。 */
html.pl-mode-page [class*="stream__"],
html.pl-mode-fullscreen [class*="stream__"] {
  position: fixed !important;
  inset: 0 !important;
  top: 0 !important;
  left: 0 !important;
  transform: none !important;
  aspect-ratio: auto !important;
  width: 100vw !important;
  height: 100vh !important;
  max-width: none !important;
  max-height: none !important;
  z-index: 2147483646 !important;
  background: #000 !important;
}

/* 网页全屏 / 真全屏：<video> 直接 fixed 铺满视口，跳出宿主 flex 布局，
   不被斗鱼全屏 fullScreen-* 控制条挤压（控制条 class 命名跟直播内嵌不一样，
   隐藏规则难穷举；让 video 脱离布局是最稳的）。 */
html.pl-mode-fullscreen video,
html.pl-mode-page video {
  position: fixed !important;
  inset: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  max-width: none !important;
  max-height: none !important;
  object-fit: contain !important;
  background: #000 !important;
}

/* ═══ 弹幕：默认强制可见 ═══ */
/* 斗鱼在 is-smallDangling 状态下会让 .DanmuEffectDom 走 visibility: hidden（来源是 JS-managed
   stylesheet，标准 CSSOM matches 查不到）；这里强制把它打回 visible。 */
html.pl-active:not(.pl-hide-barrage) .DanmuEffectDom,
html.pl-active:not(.pl-hide-barrage) .DanmuEffectDom-container {
  visibility: visible !important;
}

/* ═══ 弹幕隐藏（pl-hide-barrage 类生效时） ═══ */
html.pl-hide-barrage [class*="comment-"],
html.pl-hide-barrage .DanmuEffectDom,
html.pl-hide-barrage [class*="danmu"] {
  display: none !important;
}
`;

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
      setHidden: (hidden) => setState({ hideBarrage: hidden }),
      setMode: (label) => {
        // 找原生 .danmuModels-* 内的 iconBtn-* 中文本匹配的按钮并 .click()。
        // 注：原生控制栏被我们 CSS 移到了 -9999px，DOM 仍存在，.click() 仍生效。
        const btns = document.querySelectorAll('[class*="danmuModels"] [class*="iconBtn"]');
        for (const b of btns) {
          if (b.textContent?.trim() === label) {
            (b as HTMLElement).click();
            return;
          }
        }
      },
    },
    fullscreen: { request: requestFullscreen, exit: exitFullscreen },
    cursorHide: { setHidden: setCursorHidden },
    modeSwitch: true,
  },
};
