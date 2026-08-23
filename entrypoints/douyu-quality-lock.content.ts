import {
  getDefaultQualityItem,
  getPreferredQualityItem,
  getQualityItems,
} from './content/sites/douyu-quality';

const STOP_MESSAGE = 'purelive:stop';
const LOCK_CLASS = 'pl-quality-locking';
const STYLE_ID = 'pl-quality-lock-style';
const MAX_LOCK_MS = 5000;
const NO_SWITCH_SETTLE_MS = 1200;
const PREFERRED_QUALITY_WAIT_MS = 1500;

function getRateElement(): Element | null {
  return document.querySelector('[class*="rate-"]');
}

function getCurrentQuality(rateEl: Element): string {
  const textLabel = rateEl.querySelector('[class*="textLabel-"]');
  const selected = rateEl.querySelector('[class*="selected-"]');
  return selected?.textContent?.trim() || textLabel?.textContent?.trim() || '';
}

export default defineContentScript({
  matches: ['*://www.douyu.com/*'],
  registration: 'runtime',
  runAt: 'document_start',

  main(ctx) {
    if (!/^\/\d+\/?$/.test(location.pathname)) return;

    let stopped = false;
    let qualityChosen = false;
    let switchInterruptedPlayback = false;
    let selectedAt = 0;
    let settleTimer: number | null = null;
    let fallbackTimer: number | null = null;
    let preferredWaitTimer: number | null = null;
    const watchedVideos = new Set<HTMLVideoElement>();

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      html.${LOCK_CLASS} video {
        visibility: hidden !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
    document.documentElement.classList.add(LOCK_CLASS);

    const observer = new MutationObserver(() => {
      watchVideos();
      tryChooseQuality();
    });

    function cleanup() {
      if (stopped) return;
      stopped = true;
      observer.disconnect();
      if (settleTimer !== null) window.clearTimeout(settleTimer);
      if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
      if (preferredWaitTimer !== null) window.clearTimeout(preferredWaitTimer);
      document.documentElement.classList.remove(LOCK_CLASS);
      style.remove();
      try {
        browser.runtime.onMessage.removeListener(onMessage);
      } catch {}
    }

    function revealIfReady() {
      if (!qualityChosen || stopped) return;
      const videos = Array.from(watchedVideos).filter((video) => video.isConnected);
      const activeVideo = videos.find((video) => !video.paused || video.readyState >= 3);
      if (!activeVideo) return;

      const elapsed = performance.now() - selectedAt;
      // 真正发生了媒体重载时，以目标流重新 canplay/playing 为准；若斗鱼内部无媒体事件，
      // 保守等待一小段时间，让异步切流有机会开始后再显示首帧。
      if (switchInterruptedPlayback || elapsed >= NO_SWITCH_SETTLE_MS) cleanup();
    }

    function watchVideos() {
      for (const video of document.querySelectorAll<HTMLVideoElement>('video')) {
        if (watchedVideos.has(video)) continue;
        watchedVideos.add(video);
        for (const eventName of ['loadstart', 'waiting', 'stalled', 'emptied']) {
          video.addEventListener(
            eventName,
            () => {
              if (qualityChosen) switchInterruptedPlayback = true;
            },
            { passive: true },
          );
        }
        for (const eventName of ['loadeddata', 'canplay', 'playing']) {
          video.addEventListener(eventName, revealIfReady, { passive: true });
        }
      }
    }

    function tryChooseQuality() {
      if (qualityChosen || stopped) return;
      const rateEl = getRateElement();
      if (!rateEl) return;

      const preferred = getPreferredQualityItem(rateEl);
      if (!preferred) {
        // 某些斗鱼版本 hover 后才挂载画质列表。
        rateEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        // 列表可能先只出现当前“高清”项，再异步补齐原画档；给 1080P60 一个短暂等待窗口，
        // 避免把这个临时单项误判为最高档并过早解锁画面。
        if (preferredWaitTimer === null) {
          preferredWaitTimer = window.setTimeout(() => {
            preferredWaitTimer = null;
            chooseQuality(getDefaultQualityItem(rateEl));
          }, PREFERRED_QUALITY_WAIT_MS);
        }
        return;
      }

      chooseQuality(preferred);
    }

    function chooseQuality(target: HTMLLIElement | undefined) {
      if (!target || qualityChosen || stopped) return;
      const rateEl = getRateElement();
      if (!rateEl || !target.isConnected) return;

      const targetLabel = target.textContent?.trim() || '';
      const alreadySelected = targetLabel === getCurrentQuality(rateEl);
      qualityChosen = true;
      selectedAt = performance.now();
      watchVideos();

      if (alreadySelected) {
        cleanup();
        return;
      }

      target.click();
      rateEl.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
      settleTimer = window.setTimeout(revealIfReady, NO_SWITCH_SETTLE_MS);
    }

    const onMessage = (message: unknown) => {
      if (
        typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message.type === STOP_MESSAGE
      ) {
        cleanup();
      }
    };

    browser.runtime.onMessage.addListener(onMessage);
    ctx.onInvalidated(cleanup);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    watchVideos();
    tryChooseQuality();
    // DOM 结构变化、房间未开播或站点改版时绝不永久遮住视频。
    fallbackTimer = window.setTimeout(cleanup, MAX_LOCK_MS);
  },
});
