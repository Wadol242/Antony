export const BRAZZAVILLE_TIMEZONE = 'Africa/Brazzaville';

/**
 * Formats an integer amount in FCFA with French space grouping, e.g. "15 000 FCFA".
 */
export function formatFcfa(amount: number): string {
  const safeAmount = Math.round(Number.isFinite(amount) ? amount : 0);
  const formatted = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
  })
    .format(safeAmount)
    .replace(/\u202f|\u00a0/g, ' ');
  return `${formatted} FCFA`;
}

/**
 * Formats minutes into a clear French duration, e.g. "45 min" or "3 h" or "1 h 30".
 */
export function formatDuration(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  if (safe < 60) return `${safe} min`;
  const hours = Math.floor(safe / 60);
  const rem = safe % 60;
  return rem === 0 ? `${hours} h` : `${hours} h ${rem.toString().padStart(2, '0')}`;
}

/**
 * Returns today's date in YYYY-MM-DD for the Africa/Brazzaville timezone.
 */
export function getTodayBrazzavilleISO(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BRAZZAVILLE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const year = parts.find((p) => p.type === 'year')?.value ?? '2026';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

/**
 * Converts a YYYY-MM-DD string to dd/mm/yyyy format.
 */
export function formatDateDDMMYYYY(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/**
 * Formats YYYY-MM-DD in French readable form (e.g. "lundi 16/11/2026") using Africa/Brazzaville.
 */
export function formatFrenchDayWithDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const dateObj = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0));
  const weekday = new Intl.DateTimeFormat('fr-FR', {
    timeZone: BRAZZAVILLE_TIMEZONE,
    weekday: 'long',
  }).format(dateObj);
  const capitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${capitalized} ${formatDateDDMMYYYY(isoDate)}`;
}

/**
 * Returns current time HH:MM in Africa/Brazzaville.
 */
export function getCurrentTimeBrazzaville(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: BRAZZAVILLE_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '09';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${hour}:${minute}`;
}
