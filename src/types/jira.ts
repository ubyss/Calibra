export type JiraStatusCategory = 'new' | 'indeterminate' | 'done';

export interface JiraIssue {
  key: string;
  summary: string;
  statusName: string;
  statusCategory: JiraStatusCategory;
  issueTypeName: string;
  issueTypeIconUrl?: string;
  assigneeName?: string;
  originalEstimateSeconds: number;
  timeSpentSeconds: number;
}

export interface JiraRemoteWorklog {
  id: string;
  issueKey: string;
  issueSummary: string;
  issueTypeName: string;
  issueTypeIconUrl?: string;
  authorId: string;
  authorName: string;
  startedAt: string;
  durationSeconds: number;
  comment: string;
}

export interface JiraBoard {
  id: number;
  name: string;
  type: string;
}

export interface JiraSprint {
  id: number;
  name: string;
  state: 'future' | 'active' | 'closed';
  startDate?: string;
  endDate?: string;
  completeDate?: string;
}

export interface JiraRawUser {
  accountId?: string;
  name?: string;
  key?: string;
  displayName: string;
  emailAddress?: string;
  timeZone?: string;
}

export interface JiraRawIssue {
  key: string;
  fields: {
    summary?: string;
    status?: { name: string; statusCategory?: { key: string } };
    issuetype?: { name: string; iconUrl?: string };
    assignee?: JiraRawUser | null;
    timeoriginalestimate?: number | null;
    timespent?: number | null;
  };
}

export interface JiraRawWorklog {
  id: string;
  author?: JiraRawUser;
  started: string;
  timeSpentSeconds: number;
  comment?: string;
}
