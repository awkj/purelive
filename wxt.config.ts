import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import { MATCH_PATTERNS } from './entrypoints/content/sites/site-patterns';

const patterns = MATCH_PATTERNS;

export default defineConfig({
  manifestVersion: 3,
  manifest: ({ manifestVersion }) => ({
    name: '沉浸式直播 · PureLive',
    description: '沉浸式直播：清理直播 / 录播页面，仅保留播放器与弹幕，支持居中 / 网页全屏 / 真正全屏。',
    permissions: manifestVersion === 3 ? ['storage', 'scripting'] : ['storage'],
    host_permissions: patterns,
    action: {},
  }),
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  webExt: { disabled: true },
});
