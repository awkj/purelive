import { useEffect, useState } from 'react';

export default function App() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (typeof browser === 'undefined' || !browser.storage?.local) return;

    browser.storage.local.get('enabled').then((r) => {
      setEnabled(r.enabled !== false);
    });

    const handleStorageChange = (changes: Record<string, Browser.storage.StorageChange>) => {
      if (changes.enabled) setEnabled(changes.enabled.newValue !== false);
    };
    browser.storage.onChanged.addListener(handleStorageChange);
    return () => browser.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  const toggle = async () => {
    const next = !enabled;
    setEnabled(next);
    if (typeof browser !== 'undefined' && browser.storage?.local) {
      await browser.storage.local.set({ enabled: next });
    }
  };

  return (
    <main className={`popup-shell ${enabled ? 'is-enabled' : 'is-disabled'}`}>
      <div className="ambient ambient-top" aria-hidden="true" />
      <div className="ambient ambient-bottom" aria-hidden="true" />

      <header className="brand-row">
        <div className="logo-wrap">
          <img src="/icon/48.png" className="logo" alt="" />
        </div>
        <div className="brand-copy">
          <h1>沉浸式直播</h1>
          <p>PURELIVE</p>
        </div>
        <div className="status-pill" aria-label={enabled ? '当前已开启' : '当前已关闭'}>
          <span className="status-dot" />
          {enabled ? '运行中' : '已暂停'}
        </div>
      </header>

      <button
        type="button"
        onClick={toggle}
        className="mode-card"
        aria-pressed={enabled}
        aria-label={enabled ? '关闭沉浸模式' : '开启沉浸模式'}
      >
        <span className="mode-copy">
          <span className="mode-title">{enabled ? '沉浸模式已开启' : '开启沉浸模式'}</span>
          <span className="mode-description">
            {enabled ? '正在净化页面并接管播放控制' : '还原直播画面与简洁控制体验'}
          </span>
        </span>
        <span className="switch" aria-hidden="true">
          <span className="switch-thumb" />
        </span>
      </button>

      <footer>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2.5 14.8 8l6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 8.9 9.2 8 12 2.5Z" />
        </svg>
        在支持的直播与录播页面自动生效
      </footer>
    </main>
  );
}
