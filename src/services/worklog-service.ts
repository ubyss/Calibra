import { JiraClient } from '@/services/jira-client';
import { quoteJql } from '@/services/jira-mappers';
import { readStorage, updateStorage } from '@/services/storage';
import type { JiraUserSummary, Worklog, WorklogDraft } from '@/types/domain';
import type { JiraRemoteWorklog } from '@/types/jira';
import { toDateKey, toJiraDateTime } from '@/utils/date';
import { createId, getErrorMessage, mapWithConcurrency } from '@/utils/misc';

export interface UploadResult {
  uploaded: number;
  failures: { worklog: Worklog; message: string }[];
}

export async function createWorklog(draft: WorklogDraft): Promise<Worklog> {
  const now = new Date().toISOString();
  const worklog: Worklog = { ...draft, id: createId(), status: 'pending', createdAt: now, updatedAt: now };
  await updateStorage('worklogs', (worklogs) => [...worklogs, worklog]);
  return worklog;
}

/** Importa um worklog que só existia no Jira para a base local, permitindo editar/redimensionar. */
export async function adoptRemoteWorklog(remote: JiraRemoteWorklog): Promise<Worklog> {
  const existing = (await readStorage('worklogs')).find((worklog) => worklog.jiraWorklogId === remote.id);
  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const worklog: Worklog = {
    id: createId(),
    issueKey: remote.issueKey,
    issueSummary: remote.issueSummary,
    issueTypeName: remote.issueTypeName,
    startedAt: remote.startedAt,
    durationSeconds: remote.durationSeconds,
    comment: remote.comment,
    status: 'uploaded',
    jiraWorklogId: remote.id,
    createdAt: now,
    updatedAt: now,
  };
  await updateStorage('worklogs', (worklogs) => [...worklogs, worklog]);
  return worklog;
}

export async function createWorklogs(drafts: WorklogDraft[]): Promise<void> {
  const now = new Date().toISOString();
  const created = drafts.map<Worklog>((draft) => ({
    ...draft,
    id: createId(),
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  }));
  await updateStorage('worklogs', (worklogs) => [...worklogs, ...created]);
}

export async function updateWorklog(id: string, changes: Partial<WorklogDraft>): Promise<void> {
  await updateStorage('worklogs', (worklogs) =>
    worklogs.map((worklog): Worklog =>
      worklog.id === id ? { ...worklog, ...changes, status: 'pending', updatedAt: new Date().toISOString() } : worklog,
    ),
  );
}

export async function deleteWorklog(worklog: Worklog): Promise<void> {
  if (worklog.jiraWorklogId) {
    const client = await JiraClient.fromStorage();
    await client.deleteWorklog(worklog.issueKey, worklog.jiraWorklogId);
  }
  await updateStorage('worklogs', (worklogs) => worklogs.filter((item) => item.id !== worklog.id));
}

async function uploadSingle(client: JiraClient, worklog: Worklog): Promise<string> {
  const payload = {
    started: toJiraDateTime(new Date(worklog.startedAt)),
    timeSpentSeconds: worklog.durationSeconds,
    comment: worklog.comment,
  };

  if (worklog.jiraWorklogId) {
    await client.updateWorklog(worklog.issueKey, worklog.jiraWorklogId, payload);
    return worklog.jiraWorklogId;
  }
  return client.addWorklog(worklog.issueKey, payload);
}

export async function uploadWorklogs(ids: string[]): Promise<UploadResult> {
  const client = await JiraClient.fromStorage();
  const worklogs = (await readStorage('worklogs')).filter((worklog) => ids.includes(worklog.id));
  const uploadedIds = new Map<string, string>();
  const failures: UploadResult['failures'] = [];

  await mapWithConcurrency(worklogs, 3, async (worklog) => {
    try {
      uploadedIds.set(worklog.id, await uploadSingle(client, worklog));
    } catch (error) {
      failures.push({ worklog, message: getErrorMessage(error) });
    }
  });

  await updateStorage('worklogs', (current) =>
    current.map((worklog): Worklog => {
      const jiraWorklogId = uploadedIds.get(worklog.id);
      return jiraWorklogId ? { ...worklog, jiraWorklogId, status: 'uploaded' } : worklog;
    }),
  );

  return { uploaded: uploadedIds.size, failures };
}

export async function fetchRemoteWorklogs(
  users: JiraUserSummary[],
  from: Date,
  to: Date,
): Promise<JiraRemoteWorklog[]> {
  if (users.length === 0) {
    return [];
  }

  const client = await JiraClient.fromStorage();
  const authorIds = new Set(users.map((user) => user.id));
  const jql = [
    `worklogAuthor in (${users.map((user) => quoteJql(user.id)).join(', ')})`,
    `worklogDate >= "${toDateKey(from)}"`,
    `worklogDate <= "${toDateKey(to)}"`,
  ].join(' AND ');

  const issues = await client.searchIssues(jql, 500);
  const worklogsByIssue = await mapWithConcurrency(issues, 4, (issue) => client.getIssueWorklogs(issue, from, to));

  return worklogsByIssue
    .flat()
    .filter((worklog) => {
      const started = new Date(worklog.startedAt).getTime();
      return authorIds.has(worklog.authorId) && started >= from.getTime() && started <= to.getTime();
    });
}
