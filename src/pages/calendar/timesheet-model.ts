import {
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isValid,
  isWeekend,
  parse,
  parseISO,
  startOfMonth,
} from 'date-fns';

import type { Worklog } from '@/types/domain';
import type { JiraRemoteWorklog } from '@/types/jira';
import { toDateKey } from '@/utils/date';

function toValidDateKey(isoDate: string): string | null {
  const parsed = parseISO(isoDate);
  const dateKey = toDateKey(parsed);
  return dateKey || null;
}

export type TimesheetDayStatus = 'green' | 'orange' | 'pink' | 'neutral';

export type TimesheetDayEntry = {
  date: string;
  totalSeconds: number;
  status: TimesheetDayStatus;
  isWeekend: boolean;
};

export type TimesheetRangeMode = 'week' | 'month';

export const TIMESHEET_WEEKDAY_LABELS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'] as const;

type TimedEntry = {
  startedAt: string;
  durationSeconds: number;
};

function parseDateKey(value: string): Date | null {
  const parsed = parse(value, 'yyyy-MM-dd', new Date());
  return isValid(parsed) ? parsed : null;
}

export function formatTimesheetClock(seconds: number): string {
  const totalMinutes = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}`;
}

export function getTimesheetDayStatus(
  totalSeconds: number,
  isWeekendDay: boolean,
  dailyTargetHours: number,
): TimesheetDayStatus {
  if (isWeekendDay) {
    return 'neutral';
  }

  const targetSeconds = dailyTargetHours * 3600;
  const overageCeiling = (dailyTargetHours + 1) * 3600;

  if (totalSeconds < targetSeconds || totalSeconds > overageCeiling) {
    return 'pink';
  }
  if (totalSeconds > targetSeconds) {
    return 'orange';
  }
  return 'green';
}

export function buildTimesheetDays(
  entries: TimedEntry[],
  rangeFrom: string,
  rangeTo: string,
  dailyTargetHours: number,
): TimesheetDayEntry[] {
  const start = parseDateKey(rangeFrom);
  const end = parseDateKey(rangeTo);
  if (!start || !end || start > end) {
    return [];
  }

  const secondsByDay = new Map<string, number>();
  for (const entry of entries) {
    const dateKey = toValidDateKey(entry.startedAt);
    if (!dateKey) {
      continue;
    }
    secondsByDay.set(dateKey, (secondsByDay.get(dateKey) ?? 0) + entry.durationSeconds);
  }

  return eachDayOfInterval({ start, end }).map((day) => {
    const dateKey = toDateKey(day);
    const totalSeconds = secondsByDay.get(dateKey) ?? 0;
    const isWeekendDay = isWeekend(day);
    return {
      date: dateKey,
      totalSeconds,
      status: getTimesheetDayStatus(totalSeconds, isWeekendDay, dailyTargetHours),
      isWeekend: isWeekendDay,
    };
  });
}

export function buildMonthCalendarWeeks(
  rangeFrom: string,
  dayEntries: TimesheetDayEntry[],
  dailyTargetHours: number,
): (TimesheetDayEntry | null)[][] {
  const monthAnchor = parseDateKey(rangeFrom);
  if (!monthAnchor) {
    return [];
  }

  const monthStart = startOfMonth(monthAnchor);
  const monthEnd = endOfMonth(monthAnchor);
  const dayMap = new Map(dayEntries.map((day) => [day.date, day]));
  const leadingEmptyCells = (getDay(monthStart) + 6) % 7;
  const cells: (TimesheetDayEntry | null)[] = [];

  for (let index = 0; index < leadingEmptyCells; index += 1) {
    cells.push(null);
  }

  for (const day of eachDayOfInterval({ start: monthStart, end: monthEnd })) {
    const dateKey = toDateKey(day);
    const existing = dayMap.get(dateKey);
    if (existing) {
      cells.push(existing);
      continue;
    }

    const isWeekendDay = isWeekend(day);
    cells.push({
      date: dateKey,
      totalSeconds: 0,
      status: getTimesheetDayStatus(0, isWeekendDay, dailyTargetHours),
      isWeekend: isWeekendDay,
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const weeks: (TimesheetDayEntry | null)[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }

  return weeks;
}

export function collectTimedEntries(
  worklogs: Worklog[],
  remoteWorklogs: JiraRemoteWorklog[] = [],
): TimedEntry[] {
  const localIds = new Set(worklogs.map((worklog) => worklog.jiraWorklogId).filter(Boolean));
  const remoteOnly = remoteWorklogs.filter((remote) => !localIds.has(remote.id));

  return [
    ...worklogs
      .filter((worklog) => Boolean(toValidDateKey(worklog.startedAt)))
      .map((worklog) => ({
        startedAt: worklog.startedAt,
        durationSeconds: worklog.durationSeconds,
      })),
    ...remoteOnly
      .filter((remote) => Boolean(toValidDateKey(remote.startedAt)))
      .map((remote) => ({
        startedAt: remote.startedAt,
        durationSeconds: remote.durationSeconds,
      })),
  ];
}

export function getMonthRangeKeys(reference: Date): { from: string; to: string } {
  return {
    from: format(startOfMonth(reference), 'yyyy-MM-dd'),
    to: format(endOfMonth(reference), 'yyyy-MM-dd'),
  };
}
