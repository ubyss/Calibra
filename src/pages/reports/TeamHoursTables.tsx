import { motion } from 'motion/react';

import { formatWeekday, toDateKey } from '@/utils/date';
import { formatDuration } from '@/utils/duration';
import { classNames } from '@/utils/misc';

import styles from './ReportPages.module.css';
import type { TeamHoursMatrix } from './team-hours-model';

function HeatCell({ seconds, targetSeconds, index }: { seconds: number; targetSeconds: number; index: number }) {
  const intensity = targetSeconds > 0 ? Math.min(1, seconds / targetSeconds) : 0;
  return (
    <td className={styles.reportPage__heatCell}>
      {seconds > 0 && (
        <motion.span
          className={styles.reportPage__heatFill}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.08 + intensity * 0.3 }}
          transition={{ delay: index * 0.01 }}
        />
      )}
      <span className={styles.reportPage__heatValue}>{seconds > 0 ? formatDuration(seconds) : '·'}</span>
    </td>
  );
}

export function TeamHoursByDayTable({ matrix, targetSeconds }: { matrix: TeamHoursMatrix; targetSeconds: number }) {
  return (
    <div className={styles.reportPage__tableScroller}>
      <table className={styles.reportPage__table}>
        <thead>
          <tr>
            <th className={styles.reportPage__labelCell}>Pessoa</th>
            {matrix.days.map((day) => (
              <th key={toDateKey(day)} className={classNames([0, 6].includes(day.getDay()) && styles.reportPage__weekendColumn)}>
                {formatWeekday(day)} {day.getDate()}
              </th>
            ))}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((row, rowIndex) => (
            <tr key={row.user.id}>
              <td className={styles.reportPage__labelCell}>{row.user.displayName}</td>
              {matrix.days.map((day, dayIndex) => (
                <HeatCell
                  key={toDateKey(day)}
                  seconds={row.secondsByDay.get(toDateKey(day)) ?? 0}
                  targetSeconds={targetSeconds}
                  index={rowIndex * matrix.days.length + dayIndex}
                />
              ))}
              <td>
                <strong>{formatDuration(row.totalSeconds)}</strong>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className={styles.reportPage__labelCell}>Total</td>
            {matrix.days.map((day) => (
              <td key={toDateKey(day)}>{formatDuration(matrix.secondsByDay.get(toDateKey(day)) ?? 0)}</td>
            ))}
            <td>{formatDuration(matrix.totalSeconds)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function TeamHoursByIssueTable({ matrix }: { matrix: TeamHoursMatrix }) {
  return (
    <div className={styles.reportPage__tableScroller}>
      <table className={styles.reportPage__table}>
        <thead>
          <tr>
            <th className={styles.reportPage__labelCell}>Issue</th>
            {matrix.rows.map((row) => (
              <th key={row.user.id}>{row.user.displayName.split(' ')[0]}</th>
            ))}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {matrix.issueRows.map((issue) => (
            <tr key={issue.key}>
              <td className={styles.reportPage__labelCell} title={issue.summary}>
                <span className={styles.reportPage__issueKey}>{issue.key}</span> {issue.summary}
              </td>
              {matrix.rows.map((row) => {
                const seconds = issue.secondsByUser.get(row.user.id) ?? 0;
                return <td key={row.user.id}>{seconds > 0 ? formatDuration(seconds) : '·'}</td>;
              })}
              <td>
                <strong>{formatDuration(issue.totalSeconds)}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
