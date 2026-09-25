import { addDays, addMinutes, addWeeks, endOfDay, isSameDay, parseISO, startOfDay } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, Send, Table2, UploadCloud } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { ActionButton } from '@/components/ui/ActionButton';
import { ErrorNotice } from '@/components/ui/FeedbackStates';
import { SurfacePanel } from '@/components/ui/SurfacePanel';
import { useToast } from '@/components/ui/ToastProvider';
import { useWorklogEditor } from '@/components/worklog/WorklogEditorProvider';
import { useAsync } from '@/hooks/useAsync';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useStoredValue } from '@/hooks/useStoredValue';
import { useWorklogUpload } from '@/hooks/useWorklogUpload';
import { updateStorage } from '@/services/storage';
import { adoptRemoteWorklog, createWorklog, fetchRemoteWorklogs, updateWorklog } from '@/services/worklog-service';
import type { JiraIssue } from '@/types/jira';
import { formatMonthRange, formatWeekday, getWeekDays, toDateKey } from '@/utils/date';
import { formatDuration } from '@/utils/duration';
import { classNames, getErrorMessage } from '@/utils/misc';

import { type CalendarCopyDraft, CalendarCopyGhost } from './CalendarCopyGhost';
import {
  buildCalendarEntries,
  type CalendarEntry,
  getEntryIssue,
  groupEntriesByDay,
  pixelsToMinutes,
  snapMinutes,
  VISIBLE_START_HOUR,
} from './calendar-model';
import type { EntryChange } from './CalendarEntryBlock';
import { CalendarGrid, type CalendarDropPreview } from './CalendarGrid';
import styles from './CalendarPage.module.css';
import { TimesheetPanel } from './TimesheetPanel';
import { WorkItemsSidebar } from './WorkItemsSidebar';

type CopySession = {
  draft: CalendarCopyDraft;
  pointer: { x: number; y: number };
};

function resolveDropStart(clientX: number, clientY: number, daysByKey: Map<string, Date>): Date | null {
  const target = document.elementFromPoint(clientX, clientY);
  const column = target instanceof Element ? target.closest<HTMLElement>('[data-calendar-day]') : null;
  if (!column) {
    return null;
  }

  const dateKey = column.dataset.calendarDay;
  const day = dateKey ? daysByKey.get(dateKey) : undefined;
  if (!day) {
    return null;
  }

  const offsetY = clientY - column.getBoundingClientRect().top;
  const minutes = snapMinutes(pixelsToMinutes(offsetY)) + VISIBLE_START_HOUR * 60;
  const start = new Date(day);
  start.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return start;
}

export function CalendarPanel() {
  const { notify } = useToast();
  const { openWorklogEditor } = useWorklogEditor();
  const { upload, isUploading } = useWorklogUpload();
  const { value: account } = useStoredValue('account');
  const { value: settings } = useStoredValue('settings');
  const { value: worklogs } = useStoredValue('worklogs');
  const isCompactLayout = useMediaQuery('(max-width: 600px)');
  const [referenceDate, setReferenceDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => toDateKey(new Date()));
  const [isTimesheetOpen, setIsTimesheetOpen] = useState(false);
  const [copySession, setCopySession] = useState<CopySession | null>(null);
  const copySessionRef = useRef<CopySession | null>(null);
  copySessionRef.current = copySession;
  const isCopying = copySession !== null;
  const suppressCreateRef = useRef(false);

  const weekDays = useMemo(() => getWeekDays(referenceDate), [referenceDate]);
  const displayDays = useMemo(
    () => (settings.hideWeekends ? weekDays.filter((day) => day.getDay() !== 0 && day.getDay() !== 6) : weekDays),
    [weekDays, settings.hideWeekends],
  );
  const daysByKey = useMemo(() => new Map(displayDays.map((day) => [toDateKey(day), day])), [displayDays]);
  const weekStart = startOfDay(weekDays[0]);
  const weekEnd = endOfDay(weekDays[6]);
  const weekKey = toDateKey(weekStart);
  const weekFrom = toDateKey(weekStart);
  const weekTo = toDateKey(weekDays[6]);

  const remote = useAsync(
    () => fetchRemoteWorklogs(account ? [account.user] : [], weekStart, weekEnd),
    [weekKey, account?.user.id],
    Boolean(account),
  );

  const weekWorklogs = useMemo(
    () =>
      worklogs.filter((worklog) => {
        const started = parseISO(worklog.startedAt);
        return started >= weekStart && started <= weekEnd;
      }),
    [worklogs, weekKey],
  );

  const entriesByDay = useMemo(
    () => groupEntriesByDay(buildCalendarEntries(weekWorklogs, remote.data ?? [])),
    [weekWorklogs, remote.data],
  );

  const visibleDays = useMemo(
    () => (isCompactLayout ? displayDays.filter((day) => toDateKey(day) === selectedDay) : displayDays),
    [isCompactLayout, displayDays, selectedDay],
  );
  const pendingIds = weekWorklogs.filter((worklog) => worklog.status === 'pending').map((worklog) => worklog.id);

  const dropPreview = useMemo((): CalendarDropPreview | null => {
    if (!copySession) {
      return null;
    }
    const start = resolveDropStart(copySession.pointer.x, copySession.pointer.y, daysByKey);
    if (!start) {
      return null;
    }
    return { start, draft: copySession.draft };
  }, [copySession, daysByKey]);

  const toggleAutoUpload = (): void => {
    void updateStorage('settings', (current) => ({
      ...current,
      autoUploadWorklogs: !current.autoUploadWorklogs,
    }));
  };

  useEffect(() => {
    if (!isCopying) {
      return;
    }

    const handlePointerMove = (event: PointerEvent): void => {
      setCopySession((current) =>
        current ? { ...current, pointer: { x: event.clientX, y: event.clientY } } : current,
      );
    };

    const handlePointerUp = (event: PointerEvent): void => {
      const session = copySessionRef.current;
      if (!session) {
        return;
      }

      const start = resolveDropStart(event.clientX, event.clientY, daysByKey);
      if (!start) {
        setCopySession(null);
        return;
      }

      suppressCreateRef.current = true;
      window.setTimeout(() => {
        suppressCreateRef.current = false;
      }, 0);
      setCopySession(null);

      void createWorklog({
        ...session.draft,
        startedAt: start.toISOString(),
      })
        .then((worklog) => {
          notify(
            settings.autoUploadWorklogs
              ? 'Worklog salvo.'
              : `Colado ${worklog.issueKey} · ${formatDuration(worklog.durationSeconds)}.`,
          );
          if (settings.autoUploadWorklogs) {
            remote.reload();
          }
        })
        .catch((error: unknown) => {
          notify(getErrorMessage(error), 'error');
        });
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setCopySession(null);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCopying, daysByKey, notify, settings.autoUploadWorklogs, remote.reload]);

  const shiftWeek = (weeks: number): void => {
    const next = weeks === 0 ? new Date() : addWeeks(referenceDate, weeks);
    setReferenceDate(next);
    const nextDays = getWeekDays(next);
    const nextDisplay = settings.hideWeekends
      ? nextDays.filter((day) => day.getDay() !== 0 && day.getDay() !== 6)
      : nextDays;
    setSelectedDay(toDateKey(nextDisplay.find((day) => isSameDay(day, new Date())) ?? nextDisplay[0] ?? nextDays[0]));
  };

  const handleOpen = async (entry: CalendarEntry): Promise<void> => {
    if (copySession) {
      return;
    }
    if (entry.kind === 'local') {
      openWorklogEditor({ worklog: entry.worklog });
      return;
    }
    const worklog = await adoptRemoteWorklog(entry.remote);
    openWorklogEditor({ worklog });
  };

  const handleChange = (entry: CalendarEntry, change: EntryChange): void => {
    const nextStart = addMinutes(addDays(entry.start, change.dayDelta), change.minutesDelta);
    const apply = async (): Promise<void> => {
      const worklog = entry.kind === 'local' ? entry.worklog : await adoptRemoteWorklog(entry.remote);
      await updateWorklog(worklog.id, {
        startedAt: nextStart.toISOString(),
        durationSeconds: change.durationMinutes * 60,
      });
      if (settings.autoUploadWorklogs) {
        notify('Worklog salvo.');
        remote.reload();
        return;
      }
      if (worklog.jiraWorklogId || entry.kind === 'remote') {
        notify('Alterado localmente. Envie para atualizar no Jira.', 'info');
      }
    };
    void apply();
  };

  const handleCopy = (entry: CalendarEntry, pointer: { x: number; y: number }): void => {
    const issue = getEntryIssue(entry);
    setCopySession({
      draft: {
        issueKey: issue.key,
        issueSummary: issue.summary,
        issueTypeName: issue.issueTypeName,
        issueTypeIconUrl: issue.issueTypeIconUrl,
        durationSeconds: entry.durationSeconds,
        comment: issue.comment,
      },
      pointer,
    });
  };

  const handleCreate = (start: Date): void => {
    if (copySession || suppressCreateRef.current) {
      return;
    }
    openWorklogEditor({ draft: { startedAt: start.toISOString(), durationSeconds: 3600 } });
  };

  const handleSelectIssue = (issue: JiraIssue): void => {
    openWorklogEditor({
      draft: {
        issueKey: issue.key,
        issueSummary: issue.summary,
        issueTypeName: issue.issueTypeName,
        issueTypeIconUrl: issue.issueTypeIconUrl,
      },
    });
  };

  const handleDragIssue = (issue: JiraIssue, pointer: { x: number; y: number }): void => {
    setCopySession({
      draft: {
        issueKey: issue.key,
        issueSummary: issue.summary,
        issueTypeName: issue.issueTypeName,
        issueTypeIconUrl: issue.issueTypeIconUrl,
        durationSeconds: 30 * 60,
        comment: '',
      },
      pointer,
    });
  };

  const toggleHideWeekends = (): void => {
    void updateStorage('settings', (current) => ({ ...current, hideWeekends: !current.hideWeekends }));
  };

  return (
    <>
      <div
        className={classNames(
          styles.calendarPage__layout,
          copySession && styles['calendarPage__layout--copying'],
        )}
      >
        <SurfacePanel
          className={styles.calendarPage__main}
          title="Calendário"
          subtitle="Clique no card para editar, no código da issue para abrir no Jira. Arraste as bordas para redimensionar."
        >
          <div className={styles.calendarPage__tools}>
            <WorkItemsSidebar
              variant="inline"
              onSelectIssue={handleSelectIssue}
              onDragIssue={handleDragIssue}
            />
          </div>

          <div className={styles.calendarPage__toolbar}>
            <div className={styles.calendarPage__navigation}>
              <ActionButton variant="ghost" icon={ChevronLeft} label="Semana anterior" onClick={() => shiftWeek(-1)} />
              <ActionButton isCompact onClick={() => shiftWeek(0)}>
                Hoje
              </ActionButton>
              <ActionButton variant="ghost" icon={ChevronRight} label="Próxima semana" onClick={() => shiftWeek(1)} />
              <span className={styles.calendarPage__range}>{formatMonthRange(weekDays[0], weekDays[6])}</span>
            </div>
            <div className={styles.calendarPage__toolbarActions}>
              <div className={styles.calendarPage__viewToggles} role="group" aria-label="Opções de visualização">
                <ActionButton
                  variant="secondary"
                  isCompact
                  icon={CalendarDays}
                  aria-pressed={!settings.hideWeekends}
                  onClick={toggleHideWeekends}
                >
                  Fim de semana
                </ActionButton>
              </div>
              <span className={styles.calendarPage__toolbarDivider} aria-hidden />
              <ActionButton
                variant="secondary"
                isCompact
                icon={UploadCloud}
                disabled={pendingIds.length === 0}
                isLoading={isUploading}
                onClick={() => void upload(pendingIds)}
              >
                Enviar semana{pendingIds.length > 0 ? ` (${pendingIds.length})` : ''}
              </ActionButton>
              <ActionButton
                variant="secondary"
                isCompact
                icon={Send}
                aria-pressed={settings.autoUploadWorklogs}
                onClick={toggleAutoUpload}
              >
                Envio automático
              </ActionButton>
              <ActionButton variant="secondary" isCompact icon={Table2} onClick={() => setIsTimesheetOpen(true)}>
                Timesheet
              </ActionButton>
            </div>
          </div>

          {isCompactLayout && (
            <div className={styles.calendarPage__dayPicker} role="tablist" aria-label="Dia da semana">
              {displayDays.map((day) => {
                const dateKey = toDateKey(day);
                return (
                  <button
                    key={dateKey}
                    type="button"
                    role="tab"
                    aria-selected={dateKey === selectedDay}
                    className={classNames(
                      styles.calendarPage__dayChip,
                      dateKey === selectedDay && styles['calendarPage__dayChip--active'],
                    )}
                    onClick={() => setSelectedDay(dateKey)}
                  >
                    <span>{formatWeekday(day)}</span>
                    <span className={styles.calendarPage__dayChipNumber}>{day.getDate()}</span>
                  </button>
                );
              })}
            </div>
          )}

          {remote.error && <ErrorNotice message={remote.error} />}

          <CalendarGrid
            days={visibleDays}
            entriesByDay={entriesByDay}
            settings={settings}
            issueBaseUrl={account?.baseUrl}
            isCopyMode={Boolean(copySession)}
            dropPreview={dropPreview}
            onCreate={handleCreate}
            onOpen={(entry) => void handleOpen(entry)}
            onCopy={handleCopy}
            onChange={handleChange}
          />

          <div className={styles.calendarPage__legend}>
            <span className={styles.calendarPage__legendItem}>
              <span className={classNames(styles.calendarPage__legendSwatch, styles['calendarPage__legendSwatch--pending'])} />
              Pendente
            </span>
            <span className={styles.calendarPage__legendItem}>
              <span className={classNames(styles.calendarPage__legendSwatch, styles['calendarPage__legendSwatch--uploaded'])} />
              Enviado
            </span>
            <span className={styles.calendarPage__legendItem}>
              <span className={classNames(styles.calendarPage__legendSwatch, styles['calendarPage__legendSwatch--remote'])} />
              Registrado direto no Jira
            </span>
          </div>
        </SurfacePanel>
      </div>

      {copySession && <CalendarCopyGhost draft={copySession.draft} pointer={copySession.pointer} />}

      <TimesheetPanel
        isOpen={isTimesheetOpen}
        weekFrom={weekFrom}
        weekTo={weekTo}
        referenceDate={referenceDate}
        worklogs={worklogs}
        remoteWorklogs={remote.data ?? []}
        settings={settings}
        onClose={() => setIsTimesheetOpen(false)}
      />
    </>
  );
}
