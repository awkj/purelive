import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import { getAllMatchPatterns } from './entrypoints/content/sites/site-loader';

const patterns = getAllMatchPatterns();

export default defineConfig({
  manifest: {
    name: '沉浸式直播 · PureLive',
    description: '沉浸式直播：清理直播 / 录播页面，仅保留播放器与弹幕，支持居中 / 网页全屏 / 真正全屏。',
    permissions: ['storage'],
    host_permissions: patterns,
    action: {},
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  webExt: { disabled: true },
});
