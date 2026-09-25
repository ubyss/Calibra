import { motion, useReducedMotion } from 'motion/react';

import { formatClock } from '@/utils/duration';

import styles from './TimerPanel.module.css';

const RADIUS = 46;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface TimerDialProps {
  elapsedSeconds: number;
  isRunning: boolean;
}

export function TimerDial({ elapsedSeconds, isRunning }: TimerDialProps) {
  const shouldReduceMotion = useReducedMotion();
  const hourProgress = (elapsedSeconds % 3600) / 3600;

  return (
    <div className={styles.timerPanel__dial}>
      {isRunning && !shouldReduceMotion && (
        <motion.span
          className={styles.timerPanel__pulse}
          animate={{ scale: [0.92, 1, 0.92], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <svg className={styles.timerPanel__dialSvg} viewBox="0 0 104 104" aria-hidden>
        <circle className={styles.timerPanel__dialTrack} cx="52" cy="52" r={RADIUS} fill="none" strokeWidth="6" />
        <motion.circle
          className={styles.timerPanel__dialProgress}
          cx="52"
          cy="52"
          r={RADIUS}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          animate={{ strokeDashoffset: CIRCUMFERENCE * (1 - hourProgress) }}
          transition={{ duration: 0.9, ease: 'linear' }}
        />
      </svg>
      <span className={styles.timerPanel__clock} role="timer" aria-live="off">
        {formatClock(elapsedSeconds)}
      </span>
    </div>
  );
}
