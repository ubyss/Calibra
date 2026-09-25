import { addDays, eachDayOfInterval, format, isValid, parseISO, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function toJiraDateTime(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm:ss.SSSxx");
}

export function toDateKey(date: Date): string {
  if (!isValid(date)) {
    return '';
  }
  return format(date, 'yyyy-MM-dd');
}

export function formatLongDate(date: Date): string {
  return format(date, "EEEE, d 'de' MMMM", { locale: ptBR });
}

export function formatShortDate(date: Date): string {
  return format(date, 'dd/MM', { locale: ptBR });
}

export function formatDateTime(isoDate: string): string {
  return format(parseISO(isoDate), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

export function formatTime(isoDate: string): string {
  return format(parseISO(isoDate), 'HH:mm');
}

export function formatWeekday(date: Date): string {
  return format(date, 'EEE', { locale: ptBR }).replace('.', '');
}

export function formatMonthRange(start: Date, end: Date): string {
  const startLabel = format(start, "d 'de' MMM", { locale: ptBR });
  const endLabel = format(end, "d 'de' MMM yyyy", { locale: ptBR });
  return `${startLabel} – ${endLabel}`;
}

export function getWeekDays(reference: Date): Date[] {
  const start = startOfWeek(reference, { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end: addDays(start, 6) });
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + (minutes || 0);
}

export function combineDateAndTime(dateKey: string, time: string): Date {
  return parseISO(`${dateKey}T${time}:00`);
}
