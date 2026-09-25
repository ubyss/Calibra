import { useCallback, useEffect, useState } from 'react';

import { EXTENSION_REPOSITORY_URL, EXTENSION_UPDATE_STORAGE_KEY } from '@/constants/extension-update';
import {
  checkForExtensionUpdate,
  getLocalExtensionVersion,
  openExtensionRepository,
  readExtensionUpdate,
  snoozeExtensionUpdate,
  type ExtensionUpdateSnapshot,
} from '@/services/extension-update';
import { getErrorMessage } from '@/utils/misc';

const INITIAL_SNAPSHOT: ExtensionUpdateSnapshot = {
  localVersion: getLocalExtensionVersion(),
  remoteVersion: null,
  isUpdateAvailable: false,
  shouldShowNotice: false,
  repositoryUrl: EXTENSION_REPOSITORY_URL,
  checkedAt: null,
};

interface ExtensionUpdateState {
  snapshot: ExtensionUpdateSnapshot;
  isChecking: boolean;
  errorMessage: string | null;
  checkNow: () => Promise<void>;
  snooze: () => Promise<void>;
  openRepository: () => void;
}

export function useExtensionUpdate(): ExtensionUpdateState {
  const [snapshot, setSnapshot] = useState<ExtensionUpdateSnapshot>(INITIAL_SNAPSHOT);
  const [isChecking, setIsChecking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const applySnapshot = useCallback((nextSnapshot: ExtensionUpdateSnapshot): void => {
    setSnapshot(nextSnapshot);
    setErrorMessage(null);
  }, []);

  const checkNow = useCallback(async (): Promise<void> => {
    setIsChecking(true);
    try {
      applySnapshot(await checkForExtensionUpdate(true));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsChecking(false);
    }
  }, [applySnapshot]);

  const snooze = useCallback(async (): Promise<void> => {
    applySnapshot(await snoozeExtensionUpdate());
  }, [applySnapshot]);

  useEffect(() => {
    let isActive = true;

    const refresh = (): void => {
      void readExtensionUpdate().then((nextSnapshot) => {
        if (isActive) {
          setSnapshot(nextSnapshot);
        }
      });
    };

    void checkForExtensionUpdate(false)
      .then((nextSnapshot) => {
        if (isActive) {
          setSnapshot(nextSnapshot);
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          setErrorMessage(getErrorMessage(error));
        }
      });

    const handleChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: string): void => {
      if (areaName === 'local' && EXTENSION_UPDATE_STORAGE_KEY in changes) {
        refresh();
      }
    };

    chrome.storage.onChanged.addListener(handleChange);
    return () => {
      isActive = false;
      chrome.storage.onChanged.removeListener(handleChange);
    };
  }, []);

  return {
    snapshot,
    isChecking,
    errorMessage,
    checkNow,
    snooze,
    openRepository: openExtensionRepository,
  };
}
