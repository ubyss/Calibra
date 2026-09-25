import type { ReactNode } from 'react';

import { classNames } from '@/utils/misc';

import styles from './SurfacePanel.module.css';

interface SurfacePanelProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  isFlush?: boolean;
  className?: string;
  children: ReactNode;
}

export function SurfacePanel({ title, subtitle, actions, isFlush = false, className, children }: SurfacePanelProps) {
  return (
    <section className={classNames(styles.surfacePanel, isFlush && styles['surfacePanel--flush'], className)}>
      {(title || actions) && (
        <header className={styles.surfacePanel__header}>
          <div className={styles.surfacePanel__heading}>
            {title && <h2 className={styles.surfacePanel__title}>{title}</h2>}
            {subtitle && <p className={styles.surfacePanel__subtitle}>{subtitle}</p>}
          </div>
          {actions && <div className={styles.surfacePanel__actions}>{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
