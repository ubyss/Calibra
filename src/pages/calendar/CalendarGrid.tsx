import { isToday } from 'date-fns';
import { motion } from 'motion/react';
import { type CSSProperties, type MouseEvent, useEffect, useMemo, useRef } from 'react';

import { useNow } from '@/hooks/useNow';
import type { AppSettings } from '@/types/domain';
import { formatWeekday, timeToMinutes, toDateKey } from '@/utils/date';
import { formatDuration } from '@/utils/duration';
import { classNames } from '@/utils/misc';

import {
  type CalendarEntry,
  getEntryIssue,
  HOUR_HEIGHT_PX,
  layoutOverlappingEntries,
  minutesFromVisibleStart,
  minutesToPixels,
  pixelsToMinutes,
  snapMinutes,
  VISIBLE_END_HOUR,
  VISIBLE_START_HOUR,
} from './calendar-model';
import { CalendarEntryBlock, type EntryChange } from './CalendarEntryBlock';
import styles from './CalendarGrid.module.css';

interface CalendarGridProps {
  days: Date[];
  entriesByDay: Map<string, CalendarEntry[]>;
  settings: AppSettings;
  issueBaseUrl?: string;
  isCopyMode?: boolean;
  onCreate: (start: Date) => void;
  onOpen: (entry: CalendarEntry) => void;
  onCopy: (entry: CalendarEntry, pointer: { x: number; y: number }) => void;
  onChange: (entry: CalendarEntry, change: EntryChange) => void;
}

const HOURS = Array.from({ length: VISIBLE_END_HOUR - VISIBLE_START_HOUR }, (_, index) => VISIBLE_START_HOUR + index);

export function CalendarGrid({
  days,
  entriesByDay,
  settings,
  issueBaseUrl,
  isCopyMode = false,
  onCreate,
  onOpen,
  onCopy,
  onChange,
}: CalendarGridProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const now = new Date(useNow(60_000));
  const bodyHeight = HOURS.length * HOUR_HEIGHT_PX;
  const workingStart = minutesToPixels(timeToMinutes(settings.dayStart) - VISIBLE_START_HOUR * 60);
  const workingEnd = minutesToPixels(timeToMinutes(settings.dayEnd) - VISIBLE_START_HOUR * 60);

  const layoutByDay = useMemo(
    () => new Map(days.map((day) => [toDateKey(day), layoutOverlappingEntries(entriesByDay.get(toDateKey(day)) ?? [])])),
    [days, entriesByDay],
  );

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: Math.max(0, workingStart - HOUR_HEIGHT_PX / 2) });
  }, [workingStart]);

  const handleColumnClick = (event: MouseEvent<HTMLDivElement>, day: Date): void => {
    const offsetY = event.clientY - event.currentTarget.getBoundingClientRect().top;
    const minutes = snapMinutes(pixelsToMinutes(offsetY)) + VISIBLE_START_HOUR * 60;
    const start = new Date(day);
    start.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    onCreate(start);
  };

  const gridStyle = {
    '--calendar-columns': days.length,
    '--calendar-hour-height': `${HOUR_HEIGHT_PX}px`,
    '--calendar-slot-height': `${HOUR_HEIGHT_PX / 4}px`,
  } as CSSProperties;

  return (
    <div className={classNames(styles.calendarGrid, isCopyMode && styles['calendarGrid--copyMode'])} style={gridStyle}>
      <div className={styles.calendarGrid__header}>
        <span />
        {days.map((day) => {
          const total = (entriesByDay.get(toDateKey(day)) ?? []).reduce((sum, entry) => sum + entry.durationSeconds, 0);
          const targetLabel = formatDuration(settings.dailyTargetHours * 3600);
          const totalLabel = formatDuration(total);
          return (
            <div
              key={day.toISOString()}
              className={classNames(styles.calendarGrid__dayHeading, isToday(day) && styles['calendarGrid__dayHeading--today'])}
            >
              <span className={styles.calendarGrid__dayName}>
                {formatWeekday(day)} {String(day.getDate()).padStart(2, '0')}/{String(day.getMonth() + 1).padStart(2, '0')}
              </span>
              {isToday(day) && <span className={styles.calendarGrid__todayBadge}>Hoje</span>}
              <span className={styles.calendarGrid__dayTotal}>
                {totalLabel} de {targetLabel}
              </span>
            </div>
          );
        })}
      </div>

      <div ref={scrollerRef} className={styles.calendarGrid__scroller}>
        <div className={styles.calendarGrid__body} style={{ height: bodyHeight }}>
          <div className={styles.calendarGrid__gutter} aria-hidden>
            {HOURS.slice(1).map((hour) => (
              <span key={hour} className={styles.calendarGrid__hourLabel} style={{ top: (hour - VISIBLE_START_HOUR) * HOUR_HEIGHT_PX }}>
                {String(hour).padStart(2, '0')}:00
              </span>
            ))}
          </div>

          {days.map((day, dayIndex) => {
            const layout = layoutByDay.get(toDateKey(day)) ?? [];
            const isWorkingDay = settings.workingDays.includes(day.getDay());
            return (
              <div
                key={day.toISOString()}
                data-calendar-day={toDateKey(day)}
                className={classNames(styles.calendarGrid__column, !isWorkingDay && styles['calendarGrid__column--weekend'])}
                onClick={(event) => handleColumnClick(event, day)}
                aria-label={
                  isCopyMode
                    ? `Colar worklog em ${formatWeekday(day)} ${day.getDate()}`
                    : `Criar worklog em ${formatWeekday(day)} ${day.getDate()}`
                }
              >
                {isWorkingDay && (
                  <span
                    className={styles.calendarGrid__workingHours}
                    style={{ top: workingStart, height: Math.max(0, workingEnd - workingStart) }}
                  />
                )}
                {isToday(day) && (
                  <motion.span
                    className={styles.calendarGrid__nowLine}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    style={{ top: minutesToPixels(minutesFromVisibleStart(now)), originX: 0 }}
                  />
                )}
                {layout.map(({ entry, lane, laneCount }) => (
                  <CalendarEntryBlock
                    key={entry.id}
                    entry={entry}
                    lane={lane}
                    laneCount={laneCount}
                    dayIndex={dayIndex}
                    columnCount={days.length}
                    issueUrl={issueBaseUrl ? `${issueBaseUrl}/browse/${encodeURIComponent(getEntryIssue(entry).key)}` : undefined}
                    onOpen={onOpen}
                    onCopy={onCopy}
                    onChange={onChange}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
