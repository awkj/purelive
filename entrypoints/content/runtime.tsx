import ReactDOM from 'react-dom/client';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { injectGlobalStyles, removeGlobalStyles, applyModeClasses } from './global-styles';
import {
  getState,
  setState,
  subscribe,
  loadPersistedState,
  persistState,
} from './state';
import { setupIdleTracking, teardownIdleTracking } from './idle-tracking';
import { getCurrentAdapter } from './sites/site-loader';
import { AdapterProvider } from './sites/AdapterContext';
import Controller from './components/Controller';
import './styles/controller.css';

export type RuntimeHandle = { stop: () => void };

export async function startRuntime(ctx: ContentScriptContext): Promise<RuntimeHandle | null> {
  const adapter = getCurrentAdapter();
  if (!adapter) return null;

  await loadPersistedState();
  if (!getState().enabled || ctx.isInvalid) return null;

  let stopped = false;
  let shadowHostEl: HTMLElement | null = null;
  const barrageTimers: number[] = [];

  injectGlobalStyles(adapter.globalCss);
  applyModeClasses(getState());
  adapter.activate?.();

  if (adapter.capabilities.barrage?.setMode) {
    const applyBarrageMode = () => {
      if (!stopped) adapter.capabilities.barrage!.setMode!(getState().barrageMode);
    };
    applyBarrageMode();
    barrageTimers.push(window.setTimeout(applyBarrageMode, 1000));
    barrageTimers.push(window.setTimeout(applyBarrageMode, 3000));
  }

  function syncShadowHostVisibility() {
    if (!shadowHostEl) return;
    if (getState().enabled) shadowHostEl.removeAttribute('data-pl-hidden');
    else shadowHostEl.setAttribute('data-pl-hidden', '');
  }

  const unsubscribeState = subscribe(() => {
    if (stopped || ctx.isInvalid) return;
    const state = getState();
    applyModeClasses(state);
    persistState();
    syncShadowHostVisibility();
  });

  const onFullscreenChange = () => {
    if (!document.fullscreenElement && getState().mode === 'fullscreen') {
      setState({ mode: 'centered' });
    }
  };
  document.addEventListener('fullscreenchange', onFullscreenChange);

  const ui = await createShadowRootUi(ctx, {
    name: 'pl-controller',
    position: 'inline',
    anchor: adapter.anchor,
    isolateEvents: true,
    onMount(container, shadow, shadowHost) {
      if (stopped) return null;
      shadowHostEl = shadowHost;

      // WXT 默认注入的 `:host { all: initial !important }` 会胜过 inline !important。
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
      shadow.appendChild(hostStyle);

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
      teardownIdleTracking();
      root?.unmount();
    },
  });

  if (stopped || ctx.isInvalid) {
    ui.remove();
    unsubscribeState();
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    adapter.deactivate?.();
    removeGlobalStyles();
    return null;
  }

  ui.autoMount();

  // 斗鱼会同步替换播放器 anchor。host 失联后主动重新挂载到新节点。
  let healing = false;
  const healIfStale = () => {
    if (stopped || healing || !shadowHostEl || shadowHostEl.isConnected) return;
    const newAnchor = document.querySelector(adapter.anchor);
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

  const stop = () => {
    if (stopped) return;
    stopped = true;
    barrageTimers.forEach((timer) => window.clearTimeout(timer));
    healingObserver.disconnect();
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    unsubscribeState();
    ui.remove();
    teardownIdleTracking();
    adapter.deactivate?.();
    applyModeClasses({ ...getState(), enabled: false });
    removeGlobalStyles();
  };

  return { stop };
}
