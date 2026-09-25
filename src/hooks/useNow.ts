import { useEffect, useState } from 'react';

export function useNow(intervalMs = 1000, isEnabled = true): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isEnabled) {
      return;
    }
    setNow(Date.now());
    const handle = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(handle);
  }, [intervalMs, isEnabled]);

  return now;
}
