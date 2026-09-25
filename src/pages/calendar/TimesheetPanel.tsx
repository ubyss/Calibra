import { endOfDay, endOfMonth, format, parse, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useMemo, useState } from 'react';

import { ErrorNotice } from '@/components/ui/FeedbackStates';
import { ModalDialog } from '@/components/ui/ModalDialog';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useAsync } from '@/hooks/useAsync';
import { useStoredValue } from '@/hooks/useStoredValue';
import { fetchRemoteWorklogs } from '@/services/worklog-service';
import type { AppSettings, Worklog } from '@/types/domain';
import type { JiraRemoteWorklog } from '@/types/jira';
import { toDateKey } from '@/utils/date';
import { classNames, getInitials } from '@/utils/misc';

import {
  buildMonthCalendarWeeks,
  buildTimesheetDays,
  collectTimedEntries,
  formatTimesheetClock,
  getMonthRangeKeys,
  TIMESHEET_WEEKDAY_LABELS,
  type TimesheetDayEntry,
  type TimesheetDayStatus,
  type TimesheetRangeMode,
} from './timesheet-model';
import styles from './TimesheetPanel.module.css';

type TimesheetPanelProps = {
  isOpen: boolean;
  weekFrom: string;
  weekTo: string;
  referenceDate: Date;
  worklogs: Worklog[];
  remoteWorklogs: JiraRemoteWorklog[];
  settings: AppSettings;
  onClose: () => void;
};

function timesheetHoursClassName(status: TimesheetDayStatus): string {
  switch (status) {
    case 'green':
      return styles['timesheetPanel__hours--green'];
    case 'orange':
      return styles['timesheetPanel__hours--orange'];
    case 'pink':
      return styles['timesheetPanel__hours--pink'];
    case 'neutral':
      return styles['timesheetPanel__hours--neutral'];
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

function timesheetStatusAccentClass(status: TimesheetDayStatus): string | false {
  switch (status) {
    case 'green':
      return styles['timesheetPanel__statusAccent--green'];
    case 'orange':
      return styles['timesheetPanel__statusAccent--orange'];
    case 'pink':
      return styles['timesheetPanel__statusAccent--pink'];
    case 'neutral':
      return false;
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

function TimesheetWeekTable({ days }: { days: TimesheetDayEntry[] }) {
  const totalSeconds = days.reduce((sum, day) => sum + day.totalSeconds, 0);

  return (
    <div className={styles.timesheetPanel__weekScroll}>
      <table className={styles.timesheetPanel__weekGrid}>
        <thead>
          <tr>
            {days.map((day) => {
              const dayDate = parse(day.date, 'yyyy-MM-dd', new Date());
              return (
                <th
                  key={day.date}
                  scope="col"
                  className={classNames(
                    styles.timesheetPanel__dayHeader,
                    day.isWeekend && styles['timesheetPanel__dayHeader--weekend'],
                  )}
                >
                  <span className={styles.timesheetPanel__dayDate}>
                    {format(dayDate, 'dd/MM', { locale: ptBR })}
                  </span>
                  <span className={styles.timesheetPanel__dayWeekday}>
                    {format(dayDate, 'EEE', { locale: ptBR }).replace('.', '')}
                  </span>
                </th>
              );
            })}
            <th scope="col" className={styles.timesheetPanel__totalHeader}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            {days.map((day) => {
              const hasStatus = day.totalSeconds > 0 && day.status !== 'neutral';
              return (
                <td
                  key={day.date}
                  className={classNames(
                    styles.timesheetPanel__cell,
                    day.isWeekend && styles['timesheetPanel__cell--weekend'],
                    hasStatus && timesheetStatusAccentClass(day.status),
                  )}
                >
                  <span className={classNames(styles.timesheetPanel__hours, timesheetHoursClassName(day.status))}>
                    {formatTimesheetClock(day.totalSeconds)}
                  </span>
                </td>
              );
            })}
            <td className={styles.timesheetPanel__totalCell}>{formatTimesheetClock(totalSeconds)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function TimesheetMonthCalendar({
  days,
  rangeFrom,
  dailyTargetHours,
}: {
  days: TimesheetDayEntry[];
  rangeFrom: string;
  dailyTargetHours: number;
}) {
  const weeks = buildMonthCalendarWeeks(rangeFrom, days, dailyTargetHours);
  const cells = weeks.flat();

  return (
    <div className={styles.timesheetPanel__monthGrid} role="grid" aria-label="Calendário mensal">
      {TIMESHEET_WEEKDAY_LABELS.map((weekdayLabel) => (
        <span key={weekdayLabel} className={styles.timesheetPanel__weekdayLabel} role="columnheader">
          {weekdayLabel}
        </span>
      ))}

      {cells.map((day, cellIndex) => {
        if (!day) {
          return (
            <div
              key={`empty-${cellIndex}`}
              className={classNames(styles.timesheetPanel__monthDay, styles['timesheetPanel__monthDay--empty'])}
              role="gridcell"
              aria-hidden
            />
          );
        }

        const dayDate = parse(day.date, 'yyyy-MM-dd', new Date());
        const hasLoggedHours = day.totalSeconds > 0;
        const hasStatus = hasLoggedHours && day.status !== 'neutral';
        const isToday = format(dayDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

        return (
          <article
            key={day.date}
            className={classNames(
              styles.timesheetPanel__monthDay,
              day.isWeekend && styles['timesheetPanel__monthDay--weekend'],
              hasStatus && timesheetStatusAccentClass(day.status),
            )}
            role="gridcell"
            aria-label={`${format(dayDate, 'd MMMM', { locale: ptBR })}${
              hasLoggedHours ? `, ${formatTimesheetClock(day.totalSeconds)}` : ''
            }`}
          >
            <span
              className={classNames(
                styles.timesheetPanel__monthDayNumber,
                isToday && styles['timesheetPanel__monthDayNumber--today'],
              )}
            >
              {format(dayDate, 'd', { locale: ptBR })}
            </span>
            {hasLoggedHours && (
              <span className={classNames(styles.timesheetPanel__monthHours, timesheetHoursClassName(day.status))}>
                {formatTimesheetClock(day.totalSeconds)}
              </span>
            )}
          </article>
        );
      })}
    </div>
  );
}

export function TimesheetPanel({
  isOpen,
  weekFrom,
  weekTo,
  referenceDate,
  worklogs,
  remoteWorklogs,
  settings,
  onClose,
}: TimesheetPanelProps) {
  const [rangeMode, setRangeMode] = useState<TimesheetRangeMode>('month');
  const { value: account } = useStoredValue('account');
  const monthKey = toDateKey(startOfMonth(referenceDate));

  const monthRemote = useAsync(
    () => fetchRemoteWorklogs(account ? [account.user] : [], startOfMonth(referenceDate), endOfDay(endOfMonth(referenceDate))),
    [monthKey, account?.user.id],
    isOpen && rangeMode === 'month' && Boolean(account),
  );

  const range = useMemo(() => {
    if (rangeMode === 'month') {
      return getMonthRangeKeys(referenceDate);
    }
    return { from: weekFrom, to: weekTo };
  }, [rangeMode, referenceDate, weekFrom, weekTo]);

  const days = useMemo(() => {
    if (!isOpen) {
      return [];
    }
    const source = rangeMode === 'month' ? monthRemote.data ?? remoteWorklogs : remoteWorklogs;
    const entries = collectTimedEntries(worklogs, source);
    return buildTimesheetDays(entries, range.from, range.to, settings.dailyTargetHours);
  }, [isOpen, rangeMode, worklogs, remoteWorklogs, monthRemote.data, range.from, range.to, settings.dailyTargetHours]);

  return (
    <ModalDialog isOpen={isOpen} title="Timesheet" isWide onClose={onClose}>
      <div className={styles.timesheetPanel}>
        <div className={styles.timesheetPanel__toolbar}>
          {account ? (
            <div className={styles.timesheetPanel__user}>
              <span className={styles.timesheetPanel__avatar} aria-hidden>
                {getInitials(account.user.displayName)}
              </span>
              <span className={styles.timesheetPanel__userName}>{account.user.displayName}</span>
            </div>
          ) : (
            <span />
          )}
          <SegmentedControl<TimesheetRangeMode>
            ariaLabel="Intervalo do timesheet"
            value={rangeMode}
            onChange={setRangeMode}
            options={[
              { value: 'week', label: 'Semana' },
              { value: 'month', label: 'Mês' },
            ]}
          />
        </div>

        <section className={styles.timesheetPanel__legend} aria-label="Legenda de horas">
          <span className={styles.timesheetPanel__legendItem}>
            <span className={classNames(styles.timesheetPanel__legendSwatch, styles['timesheetPanel__legendSwatch--green'])} />
            {settings.dailyTargetHours}h exatas
          </span>
          <span className={styles.timesheetPanel__legendItem}>
            <span className={classNames(styles.timesheetPanel__legendSwatch, styles['timesheetPanel__legendSwatch--orange'])} />
            Acima de {settings.dailyTargetHours}h
          </span>
          <span className={styles.timesheetPanel__legendItem}>
            <span className={classNames(styles.timesheetPanel__legendSwatch, styles['timesheetPanel__legendSwatch--pink'])} />
            Abaixo de {settings.dailyTargetHours}h ou acima de {settings.dailyTargetHours + 1}h
          </span>
        </section>

        {rangeMode === 'month' && monthRemote.isLoading && (
          <p className={styles.timesheetPanel__empty}>Carregando as horas do mês…</p>
        )}
        {rangeMode === 'month' && monthRemote.error && <ErrorNotice message={monthRemote.error} />}

        {days.length === 0 ? (
          <p className={styles.timesheetPanel__empty}>Nenhum worklog no período selecionado.</p>
        ) : rangeMode === 'month' ? (
          <TimesheetMonthCalendar
            days={days}
            rangeFrom={range.from}
            dailyTargetHours={settings.dailyTargetHours}
          />
        ) : (
          <TimesheetWeekTable days={days} />
        )}
      </div>
    </ModalDialog>
  );
}
