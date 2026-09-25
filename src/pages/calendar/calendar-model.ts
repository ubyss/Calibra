import { isValid, parseISO } from 'date-fns';

import type { Worklog } from '@/types/domain';
import type { JiraRemoteWorklog } from '@/types/jira';
import { toDateKey } from '@/utils/date';

export const HOUR_HEIGHT_PX = 100;
export const VISIBLE_START_HOUR = 6;
export const VISIBLE_END_HOUR = 23;
export const SNAP_MINUTES = 15;
export const MIN_DURATION_MINUTES = 15;
export const CARD_SIDE_GUTTER_PX = 3;

export type CalendarEntry =
  | { kind: 'local'; id: string; start: Date; durationSeconds: number; worklog: Worklog }
  | { kind: 'remote'; id: string; start: Date; durationSeconds: number; remote: JiraRemoteWorklog };

export type LaneLayout = {
  entry: CalendarEntry;
  lane: number;
  laneCount: number;
};

type LayoutItem = {
  id: string;
  startMs: number;
  endMs: number;
  entry: CalendarEntry;
};

const PROJECT_COLORS = ['#5b5bd6', '#1f9d63', '#b7791f', '#d4413f', '#0b6e99', '#7a5af8', '#216e4e'];

export function snapMinutes(minutes: number): number {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}

export function minutesToPixels(minutes: number): number {
  return (minutes / 60) * HOUR_HEIGHT_PX;
}

export function pixelsToMinutes(pixels: number): number {
  return (pixels / HOUR_HEIGHT_PX) * 60;
}

export function minutesFromVisibleStart(date: Date): number {
  return date.getHours() * 60 + date.getMinutes() - VISIBLE_START_HOUR * 60;
}

export function projectColorFromKey(issueKey: string): string {
  const project = issueKey.split('-')[0] ?? issueKey;
  let hash = 0;
  for (let index = 0; index < project.length; index += 1) {
    hash = (hash * 31 + project.charCodeAt(index)) >>> 0;
  }
  return PROJECT_COLORS[hash % PROJECT_COLORS.length];
}

export function buildCalendarEntries(worklogs: Worklog[], remoteWorklogs: JiraRemoteWorklog[]): CalendarEntry[] {
  const localJiraIds = new Set(worklogs.map((worklog) => worklog.jiraWorklogId).filter(Boolean));
  const localEntries: CalendarEntry[] = worklogs
    .map((worklog) => {
      const start = parseISO(worklog.startedAt);
      if (!isValid(start)) {
        return null;
      }
      return {
        kind: 'local' as const,
        id: worklog.id,
        start,
        durationSeconds: worklog.durationSeconds,
        worklog,
      };
    })
    .filter((entry): entry is Extract<CalendarEntry, { kind: 'local' }> => entry !== null);

  const remoteEntries: CalendarEntry[] = remoteWorklogs
    .filter((remote) => !localJiraIds.has(remote.id))
    .map((remote) => {
      const start = parseISO(remote.startedAt);
      if (!isValid(start)) {
        return null;
      }
      return {
        kind: 'remote' as const,
        id: `remote-${remote.id}`,
        start,
        durationSeconds: remote.durationSeconds,
        remote,
      };
    })
    .filter((entry): entry is Extract<CalendarEntry, { kind: 'remote' }> => entry !== null);

  return [...localEntries, ...remoteEntries];
}

export function groupEntriesByDay(entries: CalendarEntry[]): Map<string, CalendarEntry[]> {
  const byDay = new Map<string, CalendarEntry[]>();
  entries.forEach((entry) => {
    const dateKey = toDateKey(entry.start);
    if (!dateKey) {
      return;
    }
    byDay.set(dateKey, [...(byDay.get(dateKey) ?? []), entry]);
  });
  return byDay;
}

/**
 * Colunas lado a lado para worklogs no mesmo horário.
 * Eventos sequenciais (ex.: 09:00–09:15 e 09:15–09:30) ficam um abaixo do outro.
 */
export function layoutOverlappingEntries(entries: CalendarEntry[]): LaneLayout[] {
  if (entries.length === 0) {
    return [];
  }

  const items: LayoutItem[] = entries.map((entry) => {
    const durationMs = Math.max(entry.durationSeconds, 60) * 1000;
    return {
      id: entry.id,
      startMs: entry.start.getTime(),
      endMs: entry.start.getTime() + durationMs,
      entry,
    };
  });

  const sorted = [...items].sort((left, right) => {
    if (left.startMs !== right.startMs) {
      return left.startMs - right.startMs;
    }
    const durationLeft = left.endMs - left.startMs;
    const durationRight = right.endMs - right.startMs;
    if (durationLeft !== durationRight) {
      return durationRight - durationLeft;
    }
    return left.id.localeCompare(right.id);
  });

  type Active = { id: string; endMs: number; lane: number };
  const active: Active[] = [];
  const assignments = new Map<string, { lane: number; clusterId: number }>();
  let clusterId = 0;
  const clusterLaneCount = new Map<number, number>();

  for (const item of sorted) {
    for (let index = active.length - 1; index >= 0; index -= 1) {
      const current = active[index];
      // Adjacentes (fim == início) não se sobrepõem: um fica abaixo do outro.
      if (current && current.endMs <= item.startMs) {
        active.splice(index, 1);
      }
    }

    if (active.length === 0) {
      clusterId += 1;
    }

    const used = new Set(active.map((entry) => entry.lane));
    let lane = 0;
    while (used.has(lane)) {
      lane += 1;
    }

    active.push({ id: item.id, endMs: item.endMs, lane });
    assignments.set(item.id, { lane, clusterId });
    clusterLaneCount.set(clusterId, Math.max(clusterLaneCount.get(clusterId) ?? 0, lane + 1, active.length));
  }

  return entries.map((entry) => {
    const assignment = assignments.get(entry.id);
    if (!assignment) {
      return { entry, lane: 0, laneCount: 1 };
    }
    return {
      entry,
      lane: assignment.lane,
      laneCount: clusterLaneCount.get(assignment.clusterId) ?? 1,
    };
  });
}

export function getEntryIssue(entry: CalendarEntry): {
  key: string;
  summary: string;
  comment: string;
  issueTypeName: string;
  issueTypeIconUrl?: string;
} {
  if (entry.kind === 'local') {
    return {
      key: entry.worklog.issueKey,
      summary: entry.worklog.issueSummary ?? '',
      comment: entry.worklog.comment,
      issueTypeName: entry.worklog.issueTypeName ?? '',
      issueTypeIconUrl: entry.worklog.issueTypeIconUrl,
    };
  }
  return {
    key: entry.remote.issueKey,
    summary: entry.remote.issueSummary,
    comment: entry.remote.comment,
    issueTypeName: entry.remote.issueTypeName,
    issueTypeIconUrl: entry.remote.issueTypeIconUrl,
  };
}
