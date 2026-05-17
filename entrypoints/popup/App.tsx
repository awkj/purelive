import { useState, useEffect } from 'react';

export default function App() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    browser.storage.local.get('enabled').then((r) => {
      setEnabled(r.enabled !== false);
    });
  }, []);

  const toggle = async () => {
    const next = !enabled;
    setEnabled(next);
    await browser.storage.local.set({ enabled: next });
  };

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-3">
        <img src="/icon/48.png" className="w-8 h-8" />
        <div>
          <div className="text-sm font-semibold">沉浸式直播</div>
          <div className="text-xs text-white/40">PureLive</div>
        </div>
      </div>

      <button
        onClick={toggle}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          enabled
            ? 'bg-[#3ea6ff]/15 text-[#3ea6ff] hover:bg-[#3ea6ff]/25'
            : 'bg-white/5 text-white/50 hover:bg-white/10'
        }`}
      >
        <span>{enabled ? '已开启' : '已关闭'}</span>
        <div
          className={`relative w-10 h-[22px] rounded-full transition-colors ${
            enabled ? 'bg-[#3ea6ff]' : 'bg-white/20'
          }`}
        >
          <div
            className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow transition-transform ${
              enabled ? 'translate-x-[20px]' : 'translate-x-0.5'
            }`}
          />
        </div>
      </button>

      <p className="text-[11px] text-white/30 mt-3 text-center">
        在支持的直播 / 录播页面自动生效
      </p>
    </div>
  );
}
