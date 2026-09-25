import { format, parseISO } from 'date-fns';
import { Timer } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { IssuePicker } from '@/components/issue/IssuePicker';
import type { IssueSelection } from '@/components/issue/useIssueSuggestions';
import { FormField, TextArea, TextInput } from '@/components/ui/FormField';
import type { WorklogDraft } from '@/types/domain';
import { combineDateAndTime } from '@/utils/date';
import { formatDuration, parseDuration } from '@/utils/duration';
import { classNames } from '@/utils/misc';

import styles from './WorklogEditorForm.module.css';

/** Stops do slider: 15m → 8h */
const DURATION_STOPS_MINUTES = [15, 30, 60, 120, 180, 240, 300, 360, 420, 480] as const;
const DURATION_LABELS: ReadonlyArray<{ minutes: number; label: string }> = [
  { minutes: 15, label: '15m' },
  { minutes: 60, label: '1h' },
  { minutes: 120, label: '2h' },
  { minutes: 240, label: '4h' },
  { minutes: 480, label: '8h' },
];

export interface WorklogFormValues {
  issue: IssueSelection | null;
  date: string;
  startTime: string;
  duration: string;
  comment: string;
}

export function toFormValues(draft: Partial<WorklogDraft>): WorklogFormValues {
  const started = draft.startedAt ? parseISO(draft.startedAt) : new Date();
  return {
    issue: draft.issueKey
      ? {
          key: draft.issueKey,
          summary: draft.issueSummary ?? '',
          issueTypeName: draft.issueTypeName,
          issueTypeIconUrl: draft.issueTypeIconUrl,
        }
      : null,
    date: format(started, 'yyyy-MM-dd'),
    startTime: format(started, 'HH:mm'),
    duration: draft.durationSeconds ? formatDuration(draft.durationSeconds) : '1h',
    comment: draft.comment ?? '',
  };
}

export interface WorklogFormValidation {
  draft: WorklogDraft | null;
  errors: Partial<Record<'issue' | 'duration' | 'date' | 'endTime', string>>;
}

function parseTimeToMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function computeEndTime(startTime: string, durationSeconds: number): string {
  const startMinutes = parseTimeToMinutes(startTime);
  if (startMinutes === null) {
    return '';
  }
  return minutesToTime(startMinutes + Math.round(durationSeconds / 60));
}

function snapDurationMinutes(minutes: number): number {
  let nearest = DURATION_STOPS_MINUTES[0];
  let bestDistance = Math.abs(minutes - nearest);
  for (const stop of DURATION_STOPS_MINUTES) {
    const distance = Math.abs(minutes - stop);
    if (distance < bestDistance) {
      nearest = stop;
      bestDistance = distance;
    }
  }
  return nearest;
}

function durationIndexFromSeconds(seconds: number | null): number {
  if (!seconds) {
    return DURATION_STOPS_MINUTES.indexOf(60);
  }
  const snapped = snapDurationMinutes(Math.round(seconds / 60));
  return Math.max(0, DURATION_STOPS_MINUTES.indexOf(snapped as (typeof DURATION_STOPS_MINUTES)[number]));
}

export function validateWorklogForm(values: WorklogFormValues): WorklogFormValidation {
  const errors: WorklogFormValidation['errors'] = {};
  const durationSeconds = parseDuration(values.duration);

  if (!values.issue) {
    errors.issue = 'Escolha a issue que recebeu o esforço.';
  }
  if (!durationSeconds || durationSeconds < 15 * 60) {
    errors.duration = 'A duração mínima é 15m.';
  }
  if (durationSeconds && durationSeconds > 8 * 3600) {
    errors.duration = 'A duração máxima é 8h.';
  }
  if (!values.date || !values.startTime) {
    errors.date = 'Informe data e horário de início.';
  }

  if (Object.keys(errors).length > 0 || !values.issue || !durationSeconds) {
    return { draft: null, errors };
  }

  return {
    errors,
    draft: {
      issueKey: values.issue.key,
      issueSummary: values.issue.summary,
      issueTypeName: values.issue.issueTypeName,
      issueTypeIconUrl: values.issue.issueTypeIconUrl,
      startedAt: combineDateAndTime(values.date, values.startTime).toISOString(),
      durationSeconds,
      comment: values.comment.trim(),
    },
  };
}

interface WorklogEditorFormProps {
  values: WorklogFormValues;
  errors: WorklogFormValidation['errors'];
  onChange: (values: WorklogFormValues) => void;
}

function DurationSliderField({
  value,
  error,
  onChange,
}: {
  value: string;
  error?: string;
  onChange: (duration: string) => void;
}) {
  const controlId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const parsedSeconds = parseDuration(value);
  const sliderIndex = durationIndexFromSeconds(parsedSeconds);
  const displayLabel = parsedSeconds ? formatDuration(parsedSeconds) : value || '1h';
  const maxIndex = DURATION_STOPS_MINUTES.length - 1;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent): void => {
      if (!(event.target instanceof Node)) {
        return;
      }
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const fillPercent = maxIndex === 0 ? 0 : (sliderIndex / maxIndex) * 100;

  return (
    <div ref={rootRef} className={styles.worklogEditorForm__durationField}>
      <FormField label="Duração" error={error}>
        {(fieldId) => (
          <button
            id={fieldId || controlId}
            type="button"
            className={classNames(
              styles.worklogEditorForm__durationTrigger,
              isOpen && styles['worklogEditorForm__durationTrigger--open'],
              error && styles['worklogEditorForm__durationTrigger--invalid'],
            )}
            aria-expanded={isOpen}
            aria-haspopup="dialog"
            onClick={() => setIsOpen((open) => !open)}
          >
            <span>{displayLabel}</span>
            <span className={styles.worklogEditorForm__durationTriggerIcon} aria-hidden>
              <Timer size={16} strokeWidth={2.2} />
            </span>
          </button>
        )}
      </FormField>

      {isOpen && (
        <div className={styles.worklogEditorForm__durationPopover} role="dialog" aria-label="Selecionar duração">
          <div className={styles.worklogEditorForm__durationPopoverHeader}>
            <span className={styles.worklogEditorForm__durationPopoverTitle}>Duração</span>
            <span className={styles.worklogEditorForm__durationPopoverValue}>{displayLabel}</span>
          </div>

          <div className={styles.worklogEditorForm__durationSliderTrack}>
            <div className={styles.worklogEditorForm__durationSliderFill} style={{ width: `${fillPercent}%` }} />
            <input
              type="range"
              className={styles.worklogEditorForm__durationSlider}
              min={0}
              max={maxIndex}
              step={1}
              value={sliderIndex}
              aria-valuetext={displayLabel}
              aria-label="Duração"
              onChange={(event) => {
                const nextIndex = Number(event.target.value);
                const minutes = DURATION_STOPS_MINUTES[nextIndex] ?? 60;
                onChange(formatDuration(minutes * 60));
              }}
            />
          </div>

          <div className={styles.worklogEditorForm__durationLabels} aria-hidden>
            {DURATION_LABELS.map((item) => {
              const stopIndex = DURATION_STOPS_MINUTES.indexOf(item.minutes as (typeof DURATION_STOPS_MINUTES)[number]);
              const left = maxIndex === 0 ? 0 : (stopIndex / maxIndex) * 100;
              return (
                <button
                  key={item.label}
                  type="button"
                  className={classNames(
                    styles.worklogEditorForm__durationLabel,
                    stopIndex === sliderIndex && styles['worklogEditorForm__durationLabel--active'],
                  )}
                  style={{ left: `${left}%` }}
                  onClick={() => onChange(formatDuration(item.minutes * 60))}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function WorklogEditorForm({ values, errors, onChange }: WorklogEditorFormProps) {
  const update = (changes: Partial<WorklogFormValues>): void => onChange({ ...values, ...changes });
  const parsedDuration = parseDuration(values.duration);

  const endTime = useMemo(() => {
    if (!parsedDuration) {
      return '';
    }
    return computeEndTime(values.startTime, parsedDuration);
  }, [parsedDuration, values.startTime]);

  const handleStartChange = (startTime: string): void => {
    update({ startTime });
  };

  const handleEndChange = (nextEndTime: string): void => {
    const startMinutes = parseTimeToMinutes(values.startTime);
    const endMinutes = parseTimeToMinutes(nextEndTime);
    if (startMinutes === null || endMinutes === null) {
      return;
    }

    let durationMinutes = endMinutes - startMinutes;
    if (durationMinutes <= 0) {
      durationMinutes += 24 * 60;
    }

    const clamped = Math.min(8 * 60, Math.max(15, durationMinutes));
    const snapped = snapDurationMinutes(clamped);
    update({ duration: formatDuration(snapped * 60) });
  };

  const handleDurationChange = (duration: string): void => {
    update({ duration });
  };

  return (
    <div className={styles.worklogEditorForm}>
      <FormField label="Issue" error={errors.issue}>
        {(controlId) => <IssuePicker inputId={controlId} value={values.issue} onChange={(issue) => update({ issue })} />}
      </FormField>

      <div className={styles.worklogEditorForm__timing}>
        <FormField label="Data" error={errors.date} className={styles.worklogEditorForm__date}>
          {(controlId) => (
            <TextInput id={controlId} type="date" value={values.date} onChange={(event) => update({ date: event.target.value })} />
          )}
        </FormField>
        <FormField label="Início">
          {(controlId) => (
            <TextInput
              id={controlId}
              type="time"
              value={values.startTime}
              onChange={(event) => handleStartChange(event.target.value)}
            />
          )}
        </FormField>
        <FormField label="Fim" error={errors.endTime}>
          {(controlId) => (
            <TextInput
              id={controlId}
              type="time"
              value={endTime}
              onChange={(event) => handleEndChange(event.target.value)}
            />
          )}
        </FormField>
        <DurationSliderField value={values.duration} error={errors.duration} onChange={handleDurationChange} />
      </div>

      <FormField label="Comentário" hint="Opcional. Aparece no worklog do Jira.">
        {(controlId, describedBy) => (
          <TextArea
            id={controlId}
            aria-describedby={describedBy}
            value={values.comment}
            placeholder="O que foi feito?"
            onChange={(event) => update({ comment: event.target.value })}
          />
        )}
      </FormField>
    </div>
  );
}
