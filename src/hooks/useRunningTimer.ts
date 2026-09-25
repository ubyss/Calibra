import { useNow } from '@/hooks/useNow';
import { useStoredValue } from '@/hooks/useStoredValue';
import { getElapsedSeconds } from '@/services/timer-service';
import type { RunningTimer } from '@/types/domain';

interface RunningTimerState {
  timer: RunningTimer | null;
  elapsedSeconds: number;
  isRunning: boolean;
  isLoaded: boolean;
}

export function useRunningTimer(): RunningTimerState {
  const { value: timer, isLoaded } = useStoredValue('timer');
  const isRunning = Boolean(timer?.resumedAt);
  const now = useNow(1000, isRunning);

  return {
    timer,
    isLoaded,
    isRunning,
    elapsedSeconds: timer ? getElapsedSeconds(timer, now) : 0,
  };
}
