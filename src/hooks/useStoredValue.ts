import { useEffect, useState } from 'react';

import { STORAGE_DEFAULTS } from '@/constants/defaults';
import { readStorage, subscribeStorage } from '@/services/storage';
import type { StorageKey, StorageSchema } from '@/types/domain';

export interface StoredValue<TValue> {
  value: TValue;
  isLoaded: boolean;
}

export function useStoredValue<TKey extends StorageKey>(key: TKey): StoredValue<StorageSchema[TKey]> {
  const [state, setState] = useState<StoredValue<StorageSchema[TKey]>>({
    value: STORAGE_DEFAULTS[key],
    isLoaded: false,
  });

  useEffect(() => {
    let isActive = true;
    const apply = (value: StorageSchema[TKey]): void => {
      if (isActive) {
        setState({ value, isLoaded: true });
      }
    };

    void readStorage(key).then(apply);
    const unsubscribe = subscribeStorage(key, apply);
    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [key]);

  return state;
}
