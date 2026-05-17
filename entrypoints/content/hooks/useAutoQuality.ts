import { useEffect } from 'react';
import { getState, setState } from '../state';
import type { QualityCap } from '../sites/types';

const PREFERENCES = ['原画2K60', '原画', '蓝光8M', '蓝光4M'];

export function useAutoQuality(quality: QualityCap | undefined) {
  useEffect(() => {
    if (!quality) return;
    if (!getState().enabled) return;

    const startTimer = setTimeout(() => quality.autoSelect(PREFERENCES), 500);

    const pollTimer = setInterval(() => {
      const label = quality.read();
      if (label) setState({ qualityLabel: label });
    }, 3000);

    return () => {
      clearTimeout(startTimer);
      clearInterval(pollTimer);
    };
  }, [quality]);
}
