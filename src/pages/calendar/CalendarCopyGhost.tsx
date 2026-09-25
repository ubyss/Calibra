import { createPortal } from 'react-dom';

import { formatDuration } from '@/utils/duration';
import { resolveIssueTypeMark } from '@/utils/issue-type';
import { classNames } from '@/utils/misc';

import { minutesToPixels, projectColorFromKey } from './calendar-model';
import styles from './CalendarCopyGhost.module.css';

export type CalendarCopyDraft = {
  issueKey: string;
  issueSummary: string;
  issueTypeName: string;
  durationSeconds: number;
  comment: string;
};

type CalendarCopyGhostProps = {
  draft: CalendarCopyDraft;
  pointer: { x: number; y: number };
};

export function CalendarCopyGhost({ draft, pointer }: CalendarCopyGhostProps) {
  const typeMark = resolveIssueTypeMark(draft.issueTypeName);
  const height = Math.max(minutesToPixels(Math.round(draft.durationSeconds / 60)) - 2, 28);

  return createPortal(
    <div
      className={styles.calendarCopyGhost}
      style={{
        left: pointer.x + 12,
        top: pointer.y + 12,
        height,
        ['--calendar-entry-accent' as string]: projectColorFromKey(draft.issueKey),
      }}
      aria-hidden
    >
      <div className={styles.calendarCopyGhost__card}>
        <span
          className={classNames(
            styles.calendarCopyGhost__typeMark,
            styles[`calendarCopyGhost__typeMark--${typeMark}`],
          )}
        />
        <span className={styles.calendarCopyGhost__key}>{draft.issueKey}</span>
        <span className={styles.calendarCopyGhost__duration}>{formatDuration(draft.durationSeconds)}</span>
      </div>
    </div>,
    document.body,
  );
}
