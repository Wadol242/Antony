import type { DayKey, OpeningHoursMap } from '../types';

export const LIMITS = {
  SALON_NAME_MAX: 100,
  SALON_NEIGHBORHOOD_MAX: 150,
  PHONE_MAX: 30,
  SERVICE_NAME_MAX: 80,
  SERVICE_DURATION_MIN: 5,
  SERVICE_DURATION_MAX: 480,
  SERVICE_PRICE_MIN: 0,
  SERVICE_PRICE_MAX: 10000000,
  CLIENT_NAME_MAX: 100,
  NOTES_MAX: 500,
  DATE_PATTERN: /^\d{4}-\d{2}-\d{2}$/,
  TIME_PATTERN: /^\d{2}:\d{2}$/,
  ID_PATTERN: /^[a-zA-Z0-9_\-]+$/,
} as const;

export const DAYS_ORDER: { key: DayKey; label: string }[] = [
  { key: 'lundi', label: 'Lundi' },
  { key: 'mardi', label: 'Mardi' },
  { key: 'mercredi', label: 'Mercredi' },
  { key: 'jeudi', label: 'Jeudi' },
  { key: 'vendredi', label: 'Vendredi' },
  { key: 'samedi', label: 'Samedi' },
  { key: 'dimanche', label: 'Dimanche' },
];

export const DEFAULT_OPENING_HOURS: OpeningHoursMap = {
  lundi: { open: true, start: '08:30', end: '19:00' },
  mardi: { open: true, start: '08:30', end: '19:00' },
  mercredi: { open: true, start: '08:30', end: '19:00' },
  jeudi: { open: true, start: '08:30', end: '19:00' },
  vendredi: { open: true, start: '08:30', end: '19:00' },
  samedi: { open: true, start: '08:00', end: '20:00' },
  dimanche: { open: false, start: '09:00', end: '17:00' },
};

export const STARTER_SERVICES: { name: string; durationMinutes: number; priceFcfa: number }[] = [
  { name: 'Coupe homme', durationMinutes: 30, priceFcfa: 3000 },
  { name: 'Coupe femme', durationMinutes: 45, priceFcfa: 5000 },
  { name: 'Tresses', durationMinutes: 180, priceFcfa: 15000 },
  { name: 'Brushing', durationMinutes: 45, priceFcfa: 6000 },
  { name: 'Barbe', durationMinutes: 20, priceFcfa: 2000 },
  { name: 'Manucure', durationMinutes: 45, priceFcfa: 5000 },
];

export function clampText(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

export function clampInt(value: number, min: number, max: number): number {
  const rounded = Math.round(Number.isFinite(value) ? value : min);
  return Math.max(min, Math.min(max, rounded));
}

export const PAYMENT_METHODS: { id: Exclude<import('../types').PaymentMethod, ''>; label: string }[] = [
  { id: 'especes', label: 'Espèces' },
  { id: 'mtn_momo', label: 'MTN MoMo' },
  { id: 'airtel_money', label: 'Airtel Money' },
  { id: 'carte', label: 'Carte bancaire' },
  { id: 'autre', label: 'Autre' },
];

export function getPaymentMethodLabel(method?: string): string {
  const found = PAYMENT_METHODS.find((m) => m.id === method);
  return found ? found.label : 'Non précisé';
}
