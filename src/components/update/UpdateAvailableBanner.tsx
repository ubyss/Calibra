import { ArrowUpRight } from 'lucide-react';

import { useExtensionUpdate } from '@/hooks/useExtensionUpdate';

import styles from './UpdateAvailableBanner.module.css';

export function UpdateAvailableBanner() {
  const { snapshot, openRepository } = useExtensionUpdate();

  if (!snapshot.isUpdateAvailable || !snapshot.remoteVersion) {
    return null;
  }

  return (
    <button type="button" className={styles.updateAvailableBanner} onClick={openRepository}>
      <span className={styles.updateAvailableBanner__text}>
        Versão {snapshot.remoteVersion} disponível
      </span>
      <ArrowUpRight className={styles.updateAvailableBanner__icon} aria-hidden strokeWidth={2.2} />
    </button>
  );
}
