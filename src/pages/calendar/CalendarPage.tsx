import { addDays, addMinutes, addWeeks, endOfDay, isSameDay, parseISO, startOfDay } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, Cloud, PanelLeft, Plus, Table2, UploadCloud } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { PageHeader } from '@/components/layout/PageHeader';
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
import { CalendarGrid } from './CalendarGrid';
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

export function CalendarPage() {
  const { notify } = useToast();
  const { openWorklogEditor } = useWorklogEditor();
  const { upload, isUploading } = useWorklogUpload();
  const { value: account } = useStoredValue('account');
  const { value: settings } = useStoredValue('settings');
  const { value: worklogs } = useStoredValue('worklogs');
  const isCompactLayout = useMediaQuery('(max-width: 600px)');
  const [referenceDate, setReferenceDate] = useState(() => new Date());
  const [shouldShowRemote, setShouldShowRemote] = useState(true);
  const [selectedDay, setSelectedDay] = useState(() => toDateKey(new Date()));
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
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
    shouldShowRemote && Boolean(account),
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
    () => groupEntriesByDay(buildCalendarEntries(weekWorklogs, shouldShowRemote ? remote.data ?? [] : [])),
    [weekWorklogs, remote.data, shouldShowRemote],
  );

  const visibleDays = useMemo(
    () => (isCompactLayout ? displayDays.filter((day) => toDateKey(day) === selectedDay) : displayDays),
    [isCompactLayout, displayDays, selectedDay],
  );
  const pendingIds = weekWorklogs.filter((worklog) => worklog.status === 'pending').map((worklog) => worklog.id);

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
      setCopySession(null);
      if (!session) {
        return;
      }

      const start = resolveDropStart(event.clientX, event.clientY, daysByKey);
      if (!start) {
        return;
      }

      void createWorklog({
        ...session.draft,
        startedAt: start.toISOString(),
      })
        .then((worklog) => {
          notify(`Colado ${worklog.issueKey} · ${formatDuration(worklog.durationSeconds)}.`);
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
  }, [isCopying, daysByKey, notify]);

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
        durationSeconds: entry.durationSeconds,
        comment: issue.comment,
      },
      pointer,
    });
  };

  const handleCreate = (start: Date): void => {
    if (copySession) {
      return;
    }
    openWorklogEditor({ draft: { startedAt: start.toISOString(), durationSeconds: 3600 } });
  };

  const handleSelectIssue = (issue: JiraIssue): void => {
    openWorklogEditor({
      draft: {
        issueKey: issue.key,
        issueSummary: issue.summary,
      },
    });
  };

  const toggleHideWeekends = (): void => {
    void updateStorage('settings', (current) => ({ ...current, hideWeekends: !current.hideWeekends }));
  };

  return (
    <>
      <PageHeader
        title="Calendário"
        description="Clique no card para editar, no código da issue para abrir no Jira. Arraste as bordas para redimensionar."
        actions={
          <>
            <ActionButton
              icon={UploadCloud}
              disabled={pendingIds.length === 0}
              isLoading={isUploading}
              onClick={() => void upload(pendingIds)}
            >
              Enviar semana{pendingIds.length > 0 ? ` (${pendingIds.length})` : ''}
            </ActionButton>
            <ActionButton variant="primary" icon={Plus} onClick={() => openWorklogEditor()}>
              Novo
            </ActionButton>
          </>
        }
      />

      <div
        className={classNames(
          styles.calendarPage__layout,
          isSidebarOpen && styles['calendarPage__layout--withSidebar'],
          copySession && styles['calendarPage__layout--copying'],
        )}
      >
        {isSidebarOpen && (
          <div className={styles.calendarPage__sidebar}>
            <WorkItemsSidebar
              isCollapsible
              onCollapse={() => setIsSidebarOpen(false)}
              onSelectIssue={handleSelectIssue}
            />
          </div>
        )}

        <SurfacePanel className={styles.calendarPage__main}>
          <div className={styles.calendarPage__toolbar}>
            <div className={styles.calendarPage__navigation}>
              {!isSidebarOpen && (
                <ActionButton
                  variant="ghost"
                  icon={PanelLeft}
                  label="Mostrar itens de trabalho"
                  onClick={() => setIsSidebarOpen(true)}
                />
              )}
              <ActionButton variant="ghost" icon={ChevronLeft} label="Semana anterior" onClick={() => shiftWeek(-1)} />
              <ActionButton isCompact onClick={() => shiftWeek(0)}>
                Hoje
              </ActionButton>
              <ActionButton variant="ghost" icon={ChevronRight} label="Próxima semana" onClick={() => shiftWeek(1)} />
              <span className={styles.calendarPage__range}>{formatMonthRange(weekDays[0], weekDays[6])}</span>
            </div>
            <div className={styles.calendarPage__toolbarActions}>
              {copySession && (
                <span className={styles.calendarPage__copyHint}>
                  Solte no calendário para colar · Esc cancela
                </span>
              )}
              <ActionButton
                variant="ghost"
                isCompact
                icon={CalendarDays}
                aria-pressed={settings.hideWeekends}
                onClick={toggleHideWeekends}
              >
                {settings.hideWeekends ? 'Mostrar fim de semana' : 'Ocultar fim de semana'}
              </ActionButton>
              <ActionButton variant="ghost" isCompact icon={Table2} onClick={() => setIsTimesheetOpen(true)}>
                Timesheet
              </ActionButton>
              <ActionButton
                variant="ghost"
                isCompact
                icon={Cloud}
                aria-pressed={shouldShowRemote}
                isLoading={shouldShowRemote && remote.isLoading}
                onClick={() => setShouldShowRemote((current) => !current)}
              >
                Worklogs do Jira
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

          {remote.error && shouldShowRemote && <ErrorNotice message={remote.error} />}

          <CalendarGrid
            days={visibleDays}
            entriesByDay={entriesByDay}
            settings={settings}
            issueBaseUrl={account?.baseUrl}
            isCopyMode={Boolean(copySession)}
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
        remoteWorklogs={shouldShowRemote ? remote.data ?? [] : []}
        settings={settings}
        onClose={() => setIsTimesheetOpen(false)}
      />
    </>
  );
}
