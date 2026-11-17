import type { AppointmentItem, DayHours, DayKey, TakenSlot } from '../types';
import { BRAZZAVILLE_TIMEZONE, formatDateDDMMYYYY, formatFcfa } from '../utils/formatters';

export function slugifySalonName(name: string): string {
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return normalized || 'salon';
}

export function normalizePhoneDigits(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  // Congo-Brazzaville local 9-digit format (e.g. 06 612 34 56 -> 242066123456)
  if (digits.length === 9 && digits.startsWith('0')) {
    digits = `242${digits}`;
  }
  return digits;
}

function sha256FallbackHex(str: string): string {
  const bytes = new TextEncoder().encode(str);
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);

  const bitLen = bytes.length * 8;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000) >>> 0, false);

  const w = new Uint32Array(64);
  const rotr = (n: number, x: number) => (x >>> n) | (x << (32 - n));

  for (let i = 0; i < paddedLen; i += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] = view.getUint32(i + t * 4, false);
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(7, w[t - 15]) ^ rotr(18, w[t - 15]) ^ (w[t - 15] >>> 3);
      const s1 = rotr(17, w[t - 2]) ^ rotr(19, w[t - 2]) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + w[t]) >>> 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  return Array.from(H)
    .map((word) => word.toString(16).padStart(8, '0'))
    .join('');
}

export async function hashPhoneForSalon(salonId: string, phone: string): Promise<string> {
  const normalized = normalizePhoneDigits(phone);
  const input = `${salonId}:${normalized}`;
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    const data = new TextEncoder().encode(input);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return sha256FallbackHex(input);
}

export function timeToMinutes(hhmm: string): number {
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

export function minutesToTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function getDayKeyFromISO(isoDate: string): DayKey {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return 'lundi';
  const dateObj = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0)
  );
  const keys: DayKey[] = [
    'dimanche',
    'lundi',
    'mardi',
    'mercredi',
    'jeudi',
    'vendredi',
    'samedi',
  ];
  return keys[dateObj.getUTCDay()] ?? 'lundi';
}

export function addDaysISO(isoDate: string, deltaDays: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const dt = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + deltaDays, 12, 0, 0)
  );
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function getWeekStartMondayISO(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const dt = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0)
  );
  const utcDay = dt.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diffToMonday = utcDay === 0 ? -6 : 1 - utcDay;
  return addDaysISO(isoDate, diffToMonday);
}

export function getWeekDatesISO(weekStartMondayISO: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysISO(weekStartMondayISO, i));
}

export function getNextDaysBrazzaville(count: number): string[] {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BRAZZAVILLE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const y = Number(parts.find((p) => p.type === 'year')?.value ?? '2026');
  const m = Number(parts.find((p) => p.type === 'month')?.value ?? '01');
  const d = Number(parts.find((p) => p.type === 'day')?.value ?? '01');

  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    const dt = new Date(Date.UTC(y, m - 1, d + i, 12, 0, 0));
    const yy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dt.getUTCDate()).padStart(2, '0');
    dates.push(`${yy}-${mm}-${dd}`);
  }
  return dates;
}

export function isSlotOverlapping(
  startMin: number,
  durationMinutes: number,
  takenSlots: Pick<TakenSlot, 'startTime' | 'durationMinutes'>[]
): boolean {
  const endMin = startMin + durationMinutes;
  return takenSlots.some((slot) => {
    const takenStart = timeToMinutes(slot.startTime);
    const takenEnd = takenStart + slot.durationMinutes;
    return startMin < takenEnd && endMin > takenStart;
  });
}

export function findOverlappingAppointment(params: {
  date: string;
  time: string;
  durationMinutes: number;
  appointments: AppointmentItem[];
  excludeId?: string;
}): AppointmentItem | null {
  const { date, time, durationMinutes, appointments, excludeId } = params;
  const startMin = timeToMinutes(time);
  const endMin = startMin + durationMinutes;

  for (const appt of appointments) {
    if (appt.id === excludeId) continue;
    if (appt.date !== date) continue;
    if (appt.status !== 'planifie' && appt.status !== 'confirme') continue;

    const existingStart = timeToMinutes(appt.time);
    const existingEnd = existingStart + appt.durationMinutes;
    if (startMin < existingEnd && endMin > existingStart) {
      return appt;
    }
  }
  return null;
}

export function computeAvailableSlots(params: {
  dayHours: DayHours;
  durationMinutes: number;
  takenSlots: Pick<TakenSlot, 'startTime' | 'durationMinutes'>[];
  isToday: boolean;
  currentMinutes: number;
}): string[] {
  const { dayHours, durationMinutes, takenSlots, isToday, currentMinutes } = params;
  if (!dayHours.open) return [];

  const openStart = timeToMinutes(dayHours.start);
  const openEnd = timeToMinutes(dayHours.end);
  if (openEnd <= openStart || openStart + durationMinutes > openEnd) {
    return [];
  }

  const available: string[] = [];
  for (let t = openStart; t + durationMinutes <= openEnd; t += 30) {
    if (isToday && t <= currentMinutes + 15) {
      continue;
    }
    if (!isSlotOverlapping(t, durationMinutes, takenSlots)) {
      available.push(minutesToTime(t));
    }
  }
  return available;
}

/**
 * Generates deterministic 30-minute bucket lock IDs for atomic Firestore double-booking prevention.
 * Caps at 6 locks per booking so a single writeBatch stays safely under Firestore's 20 rule-lookup limit.
 */
export function getSlotLockIds(
  date: string,
  startTime: string,
  durationMinutes: number
): string[] {
  const startMin = timeToMinutes(startTime);
  const endMin = startMin + Math.max(5, durationMinutes);
  const firstBucket = Math.floor(startMin / 30);
  const lastBucket = Math.floor((endMin - 1) / 30);

  const allBuckets: number[] = [];
  for (let b = firstBucket; b <= lastBucket; b++) {
    allBuckets.push(b);
  }

  let selected = allBuckets;
  if (allBuckets.length > 6) {
    const step = (allBuckets.length - 1) / 5;
    const picked = new Set<number>();
    for (let i = 0; i < 6; i++) {
      picked.add(allBuckets[Math.round(i * step)]);
    }
    selected = Array.from(picked).sort((a, b) => a - b);
  }

  return selected.map((b) => `${date}_b${b}`);
}

export function buildWhatsAppReminderText(params: {
  clientName: string;
  salonName: string;
  date: string;
  time: string;
  serviceName: string;
  priceFcfa: number;
}): string {
  const { clientName, salonName, date, time, serviceName, priceFcfa } = params;
  return `Bonjour ${clientName}, nous vous rappelons votre rendez-vous au salon ${salonName} le ${formatDateDDMMYYYY(date)} à ${time} pour : ${serviceName} (${formatFcfa(priceFcfa)}). À très bientôt !`;
}

export function buildWhatsAppLink(phone: string, message: string): string | null {
  const digits = normalizePhoneDigits(phone);
  if (digits.length < 6) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
