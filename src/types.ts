import type { Timestamp } from 'firebase/firestore';

export type DayKey =
  | 'lundi'
  | 'mardi'
  | 'mercredi'
  | 'jeudi'
  | 'vendredi'
  | 'samedi'
  | 'dimanche';

export interface DayHours {
  open: boolean;
  start: string;
  end: string;
}

export type OpeningHoursMap = Record<DayKey, DayHours>;

export interface Salon {
  id: string;
  ownerId: string;
  slug?: string;
  name: string;
  neighborhood: string;
  phone: string;
  openingHours: OpeningHoursMap;
  onboardingCompleted: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ServiceItem {
  id: string;
  ownerId: string;
  name: string;
  durationMinutes: number;
  priceFcfa: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ClientItem {
  id: string;
  ownerId: string;
  name: string;
  phone: string;
  notes: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type AppointmentStatus = 'planifie' | 'confirme' | 'termine' | 'annule';

export type PaymentMethod = '' | 'especes' | 'mtn_momo' | 'airtel_money' | 'carte' | 'autre';

export interface AppointmentItem {
  id: string;
  ownerId: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  serviceId: string;
  serviceName: string;
  durationMinutes: number;
  priceFcfa: number;
  date: string; // YYYY-MM-DD (Africa/Brazzaville)
  time: string; // HH:MM
  status: AppointmentStatus;
  paymentMethod?: PaymentMethod;
  notes: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface PublicSalon {
  salonId: string;
  slug: string;
  name: string;
  openingHours: OpeningHoursMap;
}

export interface PublicService {
  id: string;
  salonId: string;
  name: string;
  durationMinutes: number;
  priceFcfa: number;
}

export interface TakenSlot {
  id: string;
  salonId: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  appointmentId: string;
}

export type NavTab =
  | 'dashboard'
  | 'appointments'
  | 'revenues'
  | 'clients'
  | 'services'
  | 'settings';
