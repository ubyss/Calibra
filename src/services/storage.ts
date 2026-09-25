import { STORAGE_DEFAULTS } from '@/constants/defaults';
import type { StorageKey, StorageSchema } from '@/types/domain';

export async function readStorage<TKey extends StorageKey>(key: TKey): Promise<StorageSchema[TKey]> {
  const result = await chrome.storage.local.get(key);
  const value = result[key] as StorageSchema[TKey] | undefined;

  if (key === 'settings') {
    return { ...STORAGE_DEFAULTS.settings, ...(value as object | undefined) } as StorageSchema[TKey];
  }
  return value ?? STORAGE_DEFAULTS[key];
}

export async function writeStorage<TKey extends StorageKey>(key: TKey, value: StorageSchema[TKey]): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export async function updateStorage<TKey extends StorageKey>(
  key: TKey,
  updater: (current: StorageSchema[TKey]) => StorageSchema[TKey],
): Promise<StorageSchema[TKey]> {
  const nextValue = updater(await readStorage(key));
  await writeStorage(key, nextValue);
  return nextValue;
}

export function subscribeStorage<TKey extends StorageKey>(
  key: TKey,
  listener: (value: StorageSchema[TKey]) => void,
): () => void {
  const handleChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: string): void => {
    if (areaName === 'local' && key in changes) {
      void readStorage(key).then(listener);
    }
  };

  chrome.storage.onChanged.addListener(handleChange);
  return () => chrome.storage.onChanged.removeListener(handleChange);
}

export async function clearAllStorage(): Promise<void> {
  await chrome.storage.local.clear();
}
