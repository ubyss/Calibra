const UNIT_PATTERN = /(\d+(?:[.,]\d+)?)\s*(h|m|min)/gi;

/**
 * Converte textos como "1h 30m", "90m", "1:30", "1,5" ou "1.5h" em segundos.
 * Números sem unidade são interpretados como horas, que é como as pessoas costumam apontar.
 */
export function parseDuration(input: string): number | null {
  const text = input.trim().toLowerCase();
  if (!text) {
    return null;
  }

  const clockMatch = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (clockMatch) {
    return Number(clockMatch[1]) * 3600 + Number(clockMatch[2]) * 60;
  }

  if (/^\d+(?:[.,]\d+)?$/.test(text)) {
    return Math.round(Number(text.replace(',', '.')) * 3600);
  }

  let totalSeconds = 0;
  let consumed = '';
  for (const match of text.matchAll(UNIT_PATTERN)) {
    const value = Number(match[1].replace(',', '.'));
    totalSeconds += match[2] === 'h' ? value * 3600 : value * 60;
    consumed += match[0];
  }

  if (!consumed || consumed.replace(/\s/g, '').length !== text.replace(/\s/g, '').length) {
    return null;
  }

  return Math.round(totalSeconds);
}

export function formatDuration(totalSeconds: number): string {
  const totalMinutes = Math.round(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

export function formatClock(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
}

export function formatBadge(totalSeconds: number): string {
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h${String(minutes).padStart(2, '0')}` : `${minutes}m`;
}

export function roundSeconds(totalSeconds: number, roundToMinutes: number): number {
  const step = Math.max(1, roundToMinutes) * 60;
  return Math.max(60, Math.round(totalSeconds / step) * step);
}

export function formatHours(totalSeconds: number): string {
  return (totalSeconds / 3600).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}
