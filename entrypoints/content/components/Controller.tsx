import { useCallback } from 'react';
import { useStore, getState, setState } from '../state';
import { useVideoSync } from '../hooks/useVideoSync';
import { useAutoQuality } from '../hooks/useAutoQuality';
import { markBarHover } from '../idle-tracking';
import { useCapabilities } from '../sites/AdapterContext';
import PlayPauseButton from './PlayPauseButton';
import VolumeControl from './VolumeControl';
import DanmakuToggle from './DanmakuToggle';
import QualityLabel from './QualityLabel';
import ModeButtons from './ModeButtons';
import Separator from './Separator';
import DisableButton from './DisableButton';

const GLASS_BAR =
  "flex items-center gap-0.5 py-1.5 px-2.5 rounded-[14px] bg-[rgba(20,20,20,0.7)] backdrop-blur-[24px] saturate-200 border border-white/6 shadow-[0_8px_32px_rgba(0,0,0,0.45),inset_0_0.5px_0_rgba(255,255,255,0.06)] select-none font-[-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,sans-serif] transition-opacity duration-300 z-[2147483647]";

export default function Controller() {
  const { enabled, isIdle } = useStore();
  const caps = useCapabilities();

  // 把 video 同步逻辑（读 video 写 store）就近定义，避免循环依赖。
  const syncVideoState = useCallback(() => {
    if (!caps.video) return;
    const v = caps.video.getVideo();
    if (!v) return;
    setState({
      isPlaying: !v.paused,
      volume: v.muted ? getState().volume : v.volume,
      muted: v.muted || v.volume === 0,
    });
  }, [caps.video]);

  useVideoSync(caps.video, syncVideoState);
  useAutoQuality(caps.quality);

  if (!enabled) return null;

  const fade = isIdle ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto';

  // 形态判断：没有任何"播放控制"类 capability 但有 modeSwitch → 迷你形态（右上角，始终可见）
  const hasPlaybackControls = caps.playPause || caps.volume || caps.quality || caps.barrage;
  const isMini = !hasPlaybackControls && caps.modeSwitch;

  if (isMini) {
    return (
      <div className={`absolute top-2 right-2 ${GLASS_BAR} opacity-100 pointer-events-auto`}>
        <ModeButtons />
        <Separator />
        <DisableButton />
      </div>
    );
  }

  return (
    <div
      className={`fixed bottom-2 left-1/2 -translate-x-1/2 ${GLASS_BAR} ${fade}`}
      onMouseEnter={() => markBarHover(true)}
      onMouseLeave={() => markBarHover(false)}
    >
      {caps.playPause && <PlayPauseButton cap={caps.playPause} />}
      {caps.volume && <VolumeControl cap={caps.volume} onSync={syncVideoState} />}
      {caps.barrage && <DanmakuToggle cap={caps.barrage} />}
      {(caps.quality || caps.modeSwitch) && <Separator />}
      {caps.quality && <QualityLabel cap={caps.quality} />}
      {caps.modeSwitch && <ModeButtons />}
      <Separator />
      <DisableButton />
    </div>
  );
}
