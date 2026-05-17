import { getState, setState } from './state';

const IDLE_TIMEOUT = 3000;
let timer: number | undefined;
let barHovered = false;
let cursorHideCallback: ((hidden: boolean) => void) | undefined;

function show() {
  if (!getState().enabled) return;
  setState({ isIdle: false });
  cursorHideCallback?.(false);
}

function hide() {
  if (barHovered) return;
  setState({ isIdle: true });
  cursorHideCallback?.(true);
}

function resetTimer() {
  if (timer) clearTimeout(timer);
  timer = window.setTimeout(hide, IDLE_TIMEOUT);
}

export function markBarHover(hovered: boolean) {
  barHovered = hovered;
  if (hovered) {
    if (timer) clearTimeout(timer);
  } else {
    resetTimer();
  }
}

export function setupIdleTracking(
  videoContainer: Element,
  onCursorHide?: (hidden: boolean) => void,
) {
  cursorHideCallback = onCursorHide;

  videoContainer.addEventListener('mousemove', () => {
    show();
    resetTimer();
  });
  videoContainer.addEventListener('mouseenter', () => {
    show();
    resetTimer();
  });
  videoContainer.addEventListener('mouseleave', () => {
    if (timer) clearTimeout(timer);
    hide();
  });
}

export function teardownIdleTracking() {
  if (timer) clearTimeout(timer);
  cursorHideCallback = undefined;
}
