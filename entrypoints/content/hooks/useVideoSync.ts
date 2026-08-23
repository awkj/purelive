import { useEffect } from 'react';
import type { VideoCap } from '../sites/types';

export function useVideoSync(
  video: VideoCap | undefined,
  onSync: (() => void) | undefined,
) {
  useEffect(() => {
    if (!video || !onSync) return;
    let el: HTMLVideoElement | null = null;
    let retryTimer: number;

    function unbind() {
      if (!el) return;
      el.removeEventListener('play', onSync!);
      el.removeEventListener('pause', onSync!);
      el.removeEventListener('playing', onSync!);
      el.removeEventListener('volumechange', onSync!);
      el = null;
    }

    function bind() {
      const next = video!.getVideo();
      // 虎牙切换画质时会替换 <video> 节点。持续低频检查并重绑，避免控制栏
      // 继续显示旧节点的播放、暂停和音量状态。
      if (next !== el) {
        unbind();
        el = next;
        if (el) {
          el.addEventListener('play', onSync!);
          el.addEventListener('pause', onSync!);
          el.addEventListener('playing', onSync!);
          el.addEventListener('volumechange', onSync!);
          onSync!();
        }
      }
      retryTimer = window.setTimeout(bind, 1000);
    }

    bind();

    return () => {
      clearTimeout(retryTimer);
      unbind();
    };
  }, [video, onSync]);
}
