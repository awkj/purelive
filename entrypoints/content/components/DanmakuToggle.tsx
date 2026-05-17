import { useStoreSelect, setState, BARRAGE_MODES, type BarrageMode } from '../state';
import type { BarrageCap } from '../sites/types';
import { IconDanmakuOn, IconDanmakuOff } from './icons';

interface Props {
  cap: BarrageCap;
  disabled?: boolean;
}

export default function DanmakuToggle({ cap, disabled }: Props) {
  const hideBarrage = useStoreSelect((s) => s.hideBarrage);
  const barrageMode = useStoreSelect((s) => s.barrageMode);

  const toggleHide = () => setState({ hideBarrage: !hideBarrage });

  const pickMode = (m: BarrageMode) => {
    setState({ barrageMode: m });
    cap.setMode?.(m);
  };

  return (
    <div className="relative flex items-center group">
      <button
        onClick={toggleHide}
        disabled={disabled}
        title="弹幕（hover 选择区域）"
        className={`inline-flex items-center justify-center w-[38px] h-[38px] rounded-[10px] cursor-pointer transition-all duration-150 shrink-0 hover:bg-white/10 hover:text-white active:scale-92 disabled:opacity-30 disabled:pointer-events-none ${hideBarrage ? 'text-white/50' : 'text-white/88'}`}
      >
        {hideBarrage ? <IconDanmakuOff /> : <IconDanmakuOn />}
      </button>

      {/* popover 紧贴 button 顶部（无间隙），用 padding 而非 margin 撑视觉间距，
          这样鼠标从 button 向上滑能连续命中 group:hover，不会因为穿越透明 gap 而关闭 */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 pb-2 opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all duration-200 z-10">
        <div className="flex flex-col items-stretch min-w-[88px] bg-[rgba(20,20,20,0.85)] backdrop-blur-[24px] rounded-xl p-1 border border-white/6 shadow-[0_8px_32px_rgba(0,0,0,0.45)]">
          <div className="text-[10px] text-white/40 px-2 py-1 select-none">弹幕区域</div>
          {BARRAGE_MODES.map((m) => (
            <button
              key={m}
              onClick={(e) => { e.stopPropagation(); pickMode(m); }}
              className={`text-[12px] text-left px-2 py-1.5 rounded-md transition-colors cursor-pointer ${barrageMode === m ? 'bg-[#3ea6ff]/15 text-[#3ea6ff]' : 'text-white/80 hover:bg-white/8'}`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
