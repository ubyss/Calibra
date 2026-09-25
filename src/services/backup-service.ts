import { BACKUP_FORMAT_VERSION, DEFAULT_SETTINGS } from '@/constants/defaults';
import { readStorage, writeStorage } from '@/services/storage';
import type { Bookmark, StorageSchema, UserGroup, Worklog } from '@/types/domain';

type BackupContent = Pick<StorageSchema, 'settings' | 'worklogs' | 'bookmarks' | 'groups'>;

interface BackupFile extends BackupContent {
  format: 'timesheet-backup';
  version: number;
  exportedAt: string;
}

export async function createBackup(): Promise<string> {
  const backup: BackupFile = {
    format: 'timesheet-backup',
    version: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    settings: await readStorage('settings'),
    worklogs: await readStorage('worklogs'),
    bookmarks: await readStorage('bookmarks'),
    groups: await readStorage('groups'),
  };
  return JSON.stringify(backup, null, 2);
}

function isWorklog(value: unknown): value is Worklog {
  const candidate = value as Worklog;
  return (
    typeof candidate?.id === 'string' &&
    typeof candidate.issueKey === 'string' &&
    typeof candidate.startedAt === 'string' &&
    typeof candidate.durationSeconds === 'number'
  );
}

function isBookmark(value: unknown): value is Bookmark {
  return typeof (value as Bookmark)?.issueKey === 'string';
}

function isUserGroup(value: unknown): value is UserGroup {
  const candidate = value as UserGroup;
  return typeof candidate?.id === 'string' && typeof candidate.name === 'string' && Array.isArray(candidate.users);
}

export async function restoreBackup(content: string): Promise<void> {
  let parsed: Partial<BackupFile>;
  try {
    parsed = JSON.parse(content) as Partial<BackupFile>;
  } catch {
    throw new Error('O arquivo não é um JSON válido.');
  }

  if (parsed.format !== 'timesheet-backup') {
    throw new Error('Este arquivo não é um backup do Timesheet.');
  }

  await writeStorage('settings', { ...DEFAULT_SETTINGS, ...parsed.settings });
  await writeStorage('worklogs', (parsed.worklogs ?? []).filter(isWorklog));
  await writeStorage('bookmarks', (parsed.bookmarks ?? []).filter(isBookmark));
  await writeStorage('groups', (parsed.groups ?? []).filter(isUserGroup));
}
