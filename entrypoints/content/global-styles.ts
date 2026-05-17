// 注入入口：实际 CSS 字符串由 adapter 提供，由调用方传入。

import type { DycState } from './state';

const STYLE_ID = 'pl-injected-style';

export function injectGlobalStyles(css: string) {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);
}

export function removeGlobalStyles() {
  document.getElementById(STYLE_ID)?.remove();
}

export function applyModeClasses(s: Pick<DycState, 'mode' | 'hideBarrage' | 'enabled'>) {
  const root = document.documentElement;
  if (s.enabled) {
    root.classList.add('pl-active');
    root.classList.toggle('pl-mode-centered', s.mode === 'centered');
    root.classList.toggle('pl-mode-page', s.mode === 'page');
    root.classList.toggle('pl-mode-fullscreen', s.mode === 'fullscreen');
    root.classList.toggle('pl-hide-barrage', s.hideBarrage);
  } else {
    root.classList.remove(
      'pl-active',
      'pl-mode-centered',
      'pl-mode-page',
      'pl-mode-fullscreen',
      'pl-hide-barrage',
    );
  }
}
