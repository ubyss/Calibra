import { motion } from 'motion/react';
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
    <motion.section
      layout="position"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
      className={classNames(styles.surfacePanel, isFlush && styles['surfacePanel--flush'], className)}
    >
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
    </motion.section>
  );
}
