import { useSyncExternalStore } from 'react';

export type Mode = 'centered' | 'page' | 'fullscreen';
export type BarrageMode = '全屏' | '1/4屏' | '上半屏' | '下半屏';
export const BARRAGE_MODES: BarrageMode[] = ['全屏', '1/4屏', '上半屏', '下半屏'];

export interface DycState {
  mode: Mode;
  hideBarrage: boolean;
  barrageMode: BarrageMode;
  enabled: boolean;
  volume: number;
  muted: boolean;
  isPlaying: boolean;
  qualityLabel: string;
  isIdle: boolean;
}

const DEFAULT_STATE: DycState = {
  mode: 'centered',
  hideBarrage: false,
  barrageMode: '1/4屏',
  enabled: true,
  volume: 1,
  muted: false,
  isPlaying: false,
  // 由斗鱼播放器 DOM 同步真实值；不能预填最高画质，否则播放器加载期间会短暂显示假状态。
  qualityLabel: '',
  isIdle: false,
};

let state: DycState = { ...DEFAULT_STATE };
const listeners = new Set<() => void>();

export function getState(): DycState {
  return state;
}

export function setState(partial: Partial<DycState>) {
  const changed = (Object.keys(partial) as (keyof DycState)[]).some(
    (key) => state[key] !== partial[key],
  );
  if (!changed) return;
  state = { ...state, ...partial };
  listeners.forEach((fn) => fn());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useStore(): DycState {
  return useSyncExternalStore(subscribe, getState);
}

export function useStoreSelect<T>(selector: (s: DycState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(getState()));
}

export async function loadPersistedState() {
  try {
    const stored = await browser.storage.local.get(['mode', 'hideBarrage', 'barrageMode', 'enabled']);
    const m = stored.mode as string;
    const bm = stored.barrageMode as string;
    const persisted = {
      mode: m === 'centered' || m === 'page' || m === 'fullscreen' ? m : 'centered',
      hideBarrage: Boolean(stored.hideBarrage),
      barrageMode: (BARRAGE_MODES as string[]).includes(bm) ? (bm as BarrageMode) : '1/4屏',
      enabled: stored.enabled !== false,
    } satisfies Pick<DycState, 'mode' | 'hideBarrage' | 'barrageMode' | 'enabled'>;
    setState(persisted);
    lastPersistedSnapshot = JSON.stringify(persisted);
  } catch {}
}

let lastPersistedSnapshot = '';

export function persistState() {
  const { mode, hideBarrage, barrageMode, enabled } = getState();
  const persisted = { mode, hideBarrage, barrageMode, enabled };
  const snapshot = JSON.stringify(persisted);
  if (snapshot === lastPersistedSnapshot) return;
  lastPersistedSnapshot = snapshot;
  try {
    // 扩展被重新加载后，旧 content script 调用 API 时可能在返回 Promise 前同步抛错。
    void browser.storage.local.set(persisted).catch(() => {
      // 失败后允许下一次状态通知重试。
      if (lastPersistedSnapshot === snapshot) lastPersistedSnapshot = '';
    });
  } catch {
    if (lastPersistedSnapshot === snapshot) lastPersistedSnapshot = '';
  }
}
