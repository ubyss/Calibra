import {
  EXTENSION_REMOTE_MANIFEST_URL,
  EXTENSION_REPOSITORY_URL,
  EXTENSION_UPDATE_CHECK_INTERVAL_MS,
  EXTENSION_UPDATE_SNOOZE_MS,
  EXTENSION_UPDATE_STORAGE_KEY,
} from '@/constants/extension-update';

export interface ExtensionUpdateRecord {
  lastCheckedAt: string | null;
  remoteVersion: string | null;
  snoozedUntil: string | null;
  snoozedForVersion: string | null;
}

export interface ExtensionUpdateSnapshot {
  localVersion: string;
  remoteVersion: string | null;
  isUpdateAvailable: boolean;
  shouldShowNotice: boolean;
  repositoryUrl: string;
  checkedAt: string | null;
}

const EMPTY_RECORD: ExtensionUpdateRecord = {
  lastCheckedAt: null,
  remoteVersion: null,
  snoozedUntil: null,
  snoozedForVersion: null,
};

let pendingCheck: Promise<ExtensionUpdateSnapshot> | null = null;

export function getLocalExtensionVersion(): string {
  return chrome.runtime.getManifest().version;
}

export function compareVersions(left: string, right: string): number {
  const leftParts = left.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = right.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}

export function isRemoteVersionNewer(localVersion: string, remoteVersion: string | null): boolean {
  if (!remoteVersion) {
    return false;
  }
  return compareVersions(remoteVersion, localVersion) > 0;
}

function shouldShowNotice(record: ExtensionUpdateRecord, localVersion: string): boolean {
  if (!isRemoteVersionNewer(localVersion, record.remoteVersion) || !record.remoteVersion) {
    return false;
  }
  if (record.snoozedForVersion !== record.remoteVersion || !record.snoozedUntil) {
    return true;
  }
  return Date.parse(record.snoozedUntil) <= Date.now();
}

function toSnapshot(record: ExtensionUpdateRecord): ExtensionUpdateSnapshot {
  const localVersion = getLocalExtensionVersion();
  return {
    localVersion,
    remoteVersion: record.remoteVersion,
    isUpdateAvailable: isRemoteVersionNewer(localVersion, record.remoteVersion),
    shouldShowNotice: shouldShowNotice(record, localVersion),
    repositoryUrl: EXTENSION_REPOSITORY_URL,
    checkedAt: record.lastCheckedAt,
  };
}

async function readRecord(): Promise<ExtensionUpdateRecord> {
  const stored = await chrome.storage.local.get(EXTENSION_UPDATE_STORAGE_KEY);
  const value = stored[EXTENSION_UPDATE_STORAGE_KEY] as Partial<ExtensionUpdateRecord> | undefined;
  return { ...EMPTY_RECORD, ...value };
}

async function writeRecord(record: ExtensionUpdateRecord): Promise<void> {
  await chrome.storage.local.set({ [EXTENSION_UPDATE_STORAGE_KEY]: record });
}

async function fetchRemoteVersion(): Promise<string> {
  const response = await fetch(EXTENSION_REMOTE_MANIFEST_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Não foi possível consultar a versão no GitHub.');
  }

  const manifest = (await response.json()) as { version?: unknown };
  if (typeof manifest.version !== 'string' || manifest.version.length === 0) {
    throw new Error('O manifesto remoto não tem uma versão válida.');
  }

  return manifest.version;
}

function isCheckFresh(record: ExtensionUpdateRecord): boolean {
  if (!record.lastCheckedAt || !record.remoteVersion) {
    return false;
  }
  return Date.now() - Date.parse(record.lastCheckedAt) < EXTENSION_UPDATE_CHECK_INTERVAL_MS;
}

export async function readExtensionUpdate(): Promise<ExtensionUpdateSnapshot> {
  return toSnapshot(await readRecord());
}

export async function checkForExtensionUpdate(force = false): Promise<ExtensionUpdateSnapshot> {
  const current = await readRecord();
  if (!force && isCheckFresh(current)) {
    return toSnapshot(current);
  }

  if (pendingCheck) {
    return pendingCheck;
  }

  pendingCheck = (async () => {
    const remoteVersion = await fetchRemoteVersion();
    const nextRecord: ExtensionUpdateRecord = {
      ...current,
      lastCheckedAt: new Date().toISOString(),
      remoteVersion,
    };
    await writeRecord(nextRecord);
    return toSnapshot(nextRecord);
  })().finally(() => {
    pendingCheck = null;
  });

  return pendingCheck;
}

export async function snoozeExtensionUpdate(): Promise<ExtensionUpdateSnapshot> {
  const current = await readRecord();
  if (!current.remoteVersion) {
    return toSnapshot(current);
  }

  const nextRecord: ExtensionUpdateRecord = {
    ...current,
    snoozedForVersion: current.remoteVersion,
    snoozedUntil: new Date(Date.now() + EXTENSION_UPDATE_SNOOZE_MS).toISOString(),
  };
  await writeRecord(nextRecord);
  return toSnapshot(nextRecord);
}

export function openExtensionRepository(): void {
  void chrome.tabs.create({ url: EXTENSION_REPOSITORY_URL });
}
