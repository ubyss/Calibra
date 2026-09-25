import { isToday } from 'date-fns';
import { motion } from 'motion/react';

import { SurfacePanel } from '@/components/ui/SurfacePanel';
import { useStoredValue } from '@/hooks/useStoredValue';
import type { WeekTotals } from '@/hooks/useWeekTotals';
import { formatWeekday } from '@/utils/date';
import { formatDuration } from '@/utils/duration';
import { classNames } from '@/utils/misc';

import styles from './DashboardPage.module.css';

export function WeekBarsPanel({ totals }: { totals: WeekTotals }) {
  const { value: settings } = useStoredValue('settings');
  const targetSeconds = settings.dailyTargetHours * 3600;
  const scaleMax = Math.max(targetSeconds * 1.25, ...totals.days.map((day) => day.totalSeconds));

  return (
    <SurfacePanel title="Esta semana" subtitle={`Meta diária de ${settings.dailyTargetHours}h`}>
      <div className={styles.dashboardPage__weekBars} role="list">
        {totals.days.map((day, index) => {
          const isCurrentDay = isToday(day.date);
          return (
            <div
              key={day.dateKey}
              role="listitem"
              className={classNames(styles.dashboardPage__weekBar, isCurrentDay && styles['dashboardPage__weekBar--today'])}
              title={`${formatWeekday(day.date)}: ${formatDuration(day.totalSeconds)}`}
            >
              <div className={styles.dashboardPage__weekBarTrack}>
                <span
                  className={styles.dashboardPage__weekBarGoal}
                  style={{ bottom: `${(targetSeconds / scaleMax) * 100}%` }}
                  aria-hidden
                />
                <motion.span
                  className={styles.dashboardPage__weekBarFill}
                  initial={{ height: 0 }}
                  animate={{ height: `${(day.totalSeconds / scaleMax) * 100}%` }}
                  transition={{ type: 'spring', stiffness: 140, damping: 20, delay: index * 0.04 }}
                />
              </div>
              <span className={styles.dashboardPage__weekBarLabel}>
                <span className="visuallyHidden">{formatDuration(day.totalSeconds)} em </span>
                {formatWeekday(day.date)}
              </span>
            </div>
          );
        })}
      </div>
    </SurfacePanel>
  );
}
