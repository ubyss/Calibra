import type { AppSettings, StorageSchema } from '@/types/domain';

export const DEFAULT_SETTINGS: AppSettings = {
  workingDays: [1, 2, 3, 4, 5],
  dayStart: '09:00',
  dayEnd: '18:00',
  dailyTargetHours: 8,
  roundToMinutes: 1,
  theme: 'system',
  pauseOnIdle: false,
  idleMinutes: 10,
  pauseOnLock: true,
  showTimerOnJira: true,
  hideWeekends: true,
};

export const STORAGE_DEFAULTS: StorageSchema = {
  account: null,
  settings: DEFAULT_SETTINGS,
  worklogs: [],
  timer: null,
  bookmarks: [],
  groups: [],
};

export const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const ISSUE_KEY_PATTERN = /^[A-Z][A-Z0-9_]+-\d+$/;

export const MY_OPEN_ISSUES_JQL = 'assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC';

export const RECENT_ISSUES_JQL = 'updated >= -30d ORDER BY updated DESC';

export const BACKUP_FORMAT_VERSION = 1;
