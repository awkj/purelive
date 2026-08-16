import { MATCH_PATTERNS } from './sites/site-patterns';
import { startRuntime, type RuntimeHandle } from './runtime';

const STOP_MESSAGE = 'purelive:stop';

export default defineContentScript({
  matches: MATCH_PATTERNS,
  registration: 'runtime',
  runAt: 'document_end',
  cssInjectionMode: 'ui',

  async main(ctx) {
    let stopped = false;
    let runtime: RuntimeHandle | null = null;

    const stop = () => {
      if (stopped) return;
      stopped = true;
      runtime?.stop();
      runtime = null;
      try {
        browser.runtime.onMessage.removeListener(onMessage);
        browser.storage.onChanged.removeListener(onStorageChanged);
      } catch {}
    };

    const onMessage = (message: unknown) => {
      if (
        typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message.type === STOP_MESSAGE
      ) {
        stop();
      }
    };

    const onStorageChanged = (
      changes: Record<string, { newValue?: unknown }>,
      areaName: string,
    ) => {
      if (areaName === 'local' && changes.enabled?.newValue === false) stop();
    };

    browser.runtime.onMessage.addListener(onMessage);
    browser.storage.onChanged.addListener(onStorageChanged);
    ctx.onInvalidated(() => {
      stop();
    });

    const startedRuntime = await startRuntime(ctx);
    if (stopped || ctx.isInvalid) {
      startedRuntime?.stop();
      return;
    }
    runtime = startedRuntime;
  },
});
