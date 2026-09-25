import { eachDayOfInterval, parseISO } from 'date-fns';

import type { JiraUserSummary } from '@/types/domain';
import type { JiraRemoteWorklog } from '@/types/jira';
import { toCsv } from '@/utils/csv';
import { formatShortDate, toDateKey } from '@/utils/date';

export interface TeamHoursMatrix {
  days: Date[];
  rows: { user: JiraUserSummary; secondsByDay: Map<string, number>; totalSeconds: number }[];
  issueRows: { key: string; summary: string; secondsByUser: Map<string, number>; totalSeconds: number }[];
  secondsByDay: Map<string, number>;
  totalSeconds: number;
}

export function buildTeamHoursMatrix(
  users: JiraUserSummary[],
  worklogs: JiraRemoteWorklog[],
  from: Date,
  to: Date,
): TeamHoursMatrix {
  const days = eachDayOfInterval({ start: from, end: to });
  const secondsByDay = new Map<string, number>();
  const issues = new Map<string, TeamHoursMatrix['issueRows'][number]>();
  const rows = users.map((user) => ({ user, secondsByDay: new Map<string, number>(), totalSeconds: 0 }));
  const rowsByUser = new Map(rows.map((row) => [row.user.id, row]));

  worklogs.forEach((worklog) => {
    const dateKey = toDateKey(parseISO(worklog.startedAt));
    const row = rowsByUser.get(worklog.authorId);
    if (row) {
      row.secondsByDay.set(dateKey, (row.secondsByDay.get(dateKey) ?? 0) + worklog.durationSeconds);
      row.totalSeconds += worklog.durationSeconds;
    }
    secondsByDay.set(dateKey, (secondsByDay.get(dateKey) ?? 0) + worklog.durationSeconds);

    const issue = issues.get(worklog.issueKey) ?? {
      key: worklog.issueKey,
      summary: worklog.issueSummary,
      secondsByUser: new Map<string, number>(),
      totalSeconds: 0,
    };
    issue.secondsByUser.set(worklog.authorId, (issue.secondsByUser.get(worklog.authorId) ?? 0) + worklog.durationSeconds);
    issue.totalSeconds += worklog.durationSeconds;
    issues.set(worklog.issueKey, issue);
  });

  return {
    days,
    rows,
    issueRows: [...issues.values()].sort((first, second) => second.totalSeconds - first.totalSeconds),
    secondsByDay,
    totalSeconds: rows.reduce((sum, row) => sum + row.totalSeconds, 0),
  };
}

function toHours(seconds: number): string {
  return (seconds / 3600).toFixed(2).replace('.', ',');
}

export function teamHoursToCsv(matrix: TeamHoursMatrix): string {
  const header = ['Pessoa', ...matrix.days.map(formatShortDate), 'Total (h)'];
  const body = matrix.rows.map((row) => [
    row.user.displayName,
    ...matrix.days.map((day) => toHours(row.secondsByDay.get(toDateKey(day)) ?? 0)),
    toHours(row.totalSeconds),
  ]);
  return toCsv([header, ...body]);
}
