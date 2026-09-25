import { addSeconds, format } from 'date-fns';
import { Bug, Copy, Layers, SquarePlus, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { type KeyboardEvent, type PointerEvent, type ReactNode, useRef, useState } from 'react';

import { formatDuration } from '@/utils/duration';
import { type IssueTypeMark, resolveIssueTypeMark } from '@/utils/issue-type';
import { classNames } from '@/utils/misc';

import {
  CARD_SIDE_GUTTER_PX,
  type CalendarEntry,
  getEntryIssue,
  MIN_DURATION_MINUTES,
  minutesFromVisibleStart,
  minutesToPixels,
  pixelsToMinutes,
  projectColorFromKey,
  SNAP_MINUTES,
  snapMinutes,
} from './calendar-model';
import styles from './CalendarEntryBlock.module.css';

export interface EntryChange {
  minutesDelta: number;
  dayDelta: number;
  durationMinutes: number;
}

interface CalendarEntryBlockProps {
  entry: CalendarEntry;
  lane: number;
  laneCount: number;
  dayIndex: number;
  columnCount: number;
  issueUrl?: string;
  onOpen: (entry: CalendarEntry) => void;
  onCopy: (entry: CalendarEntry, pointer: { x: number; y: number }) => void;
  onChange: (entry: CalendarEntry, change: EntryChange) => void;
}

type DragMode = 'move' | 'resize-start' | 'resize-end';

interface DragSession {
  mode: DragMode;
  originX: number;
  originY: number;
  columnWidth: number;
  hasMoved: boolean;
  change: EntryChange;
}

const DRAG_THRESHOLD_PX = 4;
const CARD_GAP_PX = 2;

function IssueTypeIcon({ mark }: { mark: IssueTypeMark }): ReactNode {
  switch (mark) {
    case 'bug':
      return <Bug size={10} strokeWidth={2.5} aria-hidden />;
    case 'story':
      return <Zap size={10} strokeWidth={2.5} aria-hidden />;
    case 'task':
      return <SquarePlus size={10} strokeWidth={2.5} aria-hidden />;
    case 'epic':
      return <Layers size={10} strokeWidth={2.5} aria-hidden />;
    case 'default':
      return <span aria-hidden>•</span>;
    default: {
      const exhaustive: never = mark;
      return exhaustive;
    }
  }
}

export function CalendarEntryBlock({
  entry,
  lane,
  laneCount,
  dayIndex,
  columnCount,
  issueUrl,
  onOpen,
  onCopy,
  onChange,
}: CalendarEntryBlockProps) {
  const blockRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragSession | null>(null);
  const [preview, setPreview] = useState<EntryChange | null>(null);
  const durationMinutes = Math.max(1, Math.round(entry.durationSeconds / 60));
  const issue = getEntryIssue(entry);
  const typeMark = resolveIssueTypeMark(issue.issueTypeName);
  const accentColor = projectColorFromKey(issue.key);
  const variant = entry.kind === 'remote' ? 'remote' : entry.worklog.status;

  const baseChange: EntryChange = { minutesDelta: 0, dayDelta: 0, durationMinutes };
  const activeChange = preview ?? baseChange;
  const top = Math.max(0, minutesToPixels(minutesFromVisibleStart(entry.start) + activeChange.minutesDelta));
  // Altura exatamente no slot de tempo (com 2px de folga) para 15m não invadir o próximo.
  const height = Math.max(minutesToPixels(activeChange.durationMinutes) - CARD_GAP_PX, 12);
  const previewStart = new Date(entry.start.getTime() + activeChange.minutesDelta * 60_000);
  const previewEnd = addSeconds(previewStart, activeChange.durationMinutes * 60);
  const isCompact = height < minutesToPixels(30);
  const translateX = preview && dragRef.current?.mode === 'move' ? preview.dayDelta * dragRef.current.columnWidth : 0;

  const resolveResizeChange = (mode: DragMode, snappedMinutes: number): EntryChange => {
    if (mode === 'resize-end') {
      return {
        minutesDelta: 0,
        dayDelta: 0,
        durationMinutes: Math.max(MIN_DURATION_MINUTES, durationMinutes + snappedMinutes),
      };
    }
    if (mode === 'resize-start') {
      const boundedDelta = Math.min(snappedMinutes, durationMinutes - MIN_DURATION_MINUTES);
      return {
        minutesDelta: boundedDelta,
        dayDelta: 0,
        durationMinutes: Math.max(MIN_DURATION_MINUTES, durationMinutes - boundedDelta),
      };
    }
    return baseChange;
  };

  const handlePointerDown = (event: PointerEvent<HTMLElement>, mode: DragMode): void => {
    if (event.button !== 0) {
      return;
    }
    event.stopPropagation();
    event.preventDefault();
    const columnWidth = blockRef.current?.parentElement?.getBoundingClientRect().width ?? 1;
    dragRef.current = {
      mode,
      originX: event.clientX,
      originY: event.clientY,
      columnWidth,
      hasMoved: false,
      change: baseChange,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>): void => {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    const deltaX = event.clientX - drag.originX;
    const deltaY = event.clientY - drag.originY;
    if (!drag.hasMoved && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD_PX) {
      return;
    }
    drag.hasMoved = true;

    const snappedMinutes = snapMinutes(pixelsToMinutes(deltaY));
    drag.change =
      drag.mode === 'move'
        ? {
            minutesDelta: snappedMinutes,
            dayDelta: Math.min(Math.max(Math.round(deltaX / drag.columnWidth), -dayIndex), columnCount - 1 - dayIndex),
            durationMinutes,
          }
        : resolveResizeChange(drag.mode, snappedMinutes);
    setPreview(drag.change);
  };

  const handlePointerUp = (): void => {
    const drag = dragRef.current;
    dragRef.current = null;
    setPreview(null);
    if (!drag) {
      return;
    }
    if (!drag.hasMoved) {
      if (drag.mode === 'move') {
        onOpen(entry);
      }
      return;
    }
    const { minutesDelta, dayDelta, durationMinutes: nextDuration } = drag.change;
    if (minutesDelta !== 0 || dayDelta !== 0 || nextDuration !== durationMinutes) {
      onChange(entry, drag.change);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(entry);
      return;
    }
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
      return;
    }
    event.preventDefault();
    const step = event.key === 'ArrowUp' ? -SNAP_MINUTES : SNAP_MINUTES;
    onChange(
      entry,
      event.shiftKey
        ? { ...baseChange, durationMinutes: Math.max(MIN_DURATION_MINUTES, durationMinutes + step) }
        : { ...baseChange, minutesDelta: step },
    );
  };

  const issueKeyNode = issueUrl ? (
    <a
      className={styles.calendarEntryBlock__keyLink}
      href={issueUrl}
      target="_blank"
      rel="noreferrer noopener"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {issue.key}
    </a>
  ) : (
    <span className={styles.calendarEntryBlock__key}>{issue.key}</span>
  );

  return (
    <div
      ref={blockRef}
      className={classNames(
        styles.calendarEntryBlock,
        styles[`calendarEntryBlock--${variant}`],
        preview && styles['calendarEntryBlock--dragging'],
        isCompact && styles['calendarEntryBlock--compact'],
      )}
      style={{
        top,
        height,
        left: `calc(${(lane / laneCount) * 100}% + ${CARD_SIDE_GUTTER_PX}px)`,
        width: `calc(${100 / laneCount}% - ${CARD_SIDE_GUTTER_PX * 2}px)`,
        zIndex: preview ? 40 : 10 + lane,
        transform: translateX ? `translateX(${translateX}px)` : undefined,
        ['--calendar-entry-accent' as string]: accentColor,
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <motion.div
        role="button"
        tabIndex={0}
        aria-label={`${issue.key} ${issue.summary}, ${format(entry.start, 'HH:mm')}, ${formatDuration(entry.durationSeconds)}. Arraste para mover; bordas ajustam início e fim.`}
        className={styles.calendarEntryBlock__card}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 480, damping: 32 }}
        onPointerDown={(event) => handlePointerDown(event, 'move')}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        title={issue.comment || issue.summary}
      >
        <button
          type="button"
          className={styles.calendarEntryBlock__copy}
          aria-label={`Copiar ${issue.key}`}
          title="Copiar worklog"
          onPointerDown={(event) => {
            event.stopPropagation();
            event.preventDefault();
            onCopy(entry, { x: event.clientX, y: event.clientY });
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <Copy size={12} aria-hidden strokeWidth={2.2} />
        </button>

        <div className={styles.calendarEntryBlock__issueRow}>
          <span
            className={classNames(
              styles.calendarEntryBlock__typeMark,
              styles[`calendarEntryBlock__typeMark--${typeMark}`],
            )}
            title={issue.issueTypeName || 'Tipo da issue'}
          >
            <IssueTypeIcon mark={typeMark} />
          </span>
          {issueKeyNode}
          {isCompact && (
            <span className={styles.calendarEntryBlock__duration}>
              {formatDuration(activeChange.durationMinutes * 60)}
            </span>
          )}
        </div>

        {!isCompact && (
          <>
            {height > 44 && <span className={styles.calendarEntryBlock__summary}>{issue.summary}</span>}
            <span className={styles.calendarEntryBlock__time}>
              {format(previewStart, 'HH:mm')}–{format(previewEnd, 'HH:mm')} ·{' '}
              {formatDuration(activeChange.durationMinutes * 60)}
            </span>
          </>
        )}

        <span
          className={classNames(styles.calendarEntryBlock__resizeHandle, styles['calendarEntryBlock__resizeHandle--start'])}
          onPointerDown={(event) => handlePointerDown(event, 'resize-start')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClick={(event) => event.stopPropagation()}
          title="Arraste para ajustar o início"
          aria-hidden
        />
        <span
          className={classNames(styles.calendarEntryBlock__resizeHandle, styles['calendarEntryBlock__resizeHandle--end'])}
          onPointerDown={(event) => handlePointerDown(event, 'resize-end')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClick={(event) => event.stopPropagation()}
          title="Arraste para ajustar o término"
          aria-hidden
        />
      </motion.div>
    </div>
  );
}
