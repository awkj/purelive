// 虎牙直播站点 adapter。使用虎牙稳定的 player-* DOM 接入播放控制，页面布局由
// #J_playerMain 承载，避免依赖外围经常变化的活动、赛事和侧栏结构。

import { getState, setState, type BarrageMode } from '../state';
import type { SiteAdapter } from './types';

const QUALITY_LIST_SELECTOR = '.player-videotype-list';

function getVideo(): HTMLVideoElement | null {
  return document.querySelector<HTMLVideoElement>('#hy-video, #player-video video');
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

function clickNativePlayPause() {
  const button = document.querySelector<HTMLElement>('#player-btn');
  if (button) {
    button.click();
    return;
  }

  const video = getVideo();
  if (!video) return;
  if (video.paused) void video.play().catch(() => {});
  else video.pause();
}

function setVideoVolume(value: number) {
  const video = getVideo();
  if (!video) return;
  video.volume = value;
  video.muted = value === 0;
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

function getQualityItems(): HTMLLIElement[] {
  return Array.from(
    document.querySelectorAll<HTMLLIElement>(`${QUALITY_LIST_SELECTOR} > li`),
  ).filter((item) => Boolean(item.textContent?.trim()));
}

function readCurrentQuality(): string {
  const selected = document.querySelector(`${QUALITY_LIST_SELECTOR} > li.on`);
  const current = document.querySelector('.player-videotype-cur');
  return selected?.textContent?.trim() || current?.textContent?.trim() || '';
}

async function listQualities(): Promise<string[]> {
  return getQualityItems()
    .map((item) => item.textContent?.trim() || '')
    .filter((label, index, labels) => labels.indexOf(label) === index);
}

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

let hasManualQualitySelection = false;

async function selectQuality(target: string): Promise<boolean> {
  const item = getQualityItems().find((candidate) => candidate.textContent?.trim() === target);
  if (!item) return false;

  item.click();
  hasManualQualitySelection = true;
  await wait(350);
  setState({ qualityLabel: readCurrentQuality() || target });
  return true;
}

function autoSelectHighestQuality() {
  if (!getState().enabled || hasManualQualitySelection) return;
  const highest = getQualityItems()[0];
  if (!highest) return;

  const highestLabel = highest.textContent?.trim() || '';
  if (highestLabel && highestLabel !== readCurrentQuality()) highest.click();
  setState({ qualityLabel: readCurrentQuality() || highestLabel });
}

const BARRAGE_MODE_VALUES: Record<BarrageMode, string> = {
  '全屏': 'full',
  '1/4屏': 'quarter',
  '上半屏': 'top-half',
  '下半屏': 'bottom-half',
};

function setBarrageMode(mode: string) {
  const value = BARRAGE_MODE_VALUES[mode as BarrageMode];
  if (value) document.documentElement.dataset.plHuyaBarrageMode = value;
}

function requestFullscreen() {
  document.documentElement.requestFullscreen?.().catch(() => {});
}

function exitFullscreen() {
  document.exitFullscreen?.().catch(() => {});
}

function setCursorHidden(hidden: boolean) {
  document.querySelector('#player-video')?.classList.toggle('pl-cursor-hidden', hidden);
}

const GLOBAL_CSS = `
/* 原生控制栏保留在 DOM 中供 adapter 点击，但不参与沉浸布局。 */
html.pl-active #player-ctrl-wrap {
  position: fixed !important;
  left: -9999px !important;
  top: -9999px !important;
  bottom: auto !important;
  width: 0 !important;
  height: 0 !important;
  overflow: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
}

html.pl-active,
html.pl-active body {
  width: 100% !important;
  height: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  background: #000 !important;
}

html.pl-active:fullscreen,
html.pl-active:fullscreen body,
html.pl-active :fullscreen {
  background: #000 !important;
}

html.pl-active body::before {
  content: '';
  position: fixed !important;
  inset: 0 !important;
  z-index: 2147483645 !important;
  background: #000 !important;
  pointer-events: none !important;
}

/* 播放器之外的活动、礼物和互动层不会盖住视频。 */
html.pl-active .room-player-gift-placeholder,
html.pl-active #J_roomPlayerLayer,
html.pl-active #hy-watermark,
html.pl-active #player-watermark,
html.pl-active #player-ext-wrap-under-barrage,
html.pl-active #player-subscribe-wap,
html.pl-active #face-director-subscribe,
html.pl-active #player-gift-wrap,
html.pl-active .player-banner,
html.pl-active .player-gift-wrap,
html.pl-active .player-app-qrcode {
  display: none !important;
}

/* 原站 .room-player-wrap 的 z-index:3 会创建独立 stacking context，使内部即使使用
   最大 z-index 也被 body 黑色底层盖住。取消该 context，让 #J_playerMain 直接参与
   根层叠顺序。 */
html.pl-active .room-player-wrap {
  z-index: auto !important;
}

html.pl-active #J_playerMain {
  z-index: 2147483646 !important;
  margin: 0 !important;
  padding: 0 !important;
  background: #000 !important;
  overflow: hidden !important;
}

/* 虎牙的 hy-hd-vp-l / hy-hd-full 类会用 !important 把 videoContainer 固定到视口；
   带上完整播放器层级提高 specificity，确保居中模式仍以 #J_playerMain 为边界。 */
html.pl-active body #J_playerMain #liveRoomObj,
html.pl-active body #J_playerMain #liveRoomObj #videoContainer,
html.pl-active body #J_playerMain #liveRoomObj #videoContainer #player-wrap,
html.pl-active body #J_playerMain #liveRoomObj #videoContainer #player-wrap #player-video,
html.pl-active body #J_playerMain #liveRoomObj #videoContainer #player-wrap #player-video #danmuwrap {
  position: absolute !important;
  inset: 0 !important;
  width: 100% !important;
  height: 100% !important;
  max-width: none !important;
  max-height: none !important;
  margin: 0 !important;
  padding: 0 !important;
  transform: none !important;
}

html.pl-active #player-video {
  cursor: default !important;
  background: #000 !important;
}

html.pl-active #player-video.pl-cursor-hidden,
html.pl-active #player-video.pl-cursor-hidden * {
  cursor: none !important;
}

html.pl-active body #J_playerMain #player-video #hy-video,
html.pl-active body #J_playerMain #player-video video {
  position: absolute !important;
  inset: 0 !important;
  width: 100% !important;
  height: 100% !important;
  max-width: none !important;
  max-height: none !important;
  object-fit: contain !important;
  background: #000 !important;
}

html.pl-mode-centered #J_playerMain {
  position: fixed !important;
  top: 50% !important;
  left: 50% !important;
  right: auto !important;
  bottom: auto !important;
  width: min(90vw, calc(90vh * 16 / 9), 1280px) !important;
  height: auto !important;
  aspect-ratio: 16 / 9 !important;
  max-width: none !important;
  max-height: 90vh !important;
  transform: translate(-50%, -50%) !important;
  box-shadow: 0 0 60px 10px rgba(255,255,255,0.04), 0 0 120px 30px rgba(255,255,255,0.02), 0 4px 30px rgba(0,0,0,0.6) !important;
}

html.pl-mode-page #J_playerMain,
html.pl-mode-fullscreen #J_playerMain {
  position: fixed !important;
  inset: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  max-width: none !important;
  max-height: none !important;
  aspect-ratio: auto !important;
  transform: none !important;
}

html.pl-active #danmuwrap,
html.pl-active #danmudiv {
  overflow: hidden !important;
}

html.pl-active[data-pl-huya-barrage-mode='full'] #danmudiv {
  top: 0 !important;
  height: 100% !important;
}
html.pl-active[data-pl-huya-barrage-mode='quarter'] #danmudiv {
  top: 0 !important;
  height: 25% !important;
}
html.pl-active[data-pl-huya-barrage-mode='top-half'] #danmudiv {
  top: 0 !important;
  height: 50% !important;
}
html.pl-active[data-pl-huya-barrage-mode='bottom-half'] #danmudiv {
  top: 50% !important;
  height: 50% !important;
}

html.pl-hide-barrage #danmuwrap,
html.pl-hide-barrage #danmudiv,
html.pl-hide-barrage .danmu-item {
  display: none !important;
}
`;

// 虎牙直播房间既支持数字房间号也支持英文别名；排除同为单段路径的站点入口。
const ROOM_PATH = /^\/(?!l\/?$|g\/?$|m\/?$|search\/?$|video\/?$|myfollow\/?$|download\/?$)[A-Za-z0-9_-]+\/?$/;

export const HUYA_LIVE: SiteAdapter = {
  id: 'huya-live',
  match: { hosts: ['www.huya.com'], path: ROOM_PATH },
  globalCss: GLOBAL_CSS,
  anchor: '#player-video',
  deactivate: () => {
    setCursorHidden(false);
    delete document.documentElement.dataset.plHuyaBarrageMode;
    hasManualQualitySelection = false;
  },
  capabilities: {
    video: { getVideo },
    playPause: {
      click: () => {
        clickNativePlayPause();
        window.setTimeout(syncVideoState, 150);
      },
    },
    volume: { set: setVideoVolume, toggleMute },
    quality: {
      read: readCurrentQuality,
      list: listQualities,
      select: selectQuality,
      autoSelectHighest: autoSelectHighestQuality,
    },
    barrage: {
      setHidden: (hidden) => setState({ hideBarrage: hidden }),
      setMode: setBarrageMode,
    },
    fullscreen: { request: requestFullscreen, exit: exitFullscreen },
    cursorHide: { setHidden: setCursorHidden },
    modeSwitch: true,
  },
};
