import type { JiraDeployment, JiraUserSummary } from '@/types/domain';
import type {
  JiraIssue,
  JiraRawIssue,
  JiraRawUser,
  JiraRawWorklog,
  JiraRemoteWorklog,
  JiraStatusCategory,
} from '@/types/jira';

export const ISSUE_FIELDS = ['summary', 'status', 'issuetype', 'assignee', 'timeoriginalestimate', 'timespent'];

export function getUserId(user: JiraRawUser, deployment: JiraDeployment): string {
  return (deployment === 'cloud' ? user.accountId : user.name ?? user.key) ?? '';
}

export function mapUser(user: JiraRawUser, deployment: JiraDeployment): JiraUserSummary {
  return {
    id: getUserId(user, deployment),
    displayName: user.displayName,
    email: user.emailAddress,
    timeZone: user.timeZone,
  };
}

function mapStatusCategory(key: string | undefined): JiraStatusCategory {
  if (key === 'done' || key === 'indeterminate') {
    return key;
  }
  return 'new';
}

export function mapIssue(issue: JiraRawIssue): JiraIssue {
  const { fields } = issue;
  return {
    key: issue.key,
    summary: fields.summary ?? '',
    statusName: fields.status?.name ?? '',
    statusCategory: mapStatusCategory(fields.status?.statusCategory?.key),
    issueTypeName: fields.issuetype?.name ?? '',
    issueTypeIconUrl: fields.issuetype?.iconUrl,
    assigneeName: fields.assignee?.displayName,
    originalEstimateSeconds: fields.timeoriginalestimate ?? 0,
    timeSpentSeconds: fields.timespent ?? 0,
  };
}

export function mapWorklog(
  worklog: JiraRawWorklog,
  issue: Pick<JiraIssue, 'key' | 'summary' | 'issueTypeName' | 'issueTypeIconUrl'>,
  deployment: JiraDeployment,
): JiraRemoteWorklog {
  return {
    id: worklog.id,
    issueKey: issue.key,
    issueSummary: issue.summary,
    issueTypeName: issue.issueTypeName,
    issueTypeIconUrl: issue.issueTypeIconUrl,
    authorId: worklog.author ? getUserId(worklog.author, deployment) : '',
    authorName: worklog.author?.displayName ?? 'Desconhecido',
    startedAt: new Date(worklog.started).toISOString(),
    durationSeconds: worklog.timeSpentSeconds,
    comment: typeof worklog.comment === 'string' ? worklog.comment : '',
  };
}

export function quoteJql(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
