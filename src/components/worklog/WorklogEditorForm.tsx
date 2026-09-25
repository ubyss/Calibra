import { format, parseISO } from 'date-fns';
import { useState } from 'react';

import { IssuePicker } from '@/components/issue/IssuePicker';
import type { IssueSelection } from '@/components/issue/useIssueSuggestions';
import { FormField, TextArea, TextInput } from '@/components/ui/FormField';
import type { WorklogDraft } from '@/types/domain';
import { combineDateAndTime } from '@/utils/date';
import { formatDuration, parseDuration } from '@/utils/duration';

import styles from './WorklogEditorForm.module.css';

const DURATION_PRESETS = ['15m', '30m', '1h', '2h', '4h'];

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
    issue: draft.issueKey ? { key: draft.issueKey, summary: draft.issueSummary ?? '' } : null,
    date: format(started, 'yyyy-MM-dd'),
    startTime: format(started, 'HH:mm'),
    duration: draft.durationSeconds ? formatDuration(draft.durationSeconds) : '',
    comment: draft.comment ?? '',
  };
}

export interface WorklogFormValidation {
  draft: WorklogDraft | null;
  errors: Partial<Record<'issue' | 'duration' | 'date', string>>;
}

export function validateWorklogForm(values: WorklogFormValues): WorklogFormValidation {
  const errors: WorklogFormValidation['errors'] = {};
  const durationSeconds = parseDuration(values.duration);

  if (!values.issue) {
    errors.issue = 'Escolha a issue que recebeu o esforço.';
  }
  if (!durationSeconds || durationSeconds < 60) {
    errors.duration = 'Use formatos como 45m, 1h 30m ou 1,5.';
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

export function WorklogEditorForm({ values, errors, onChange }: WorklogEditorFormProps) {
  const [hasTouchedDuration, setHasTouchedDuration] = useState(false);
  const update = (changes: Partial<WorklogFormValues>): void => onChange({ ...values, ...changes });
  const parsedDuration = parseDuration(values.duration);

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
              onChange={(event) => update({ startTime: event.target.value })}
            />
          )}
        </FormField>
        <FormField
          label="Duração"
          error={errors.duration}
          hint={hasTouchedDuration && parsedDuration ? `= ${formatDuration(parsedDuration)}` : undefined}
        >
          {(controlId, describedBy) => (
            <TextInput
              id={controlId}
              aria-describedby={describedBy}
              value={values.duration}
              placeholder="1h 30m"
              isInvalid={Boolean(errors.duration)}
              onChange={(event) => {
                setHasTouchedDuration(true);
                update({ duration: event.target.value });
              }}
            />
          )}
        </FormField>
      </div>

      <div className={styles.worklogEditorForm__presets} aria-label="Durações rápidas">
        {DURATION_PRESETS.map((preset) => (
          <button key={preset} type="button" className={styles.worklogEditorForm__preset} onClick={() => update({ duration: preset })}>
            {preset}
          </button>
        ))}
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
