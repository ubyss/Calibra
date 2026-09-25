export type JiraDeployment = 'cloud' | 'server';

export type JiraAuthMethod = 'apiToken' | 'personalToken' | 'browserSession';

export type ThemePreference = 'system' | 'light' | 'dark';

export type WorklogStatus = 'pending' | 'uploaded';

export interface EncryptedPayload {
  iv: string;
  data: string;
}

export interface JiraUserSummary {
  id: string;
  displayName: string;
  email?: string;
  timeZone?: string;
}

export interface JiraAccount {
  baseUrl: string;
  deployment: JiraDeployment;
  authMethod: JiraAuthMethod;
  email?: string;
  encryptedSecret?: EncryptedPayload;
  user: JiraUserSummary;
  connectedAt: string;
}

export interface Worklog {
  id: string;
  issueKey: string;
  issueSummary?: string;
  issueTypeName?: string;
  issueTypeIconUrl?: string;
  startedAt: string;
  durationSeconds: number;
  comment: string;
  status: WorklogStatus;
  jiraWorklogId?: string;
  createdAt: string;
  updatedAt: string;
}

export type WorklogDraft = Pick<
  Worklog,
  'issueKey' | 'issueSummary' | 'issueTypeName' | 'issueTypeIconUrl' | 'startedAt' | 'durationSeconds' | 'comment'
>;

export interface RunningTimer {
  issueKey: string;
  issueSummary?: string;
  comment: string;
  startedAt: string;
  accumulatedSeconds: number;
  resumedAt: string | null;
  isAutoPaused: boolean;
}

export interface Bookmark {
  issueKey: string;
  summary: string;
  addedAt: string;
}

export interface UserGroup {
  id: string;
  name: string;
  users: JiraUserSummary[];
}

export interface AppSettings {
  workingDays: number[];
  dayStart: string;
  dayEnd: string;
  dailyTargetHours: number;
  roundToMinutes: number;
  theme: ThemePreference;
  pauseOnIdle: boolean;
  idleMinutes: number;
  pauseOnLock: boolean;
  showTimerOnJira: boolean;
  hideWeekends: boolean;
  autoUploadWorklogs: boolean;
}

export interface StorageSchema {
  account: JiraAccount | null;
  settings: AppSettings;
  worklogs: Worklog[];
  timer: RunningTimer | null;
  bookmarks: Bookmark[];
  groups: UserGroup[];
}

export type StorageKey = keyof StorageSchema;
