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
  qualityLabel: '原画2K60',
  isIdle: false,
};

let state: DycState = { ...DEFAULT_STATE };
const listeners = new Set<() => void>();

export function getState(): DycState {
  return state;
}

export function setState(partial: Partial<DycState>) {
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
    setState({
      mode: m === 'centered' || m === 'page' || m === 'fullscreen' ? m : 'centered',
      hideBarrage: Boolean(stored.hideBarrage),
      barrageMode: (BARRAGE_MODES as string[]).includes(bm) ? (bm as BarrageMode) : '1/4屏',
      enabled: stored.enabled !== false,
    });
  } catch {}
}

export function persistState() {
  const { mode, hideBarrage, barrageMode, enabled } = getState();
  browser.storage.local.set({ mode, hideBarrage, barrageMode, enabled }).catch(() => {});
}
