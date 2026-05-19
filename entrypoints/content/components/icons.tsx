const I = (d: string) => (
  <svg viewBox="0 0 24 24" className="w-[22px] h-[22px] fill-current">
    <path d={d} />
  </svg>
);

export const IconPlay = () => I('M8 5.14v14l11-7z');
export const IconPause = () => I('M6 4h4v16H6zm8 0h4v16h-4z');

export const IconDanmakuOn = () => (
  <svg viewBox="0 0 24 24" className="w-[22px] h-[22px] fill-current">
    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12zM7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z" />
  </svg>
);

export const IconDanmakuOff = () => (
  <svg viewBox="0 0 24 24" className="w-[22px] h-[22px] fill-current">
    <path d="M1.39 2.81l1.42-1.42L21.39 20l-1.42 1.41zM20 2H4c-1.1 0-2 .9-2 2v.17l2 2V4h14.17l2 2H20V15.17l2 2V4c0-1.1-.9-2-2-2zM5.17 16L4 17.17V7.83l2 2V12h.17l2 2H7v-1.83l-1.83-1.83V16h-.01zM13 9h2v2h-1.17L13 10.17V9zm-2 2v-.17L10.17 10H11v1zm9 5V6.83L15.17 2H4l2 2h10v12z" />
  </svg>
);

export const IconCentered = () => I('M3 3h18v18H3V3zm2 2v14h14V5H5zm3 3h8v8H8V8z');

export const IconCinema = () => I('M2 4h20v16H2V4zm2 2v12h16V6H4zm1 1h14v2H5V7zm0 8h14v2H5v-2z');

export const IconFullscreen = () => I(
  'M21 11V3h-8l3.29 3.29-10 10L3 13v8h8l-3.29-3.29 10-10z'
);

export const IconFullscreenExit = () => I(
  'M22 3.41L16.71 8.7 20 12h-8V4l3.29 3.29L20.59 2 22 3.41zM3.41 22l5.29-5.29L12 20v-8H4l3.29 3.29L2 20.59 3.41 22z'
);

export const IconVolHigh = () => I('M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z');

export const IconVolLow = () => I('M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z');

export const IconVolMute = () => I('M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z');

export const IconPower = () => I('M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42C17.99 7.86 19 9.81 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.58-5.42L6.17 5.17C4.23 6.82 3 9.26 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83z');
