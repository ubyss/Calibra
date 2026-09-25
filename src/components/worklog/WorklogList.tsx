import { addSeconds, parseISO } from 'date-fns';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo } from 'react';

import { StatusTag } from '@/components/ui/ProgressMeter';
import type { Worklog } from '@/types/domain';
import { formatLongDate, formatTime, toDateKey } from '@/utils/date';
import { formatDuration } from '@/utils/duration';
import { classNames } from '@/utils/misc';

import styles from './WorklogList.module.css';
import { useWorklogEditor } from './WorklogEditorProvider';

interface WorklogListProps {
  worklogs: Worklog[];
  selectedIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
}

interface WorklogDayGroup {
  dateKey: string;
  label: string;
  totalSeconds: number;
  worklogs: Worklog[];
}

function groupByDay(worklogs: Worklog[]): WorklogDayGroup[] {
  const groups = new Map<string, WorklogDayGroup>();
  [...worklogs]
    .sort((first, second) => second.startedAt.localeCompare(first.startedAt))
    .forEach((worklog) => {
      const started = parseISO(worklog.startedAt);
      const dateKey = toDateKey(started);
      const group = groups.get(dateKey) ?? { dateKey, label: formatLongDate(started), totalSeconds: 0, worklogs: [] };
      group.totalSeconds += worklog.durationSeconds;
      group.worklogs.push(worklog);
      groups.set(dateKey, group);
    });
  return [...groups.values()];
}

export function WorklogList({ worklogs, selectedIds, onToggleSelection }: WorklogListProps) {
  const { openWorklogEditor } = useWorklogEditor();
  const groups = useMemo(() => groupByDay(worklogs), [worklogs]);

  return (
    <div className={styles.worklogList}>
      {groups.map((group) => (
        <section key={group.dateKey} className={styles.worklogList__day} aria-label={group.label}>
          <header className={styles.worklogList__dayHeader}>
            <span className={styles.worklogList__dayTitle}>{group.label}</span>
            <span>{formatDuration(group.totalSeconds)}</span>
          </header>
          <AnimatePresence initial={false}>
            {group.worklogs.map((worklog) => {
              const isSelected = selectedIds?.has(worklog.id) ?? false;
              const endTime = addSeconds(parseISO(worklog.startedAt), worklog.durationSeconds).toISOString();
              return (
                <motion.div
                  key={worklog.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
                  transition={{ type: 'spring', stiffness: 400, damping: 36 }}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    className={classNames(styles.worklogList__entry, isSelected && styles['worklogList__entry--selected'])}
                    onClick={() => openWorklogEditor({ worklog })}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openWorklogEditor({ worklog });
                      }
                    }}
                  >
                    {onToggleSelection ? (
                      <label className={styles.worklogList__checkboxHit} onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          className={styles.worklogList__checkbox}
                          checked={isSelected}
                          onChange={() => onToggleSelection(worklog.id)}
                          aria-label={`Selecionar ${worklog.issueKey}`}
                        />
                      </label>
                    ) : (
                      <span />
                    )}
                    <span className={classNames(styles.worklogList__time, styles.worklogList__timeColumn)}>
                      {formatTime(worklog.startedAt)} – {formatTime(endTime)}
                    </span>
                    <span className={styles.worklogList__body}>
                      <span className={styles.worklogList__headline}>
                        <span className={styles.worklogList__issueKey}>{worklog.issueKey}</span>
                        <span className={styles.worklogList__summary}>{worklog.issueSummary}</span>
                      </span>
                      <span className={styles.worklogList__comment}>{worklog.comment || 'Sem comentário'}</span>
                    </span>
                    <span className={styles.worklogList__meta}>
                      <span className={styles.worklogList__duration}>{formatDuration(worklog.durationSeconds)}</span>
                      <StatusTag tone={worklog.status === 'uploaded' ? 'success' : 'warning'}>
                        {worklog.status === 'uploaded' ? 'Enviado' : 'Pendente'}
                      </StatusTag>
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </section>
      ))}
    </div>
  );
}
