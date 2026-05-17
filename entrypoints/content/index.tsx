import ReactDOM from 'react-dom/client';
import { injectGlobalStyles, applyModeClasses } from './global-styles';
import { getState, setState, subscribe, loadPersistedState, persistState } from './state';
import { setupIdleTracking } from './idle-tracking';
import { getCurrentAdapter, MATCH_PATTERNS } from './sites/site-loader';
import { AdapterProvider } from './sites/AdapterContext';
import { watchInnerDimensions, unwatchInnerDimensions } from './sites/douyu-live';
import Controller from './components/Controller';
import './styles/controller.css';

export default defineContentScript({
  matches: MATCH_PATTERNS,
  runAt: 'document_end',
  cssInjectionMode: 'ui',

  async main(ctx) {
    const adapter = getCurrentAdapter();
    if (!adapter) return;

    injectGlobalStyles(adapter.globalCss);
    await loadPersistedState();
    applyModeClasses(getState());
    if (getState().enabled && adapter.id === 'douyu-live') watchInnerDimensions();

    // 启用时把弹幕模式应用到斗鱼原生选择器（默认 1/4屏），原生 UI 被 CSS 移到屏外但 DOM 可点。
    if (getState().enabled && adapter.capabilities.barrage?.setMode) {
      const applyBarrageMode = () => adapter.capabilities.barrage!.setMode!(getState().barrageMode);
      // 立刻试一次；斗鱼播放器 DOM 异步加载，加几次重试。
      applyBarrageMode();
      setTimeout(applyBarrageMode, 1000);
      setTimeout(applyBarrageMode, 3000);
    }

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

        // WXT 默认注入的 `:host { all: initial !important }` 会胜过 inline !important。
        // 在 shadow root 内追加一条 :host 规则覆盖（源码顺序在后，同特异性 + 同 !important，后者胜）。
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

    // 自愈：斗鱼首次加载时会同步替换 [class*="video__"] 元素（旧节点 remove + 新节点 add 在同一
    // tick 内完成）。WXT autoMount 的 customMatcher 每次 document.querySelector，永远能查到
    // 某个 video__ 元素，detector(isNotExist) 始终为假 → 不触发 unmount，host 永远孤悬在已被
    // detach 的旧节点里。这里独立监听：发现 host 失联 + 当前文档里有新 anchor，主动 remove +
    // 重新 autoMount。
    let healing = false;
    const healIfStale = () => {
      if (healing) return;
      if (!shadowHostEl || shadowHostEl.isConnected) return;
      const newAnchor = document.querySelector(adapter.anchor as string);
      if (!newAnchor) return;
      healing = true;
      try {
        ui.remove();
        ui.autoMount();
      } finally {
        healing = false;
      }
    };
    const healingObserver = new MutationObserver(healIfStale);
    healingObserver.observe(document.body, { childList: true, subtree: true });
    ctx.onInvalidated(() => healingObserver.disconnect());
  },
});
