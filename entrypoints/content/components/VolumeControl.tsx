import { useStoreSelect } from '../state';
import type { VolumeCap } from '../sites/types';
import { IconVolHigh, IconVolLow, IconVolMute } from './icons';

interface Props {
  cap: VolumeCap;
  onSync: () => void;
  disabled?: boolean;
}

export default function VolumeControl({ cap, onSync, disabled }: Props) {
  const volume = useStoreSelect((s) => s.volume);
  const muted = useStoreSelect((s) => s.muted);

  const displayVol = muted ? 0 : volume;
  const Icon = muted ? IconVolMute : volume < 0.5 ? IconVolLow : IconVolHigh;

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value) / 100;
    cap.set(v);
    onSync();
  };

  return (
    <div className="relative flex items-center group">
      <button
        onClick={() => { cap.toggleMute(); onSync(); }}
        disabled={disabled}
        title={muted ? '取消静音' : '静音'}
        className={`inline-flex items-center justify-center w-[38px] h-[38px] rounded-[10px] cursor-pointer transition-all duration-150 shrink-0 hover:bg-white/10 hover:text-white active:scale-92 disabled:opacity-30 disabled:pointer-events-none ${muted ? 'text-white/50' : 'text-white/88'}`}
      >
        <Icon />
      </button>

      <div className="absolute bottom-full left-1/2 -translate-x-1/2 pb-2 opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all duration-200 z-10">
        <div className="flex flex-col items-center bg-[rgba(20,20,20,0.85)] backdrop-blur-[24px] rounded-xl p-2.5 border border-white/6 shadow-[0_8px_32px_rgba(0,0,0,0.45)]">
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(displayVol * 100)}
            onChange={handleSlider}
            onClick={(e) => e.stopPropagation()}
            className="pl-vslider"
          />
          <span className="text-[11px] text-white/50 mt-1.5 font-medium tabular-nums">
            {Math.round(displayVol * 100)}
          </span>
        </div>
      </div>
    </div>
  );
}
