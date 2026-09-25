import { parseISO } from 'date-fns';
import { useMemo } from 'react';

import type { Worklog } from '@/types/domain';
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

export function useWeekTotals(worklogs: Worklog[], reference = new Date()): WeekTotals {
  const referenceKey = toDateKey(reference);

  return useMemo(() => {
    const secondsByDay = new Map<string, number>();
    worklogs.forEach((worklog) => {
      const dateKey = toDateKey(parseISO(worklog.startedAt));
      secondsByDay.set(dateKey, (secondsByDay.get(dateKey) ?? 0) + worklog.durationSeconds);
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
  }, [worklogs, referenceKey]);
}
