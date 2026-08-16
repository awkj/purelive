import { MATCH_PATTERNS } from './content/sites/site-patterns';

const CONTENT_SCRIPT_ID = 'purelive-runtime';
const CONTENT_SCRIPT_FILE = 'content-scripts/content.js';
const CONTENT_SCRIPT_PUBLIC_PATH = '/content-scripts/content.js';
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
    tabs.map(async ({ id }) => {
      if (id == null) return;
      try {
        await browser.scripting.executeScript({
          target: { tabId: id },
          files: [CONTENT_SCRIPT_PUBLIC_PATH],
        });
      } catch {
        // 标签页可能仍在加载；下次导航会由动态注册项自动注入。
      }
    }),
  );
}

async function registerContentScript() {
  const registrations = await browser.scripting.getRegisteredContentScripts({
    ids: [CONTENT_SCRIPT_ID],
  });
  const definition = {
    id: CONTENT_SCRIPT_ID,
    matches: MATCH_PATTERNS,
    js: [CONTENT_SCRIPT_FILE],
    runAt: 'document_end' as const,
    persistAcrossSessions: true,
  };

  if (registrations.length > 0) {
    await browser.scripting.updateContentScripts([definition]);
  } else {
    await browser.scripting.registerContentScripts([definition]);
  }
}

async function unregisterContentScript() {
  const registrations = await browser.scripting.getRegisteredContentScripts({
    ids: [CONTENT_SCRIPT_ID],
  });
  if (registrations.length > 0) {
    await browser.scripting.unregisterContentScripts({ ids: [CONTENT_SCRIPT_ID] });
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
