import { CircleAlert, type LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';

import styles from './FeedbackStates.module.css';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <motion.div
      className={styles.emptyState}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <motion.span
        className={styles.emptyState__illustration}
        initial={{ rotate: -8, y: 4 }}
        animate={{ rotate: 0, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 14 }}
      >
        <Icon aria-hidden />
      </motion.span>
      <h3 className={styles.emptyState__title}>{title}</h3>
      {description && <p className={styles.emptyState__description}>{description}</p>}
      {action}
    </motion.div>
  );
}

export function LoadingSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className={styles.loadingSkeleton} aria-busy="true" aria-label="Carregando">
      {Array.from({ length: lines }, (_, index) => (
        <div key={index} className={styles.loadingSkeleton__line} style={{ opacity: 1 - index * 0.2 }} />
      ))}
    </div>
  );
}

export function ErrorNotice({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className={styles.errorNotice} role="alert">
      <CircleAlert className={styles.errorNotice__icon} aria-hidden />
      <span>{message}</span>
      {action}
    </div>
  );
}
