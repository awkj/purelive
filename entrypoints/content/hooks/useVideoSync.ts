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

    function bind() {
      el = video!.getVideo();
      if (!el) {
        retryTimer = window.setTimeout(bind, 1000);
        return;
      }
      el.addEventListener('play', onSync!);
      el.addEventListener('pause', onSync!);
      el.addEventListener('playing', onSync!);
      el.addEventListener('volumechange', onSync!);
      onSync!();
    }

    bind();

    return () => {
      clearTimeout(retryTimer);
      if (el) {
        el.removeEventListener('play', onSync!);
        el.removeEventListener('pause', onSync!);
        el.removeEventListener('playing', onSync!);
        el.removeEventListener('volumechange', onSync!);
      }
    };
  }, [video, onSync]);
}
