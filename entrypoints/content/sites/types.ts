// entrypoints/content/sites/types.ts
// Site adapter 抽象层的类型契约。各 capability 都是可选的；adapter 只声明能提供的。

export type VideoCap = {
  getVideo: () => HTMLVideoElement | null;
};

export type PlayPauseCap = {
  click: () => void;
};

export type VolumeCap = {
  set: (v: number) => void;
  toggleMute: () => void;
};

export type QualityCap = {
  read: () => string;
  autoSelect: (preferences: string[]) => void;
};

export type BarrageCap = {
  setHidden: (hidden: boolean) => void;
  setMode?: (modeLabel: string) => void;
};

export type FullscreenCap = {
  request: () => void;
  exit: () => void;
};

export type CursorHideCap = {
  setHidden: (hidden: boolean) => void;
};

export type ModeSwitchCap = true;

export interface SiteCapabilities {
  video?: VideoCap;
  playPause?: PlayPauseCap;
  volume?: VolumeCap;
  quality?: QualityCap;
  barrage?: BarrageCap;
  fullscreen?: FullscreenCap;
  cursorHide?: CursorHideCap;
  modeSwitch?: ModeSwitchCap;
}

export interface SiteAdapter {
  id: string;
  match: { hosts: string[]; path?: RegExp };
  globalCss: string;
  anchor: string;
  capabilities: SiteCapabilities;
}
