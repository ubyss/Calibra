import { readStorage, updateStorage, writeStorage } from '@/services/storage';
import { createWorklog } from '@/services/worklog-service';
import type { RunningTimer, Worklog } from '@/types/domain';
import { roundSeconds } from '@/utils/duration';

export function getElapsedSeconds(timer: RunningTimer, now = Date.now()): number {
  const runningSeconds = timer.resumedAt ? (now - new Date(timer.resumedAt).getTime()) / 1000 : 0;
  return timer.accumulatedSeconds + runningSeconds;
}

export async function startTimer(issueKey: string, issueSummary?: string): Promise<void> {
  const current = await readStorage('timer');
  if (current) {
    await stopTimer();
  }

  const now = new Date().toISOString();
  await writeStorage('timer', {
    issueKey,
    issueSummary,
    comment: '',
    startedAt: now,
    accumulatedSeconds: 0,
    resumedAt: now,
    isAutoPaused: false,
  });
}

export async function pauseTimer(isAutoPaused = false): Promise<void> {
  await updateStorage('timer', (timer) => {
    if (!timer?.resumedAt) {
      return timer;
    }
    return { ...timer, accumulatedSeconds: getElapsedSeconds(timer), resumedAt: null, isAutoPaused };
  });
}

export async function resumeTimer(onlyIfAutoPaused = false): Promise<void> {
  await updateStorage('timer', (timer) => {
    if (!timer || timer.resumedAt || (onlyIfAutoPaused && !timer.isAutoPaused)) {
      return timer;
    }
    return { ...timer, resumedAt: new Date().toISOString(), isAutoPaused: false };
  });
}

export async function updateTimerComment(comment: string): Promise<void> {
  await updateStorage('timer', (timer) => (timer ? { ...timer, comment } : timer));
}

export async function stopTimer(): Promise<Worklog | null> {
  const timer = await readStorage('timer');
  if (!timer) {
    return null;
  }

  const settings = await readStorage('settings');
  await writeStorage('timer', null);

  return createWorklog({
    issueKey: timer.issueKey,
    issueSummary: timer.issueSummary,
    startedAt: timer.startedAt,
    durationSeconds: roundSeconds(getElapsedSeconds(timer), settings.roundToMinutes),
    comment: timer.comment,
  });
}

export async function discardTimer(): Promise<void> {
  await writeStorage('timer', null);
}
