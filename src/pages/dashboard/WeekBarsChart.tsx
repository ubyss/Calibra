import { isToday } from 'date-fns';
import { motion } from 'motion/react';

import type { WeekTotals } from '@/hooks/useWeekTotals';
import { formatWeekday } from '@/utils/date';
import { formatDuration } from '@/utils/duration';
import { classNames } from '@/utils/misc';

import styles from './WeekOverviewPanel.module.css';

interface WeekBarsChartProps {
  totals: WeekTotals;
  targetSeconds: number;
}

export function WeekBarsChart({ totals, targetSeconds }: WeekBarsChartProps) {
  const scaleMax = Math.max(targetSeconds * 1.25, ...totals.days.map((day) => day.totalSeconds));

  return (
    <div className={styles.weekBarsChart} role="list" aria-label="Horas por dia">
      {totals.days.map((day, index) => {
        const isCurrentDay = isToday(day.date);
        return (
          <div
            key={day.dateKey}
            role="listitem"
            className={classNames(styles.weekBarsChart__day, isCurrentDay && styles['weekBarsChart__day--today'])}
            title={`${formatWeekday(day.date)}: ${formatDuration(day.totalSeconds)}`}
          >
            <span className={styles.weekBarsChart__hours}>
              {day.totalSeconds > 0 ? formatDuration(day.totalSeconds) : '–'}
            </span>
            <div className={styles.weekBarsChart__track}>
              <span
                className={styles.weekBarsChart__goal}
                style={{ bottom: `${(targetSeconds / scaleMax) * 100}%` }}
                aria-hidden
              />
              <motion.span
                className={styles.weekBarsChart__fill}
                initial={{ height: 0 }}
                animate={{ height: `${(day.totalSeconds / scaleMax) * 100}%` }}
                transition={{ type: 'spring', stiffness: 140, damping: 20, delay: index * 0.04 }}
              />
            </div>
            <span className={styles.weekBarsChart__weekday}>{formatWeekday(day.date)}</span>
          </div>
        );
      })}
    </div>
  );
}
