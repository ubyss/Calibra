import { type DependencyList, useCallback, useEffect, useState } from 'react';

import { getErrorMessage } from '@/utils/misc';

export interface AsyncState<TData> {
  data: TData | undefined;
  error: string | null;
  isLoading: boolean;
  reload: () => void;
}

export function useAsync<TData>(
  loader: () => Promise<TData>,
  dependencies: DependencyList,
  isEnabled = true,
): AsyncState<TData> {
  const [data, setData] = useState<TData>();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(isEnabled);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!isEnabled) {
      setIsLoading(false);
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setError(null);

    loader()
      .then((result) => isActive && setData(result))
      .catch((reason: unknown) => isActive && setError(getErrorMessage(reason)))
      .finally(() => isActive && setIsLoading(false));

    return () => {
      isActive = false;
    };
  }, [...dependencies, reloadToken, isEnabled]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return { data, error, isLoading, reload };
}
