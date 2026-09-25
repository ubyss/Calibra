import { ISSUE_KEY_PATTERN } from '@/constants/defaults';
import type { WorklogDraft } from '@/types/domain';
import { parseCsv, toCsv } from '@/utils/csv';
import { combineDateAndTime } from '@/utils/date';
import { parseDuration } from '@/utils/duration';

export interface ImportRow {
  line: number;
  issueKey: string;
  date: string;
  startTime: string;
  durationText: string;
  comment: string;
  errors: string[];
  draft: WorklogDraft | null;
}

type ColumnName = 'issue' | 'date' | 'start' | 'duration' | 'comment';

const COLUMN_ALIASES: Record<ColumnName, string[]> = {
  issue: ['issue', 'ticket', 'chave', 'key'],
  date: ['data', 'date', 'dia'],
  start: ['inicio', 'início', 'start', 'hora'],
  duration: ['duracao', 'duração', 'duration', 'horas', 'tempo'],
  comment: ['comentario', 'comentário', 'comment', 'descricao', 'descrição'],
};

export const CSV_TEMPLATE = toCsv([
  ['issue', 'data', 'inicio', 'duracao', 'comentario'],
  ['PROJ-123', '25/09/2026', '09:00', '1h 30m', 'Revisão do fluxo de checkout'],
  ['PROJ-124', '2026-09-25', '14:00', '2', 'Reunião de planejamento'],
]);

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

function parseDate(value: string): string | null {
  const text = value.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (isoMatch) {
    return text;
  }
  const brMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2].padStart(2, '0')}-${brMatch[1].padStart(2, '0')}`;
  }
  return null;
}

function parseTime(value: string): string | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) {
    return null;
  }
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

export function parseWorklogCsv(content: string): ImportRow[] {
  const [header, ...rows] = parseCsv(content);
  if (!header) {
    return [];
  }

  const normalizedHeader = header.map(normalizeHeader);
  const columnIndex = Object.fromEntries(
    (Object.keys(COLUMN_ALIASES) as ColumnName[]).map((column) => [
      column,
      normalizedHeader.findIndex((name) => COLUMN_ALIASES[column].includes(name)),
    ]),
  ) as Record<ColumnName, number>;

  return rows.map((cells, index) => {
    const read = (column: ColumnName): string => (columnIndex[column] >= 0 ? cells[columnIndex[column]] ?? '' : '').trim();
    const issueKey = read('issue').toUpperCase();
    const date = parseDate(read('date'));
    const startTime = parseTime(read('start') || '09:00');
    const durationSeconds = parseDuration(read('duration'));
    const errors: string[] = [];

    if (!ISSUE_KEY_PATTERN.test(issueKey)) {
      errors.push('Chave de issue inválida');
    }
    if (!date) {
      errors.push('Data inválida');
    }
    if (!startTime) {
      errors.push('Horário inválido');
    }
    if (!durationSeconds || durationSeconds < 60) {
      errors.push('Duração inválida');
    }

    const draft: WorklogDraft | null =
      errors.length === 0 && date && startTime && durationSeconds
        ? {
            issueKey,
            startedAt: combineDateAndTime(date, startTime).toISOString(),
            durationSeconds,
            comment: read('comment'),
          }
        : null;

    return {
      line: index + 2,
      issueKey,
      date: read('date'),
      startTime: read('start') || '09:00',
      durationText: read('duration'),
      comment: read('comment'),
      errors,
      draft,
    };
  });
}
