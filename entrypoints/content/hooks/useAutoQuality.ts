import { useEffect } from 'react';
import { getState, setState } from '../state';
import type { QualityCap } from '../sites/types';

export function useAutoQuality(quality: QualityCap | undefined) {
  useEffect(() => {
    if (!quality) return;
    if (!getState().enabled) return;

    // 立即尝试；若斗鱼画质 DOM 尚未挂载，adapter 会监听其出现并在第一时间选择最高档。
    quality.autoSelectHighest();

    const pollTimer = setInterval(() => {
      // 斗鱼偶尔会在播放器重连后回退画质；周期校正确保默认策略始终是最高档。
      // adapter 会在用户通过自定义菜单手动选档后停止自动校正。
      quality.autoSelectHighest();
      const label = quality.read();
      if (label) setState({ qualityLabel: label });
    }, 3000);

    return () => {
      clearInterval(pollTimer);
    };
  }, [quality]);
}
