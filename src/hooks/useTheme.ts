import { useEffect } from 'react';

import { useStoredValue } from '@/hooks/useStoredValue';

export function useTheme(): void {
  const { value: settings } = useStoredValue('settings');

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (): void => {
      const isDark = settings.theme === 'dark' || (settings.theme === 'system' && media.matches);
      document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    };

    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [settings.theme]);
}
