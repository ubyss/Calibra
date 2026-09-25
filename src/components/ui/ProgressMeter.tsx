import { motion } from 'motion/react';

import { classNames } from '@/utils/misc';

import styles from './ProgressMeter.module.css';

interface ProgressMeterProps {
  value: number;
  max: number;
  isThin?: boolean;
  label: string;
}

export function ProgressMeter({ value, max, isThin = false, label }: ProgressMeterProps) {
  const ratio = max > 0 ? value / max : 0;

  return (
    <div
      className={classNames(
        styles.progressMeter,
        isThin && styles['progressMeter--thin'],
        ratio >= 1 && ratio <= 1.1 && styles['progressMeter--complete'],
        ratio > 1.1 && styles['progressMeter--exceeded'],
      )}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(ratio * 100)}
    >
      <motion.div
        className={styles.progressMeter__fill}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: Math.min(1, ratio) }}
        transition={{ type: 'spring', stiffness: 120, damping: 22 }}
      />
    </div>
  );
}

export type StatusTagTone = 'neutral' | 'accent' | 'success' | 'warning';

export function StatusTag({ tone, children }: { tone: StatusTagTone; children: string }) {
  return <span className={classNames(styles.statusTag, styles[`statusTag--${tone}`])}>{children}</span>;
}
