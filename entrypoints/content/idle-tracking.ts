import { getState, setState } from './state';

const IDLE_TIMEOUT = 3000;
let timer: number | undefined;
let barHovered = false;
let cursorHideCallback: ((hidden: boolean) => void) | undefined;
let removeListeners: (() => void) | undefined;

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
  teardownIdleTracking();
  cursorHideCallback = onCursorHide;

  const onMouseMove = () => {
    show();
    resetTimer();
  };
  const onMouseEnter = () => {
    show();
    resetTimer();
  };
  const onMouseLeave = () => {
    if (timer) clearTimeout(timer);
    hide();
  };

  videoContainer.addEventListener('mousemove', onMouseMove);
  videoContainer.addEventListener('mouseenter', onMouseEnter);
  videoContainer.addEventListener('mouseleave', onMouseLeave);

  removeListeners = () => {
    videoContainer.removeEventListener('mousemove', onMouseMove);
    videoContainer.removeEventListener('mouseenter', onMouseEnter);
    videoContainer.removeEventListener('mouseleave', onMouseLeave);
  };
}

export function teardownIdleTracking() {
  if (timer) {
    clearTimeout(timer);
    timer = undefined;
  }
  removeListeners?.();
  removeListeners = undefined;
  barHovered = false;
  cursorHideCallback = undefined;
}
