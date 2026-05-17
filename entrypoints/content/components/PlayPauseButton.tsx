import { useStoreSelect } from '../state';
import type { PlayPauseCap } from '../sites/types';
import { IconPlay, IconPause } from './icons';

interface Props {
  cap: PlayPauseCap;
  disabled?: boolean;
}

export default function PlayPauseButton({ cap, disabled }: Props) {
  const isPlaying = useStoreSelect((s) => s.isPlaying);

  return (
    <button
      onClick={() => cap.click()}
      disabled={disabled}
      title="播放/暂停"
      className="inline-flex items-center justify-center w-[38px] h-[38px] rounded-[10px] text-white/88 cursor-pointer transition-all duration-150 shrink-0 hover:bg-white/10 hover:text-white active:scale-92 disabled:opacity-30 disabled:pointer-events-none"
    >
      {isPlaying ? <IconPause /> : <IconPlay />}
    </button>
  );
}
