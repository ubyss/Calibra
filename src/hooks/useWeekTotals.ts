import { parseISO } from 'date-fns';
import { useMemo } from 'react';

import type { Worklog } from '@/types/domain';
import type { JiraRemoteWorklog } from '@/types/jira';
import { getWeekDays, toDateKey } from '@/utils/date';

export interface DayTotal {
  date: Date;
  dateKey: string;
  totalSeconds: number;
}

export interface WeekTotals {
  days: DayTotal[];
  todaySeconds: number;
  weekSeconds: number;
  pendingCount: number;
}

function accumulateSeconds(
  secondsByDay: Map<string, number>,
  startedAt: string,
  durationSeconds: number,
): void {
  const dateKey = toDateKey(parseISO(startedAt));
  if (!dateKey) {
    return;
  }
  secondsByDay.set(dateKey, (secondsByDay.get(dateKey) ?? 0) + durationSeconds);
}

export function useWeekTotals(
  worklogs: Worklog[],
  remoteWorklogs: JiraRemoteWorklog[] = [],
  reference = new Date(),
): WeekTotals {
  const referenceKey = toDateKey(reference);

  return useMemo(() => {
    const secondsByDay = new Map<string, number>();
    const localJiraIds = new Set(worklogs.map((worklog) => worklog.jiraWorklogId).filter(Boolean));

    worklogs.forEach((worklog) => {
      accumulateSeconds(secondsByDay, worklog.startedAt, worklog.durationSeconds);
    });

    remoteWorklogs.forEach((remote) => {
      if (localJiraIds.has(remote.id)) {
        return;
      }
      accumulateSeconds(secondsByDay, remote.startedAt, remote.durationSeconds);
    });

    const days = getWeekDays(parseISO(referenceKey)).map((date) => {
      const dateKey = toDateKey(date);
      return { date, dateKey, totalSeconds: secondsByDay.get(dateKey) ?? 0 };
    });

    return {
      days,
      todaySeconds: secondsByDay.get(referenceKey) ?? 0,
      weekSeconds: days.reduce((sum, day) => sum + day.totalSeconds, 0),
      pendingCount: worklogs.filter((worklog) => worklog.status === 'pending').length,
    };
  }, [worklogs, remoteWorklogs, referenceKey]);
}
