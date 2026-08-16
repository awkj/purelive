import { useEffect, useState } from 'react';
import { setState, useStoreSelect } from '../state';
import type { QualityCap } from '../sites/types';

export default function QualityLabel({ cap }: { cap: QualityCap }) {
  const label = useStoreSelect((s) => s.qualityLabel);
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshOptions = async () => {
    setLoading(true);
    try {
      setOptions(await cap.list());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshOptions();
  }, [cap]);

  const pick = async (quality: string) => {
    if (quality === label) return;
    if (await cap.select(quality)) {
      const actual = cap.read();
      if (actual) setState({ qualityLabel: actual });
    }
  };

  return (
    <div className="relative flex items-center group" onMouseEnter={() => void refreshOptions()}>
      <button
        title="选择画质"
        className="inline-flex items-center justify-center min-w-[68px] px-2.5 h-[38px] rounded-[10px] text-[13px] font-medium text-white/70 whitespace-nowrap tracking-wide cursor-pointer transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-[0.97]"
      >
        {label || '自动最高'}
      </button>

      <div className="absolute bottom-full left-1/2 -translate-x-1/2 pb-2 opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all duration-200 z-10">
        <div className="flex flex-col items-stretch min-w-[116px] bg-[rgba(20,20,20,0.88)] backdrop-blur-[24px] rounded-xl p-1 border border-white/6 shadow-[0_8px_32px_rgba(0,0,0,0.45)]">
          <div className="text-[10px] text-white/40 px-2 py-1 select-none">选择画质</div>
          {options.map((quality) => (
            <button
              key={quality}
              onClick={(event) => {
                event.stopPropagation();
                void pick(quality);
              }}
              className={`text-[12px] text-left px-2 py-1.5 rounded-md whitespace-nowrap transition-colors cursor-pointer ${label === quality ? 'bg-[#3ea6ff]/15 text-[#3ea6ff]' : 'text-white/80 hover:bg-white/8'}`}
            >
              {quality}
            </button>
          ))}
          {options.length === 0 && (
            <div className="text-[11px] text-white/35 px-2 py-1.5 whitespace-nowrap">
              {loading ? '读取中…' : '暂无可用画质'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
