import { MATCH_PATTERNS } from './content/sites/site-patterns';

const RUNTIME_SCRIPT_ID = 'purelive-runtime';
const RUNTIME_SCRIPT_FILE = 'content-scripts/content.js';
const RUNTIME_SCRIPT_PUBLIC_PATH = '/content-scripts/content.js';
const QUALITY_LOCK_SCRIPT_ID = 'purelive-douyu-quality-lock';
const QUALITY_LOCK_SCRIPT_FILE = 'content-scripts/douyu-quality-lock.js';
const QUALITY_LOCK_SCRIPT_PUBLIC_PATH = '/content-scripts/douyu-quality-lock.js';
const CONTENT_SCRIPT_IDS = [QUALITY_LOCK_SCRIPT_ID, RUNTIME_SCRIPT_ID];
const STOP_MESSAGE = 'purelive:stop';
let syncQueue = Promise.resolve();

async function getMatchingTabs() {
  return browser.tabs.query({ url: MATCH_PATTERNS });
}

async function stopOpenPages() {
  const tabs = await getMatchingTabs();
  await Promise.all(
    tabs.map(async ({ id }) => {
      if (id == null) return;
      try {
        await browser.tabs.sendMessage(id, { type: STOP_MESSAGE });
      } catch {
        // 页面可能尚未注入、正在关闭，或是浏览器限制注入的特殊页面。
      }
    }),
  );
}

async function injectOpenPages() {
  const tabs = await getMatchingTabs();
  await Promise.all(
    tabs.map(async ({ id, url }) => {
      if (id == null) return;
      try {
        const isDouyuLive = url
          ? new URL(url).hostname === 'www.douyu.com'
          : false;
        await browser.scripting.executeScript({
          target: { tabId: id },
          // 斗鱼已打开页面先装画质锁再启动 UI；其他站点只注入通用运行时。
          files: isDouyuLive
            ? [QUALITY_LOCK_SCRIPT_PUBLIC_PATH, RUNTIME_SCRIPT_PUBLIC_PATH]
            : [RUNTIME_SCRIPT_PUBLIC_PATH],
        });
      } catch {
        // 标签页可能仍在加载；下次导航会由动态注册项自动注入。
      }
    }),
  );
}

async function registerContentScript() {
  const registrations = await browser.scripting.getRegisteredContentScripts({
    ids: CONTENT_SCRIPT_IDS,
  });
  const definitions = [
    {
      id: QUALITY_LOCK_SCRIPT_ID,
      matches: ['*://www.douyu.com/*'],
      js: [QUALITY_LOCK_SCRIPT_FILE],
      runAt: 'document_start' as const,
      persistAcrossSessions: true,
    },
    {
      id: RUNTIME_SCRIPT_ID,
      matches: MATCH_PATTERNS,
      js: [RUNTIME_SCRIPT_FILE],
      runAt: 'document_end' as const,
      persistAcrossSessions: true,
    },
  ];
  const registeredIds = new Set(registrations.map(({ id }) => id));
  const updates = definitions.filter(({ id }) => registeredIds.has(id));
  const additions = definitions.filter(({ id }) => !registeredIds.has(id));

  if (updates.length > 0) await browser.scripting.updateContentScripts(updates);
  if (additions.length > 0) await browser.scripting.registerContentScripts(additions);
}

async function unregisterContentScript() {
  const registrations = await browser.scripting.getRegisteredContentScripts({
    ids: CONTENT_SCRIPT_IDS,
  });
  if (registrations.length > 0) {
    await browser.scripting.unregisterContentScripts({
      ids: registrations.map(({ id }) => id),
    });
  }
}

async function syncEnabled(injectExistingTabs: boolean) {
  const stored = await browser.storage.local.get('enabled');
  const enabled = stored.enabled !== false;

  if (enabled) {
    await registerContentScript();
    if (injectExistingTabs) await injectOpenPages();
  } else {
    await unregisterContentScript();
    await stopOpenPages();
  }
}

function queueSync(injectExistingTabs: boolean) {
  syncQueue = syncQueue
    .then(() => syncEnabled(injectExistingTabs))
    .catch((error) => {
      console.error('[PureLive] 同步运行状态失败', error);
    });
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    queueSync(true);
  });

  browser.runtime.onStartup.addListener(() => {
    queueSync(false);
  });

  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes.enabled) return;
    queueSync(changes.enabled.newValue !== false);
  });

  // 覆盖扩展热重载、浏览器恢复后台等没有触发 onStartup 的情况。
  queueSync(false);
});
