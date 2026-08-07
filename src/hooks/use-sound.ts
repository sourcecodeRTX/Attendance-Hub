'use client';

import { useCallback } from 'react';
import { usePreferencesStore } from '@/lib/stores/preferences-store';

type SoundType = 'success' | 'error' | 'toggle';

const FREQUENCIES: Record<SoundType, number[]> = {
  success: [523.25, 659.25, 783.99],
  error: [311.13, 233.08],
  toggle: [440],
};

export function useSound() {
  const { soundEnabled } = usePreferencesStore();

  const playSound = useCallback((type: SoundType) => {
    if (!soundEnabled) return;

    try {
      const ctx = new AudioContext();
      const frequencies = FREQUENCIES[type];

      frequencies.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.value = 0.1;

        const startTime = ctx.currentTime + i * 0.1;
        osc.start(startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);
        osc.stop(startTime + 0.3);
      });
    } catch {
      // AudioContext not available
    }
  }, [soundEnabled]);

  return { playSound };
}
