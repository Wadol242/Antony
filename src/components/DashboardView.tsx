import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  Clock,
  MessageCircle,
  Scissors,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import { getPaymentMethodLabel } from '../constants/validation';
import type {
  AppointmentItem,
  ClientItem,
  NavTab,
  PaymentMethod,
  Salon,
  ServiceItem,
} from '../types';
import {
  formatDuration,
  formatFcfa,
  formatFrenchDayWithDate,
  getTodayBrazzavilleISO,
} from '../utils/formatters';
import { PaymentModal } from './PaymentModal';
import { WhatsAppReminderModal } from './WhatsAppReminderModal';

interface DashboardViewProps {
  salon: Salon;
  appointments: AppointmentItem[];
  clients: ClientItem[];
  services: ServiceItem[];
  onNewAppointment: () => void;
  onUpdateStatus: (
    appointmentId: string,
    status: 'termine' | 'annule',
    paymentMethod?: PaymentMethod,
    priceFcfa?: number
  ) => Promise<void>;
  onNavigate: (tab: NavTab) => void;
}

export function DashboardView({
  salon,
  appointments,
  clients,
  services,
  onNewAppointment,
  onUpdateStatus,
  onNavigate,
}: DashboardViewProps) {
  const todayISO = getTodayBrazzavilleISO();
  const [completing, setCompleting] = useState<AppointmentItem | null>(null);
  const [whatsappAppt, setWhatsappAppt] = useState<AppointmentItem | null>(null);

  const stats = useMemo(() => {
    const todayAppts = appointments.filter((a) => a.date === todayISO);
    const activeToday = todayAppts.filter((a) => a.status !== 'annule');
    const doneToday = todayAppts.filter((a) => a.status === 'termine');

    const expectedRevenue = activeToday.reduce((sum, a) => sum + a.priceFcfa, 0);
    const earnedRevenue = doneToday.reduce((sum, a) => sum + a.priceFcfa, 0);

    return {
      todayAppts,
      activeCount: activeToday.length,
      doneCount: doneToday.length,
      expectedRevenue,
      earnedRevenue,
    };
  }, [appointments, todayISO]);

  return (
    <div className="space-y-6">
      {/* Salon Hero Welcome */}
      <div className="bg-[#23093A] text-white rounded-3xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div>
          <p className="text-xs font-semibold text-[#DFB54B] mb-1.5 tabular-nums">
            {formatFrenchDayWithDate(todayISO)}
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-white">
            {salon.name}
          </h1>
          <p className="text-sm text-[#D8CBE6] mt-1">
            {salon.neighborhood} · {salon.phone}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 shrink-0">
          <button
            type="button"
            onClick={onNewAppointment}
            className="min-h-[50px] px-6 py-3 rounded-2xl bg-[#C89B2B] text-[#23093A] font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#DFB54B] active:scale-[0.99] transition-all whitespace-nowrap"
          >
            <CalendarPlus className="w-5 h-5" />
            <span>Nouveau rendez-vous</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('clients')}
            className="min-h-[50px] px-5 py-3 rounded-2xl bg-white/10 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-white/15 transition-colors whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4 text-[#DFB54B]" />
            <span>Ajouter un client</span>
          </button>
        </div>
      </div>

      {/* 3-card KPI summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl border border-[#EBE4F2] p-5 sm:p-6">
          <div className="flex items-center justify-between text-xs font-semibold text-[#6E5F7F] mb-2">
            <span>Rendez-vous du jour</span>
            <Calendar className="w-4 h-4 text-[#4C1D95]" />
          </div>
          <p className="font-display text-3xl font-bold text-[#23093A] tabular-nums">
            {stats.activeCount}
          </p>
          <p className="text-xs text-[#5E526B] mt-1 tabular-nums">
            {stats.doneCount} {stats.doneCount <= 1 ? 'terminé' : 'terminés'} aujourd'hui
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('revenues')}
          className="bg-white rounded-3xl border border-[#EBE4F2] p-5 sm:p-6 text-left hover:border-[#4C1D95] transition-colors group"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-[#6E5F7F] mb-2">
            <span>Recette encaissée</span>
            <span className="text-[#A87E15] font-bold">FCFA</span>
          </div>
          <p className="font-display text-2xl sm:text-3xl font-bold text-[#23093A] tabular-nums">
            {formatFcfa(stats.earnedRevenue)}
          </p>
          <div className="flex items-center justify-between gap-2 mt-1">
            <span className="text-xs text-[#5E526B] tabular-nums">
              Sur {formatFcfa(stats.expectedRevenue)} prévus
            </span>
            <span className="text-xs font-semibold text-[#4C1D95] group-hover:underline inline-flex items-center gap-1 whitespace-nowrap">
              <span>Page Revenus</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </button>

        <div className="bg-white rounded-3xl border border-[#EBE4F2] p-5 sm:p-6">
          <div className="flex items-center justify-between text-xs font-semibold text-[#6E5F7F] mb-2">
            <span>Répertoire du salon</span>
            <Users className="w-4 h-4 text-[#4C1D95]" />
          </div>
          <p className="font-display text-3xl font-bold text-[#23093A] tabular-nums">
            {clients.length}
          </p>
          <p className="text-xs text-[#5E526B] mt-1 tabular-nums">
            {clients.length <= 1 ? 'client' : 'clients'} · {services.length}{' '}
            {services.length <= 1 ? 'prestation' : 'prestations'}
          </p>
        </div>
      </div>

      {/* Today's Agenda */}
      <div className="bg-white rounded-3xl border border-[#EBE4F2] overflow-hidden">
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-[#F1ECF6] flex items-center justify-between gap-4">
          <h2 className="font-display text-xl font-semibold text-[#23093A]">
            Aujourd'hui au salon
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('appointments')}
            className="text-sm font-semibold text-[#4C1D95] hover:underline flex items-center gap-1 min-h-[40px] px-2 whitespace-nowrap"
          >
            <span>Voir le calendrier</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {stats.todayAppts.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-[#F3ECFA] text-[#4C1D95] flex items-center justify-center">
              <Scissors className="w-6 h-6" />
            </div>
            <p className="text-base font-semibold text-[#23093A] mb-1">
              Aucun rendez-vous aujourd'hui
            </p>
            <p className="text-sm text-[#5E526B] mb-5">
              Ajoutez votre premier rendez-vous de la journée pour suivre votre planning et vos
              recettes en FCFA.
            </p>
            <button
              type="button"
              onClick={onNewAppointment}
              className="min-h-[48px] px-6 py-3 rounded-2xl bg-[#4C1D95] text-white font-semibold text-sm inline-flex items-center gap-2 hover:bg-[#3B0764] transition-colors"
            >
              <CalendarPlus className="w-4 h-4 text-[#DFB54B]" />
              <span>Planifier un rendez-vous</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#F1ECF6]">
            {stats.todayAppts.map((appt) => (
              <div
                key={appt.id}
                className="p-4 sm:px-6 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="flex items-start gap-4 min-w-0">
                  <div className="pt-0.5 text-base font-bold text-[#4C1D95] tabular-nums w-14 shrink-0">
                    {appt.time}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-[#23093A] truncate">{appt.clientName}</p>
                    <p className="text-sm text-[#5E526B] tabular-nums">
                      {appt.serviceName} · {formatDuration(appt.durationMinutes)} ·{' '}
                      <span className="font-semibold text-[#A87E15]">
                        {formatFcfa(appt.priceFcfa)}
                      </span>
                      {appt.status === 'termine' && appt.paymentMethod ? (
                        <span className="text-[#166534] font-medium">
                          {' '}
                          · {getPaymentMethodLabel(appt.paymentMethod)}
                        </span>
                      ) : null}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0 pl-18 sm:pl-0">
                  {(appt.status === 'planifie' || appt.status === 'confirme') && (
                    <>
                      <button
                        type="button"
                        onClick={() => setCompleting(appt)}
                        className="min-h-[42px] px-4 py-2 rounded-xl bg-[#EEF8F1] text-[#166534] text-xs font-semibold flex items-center gap-1.5 hover:bg-[#DCFCE7] transition-colors whitespace-nowrap"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Marquer terminé</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setWhatsappAppt(appt)}
                        aria-label={`Rappel WhatsApp pour ${appt.clientName}`}
                        className="min-h-[42px] px-3 py-2 rounded-xl bg-[#F3ECFA] text-[#4C1D95] text-xs font-semibold flex items-center gap-1.5 hover:bg-[#E7DBF5] transition-colors whitespace-nowrap"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>WhatsApp</span>
                      </button>
                    </>
                  )}
                  {appt.status === 'termine' && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#166534] px-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Terminé</span>
                    </span>
                  )}
                  {appt.status === 'annule' && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#991B1B] px-2">
                      <XCircle className="w-4 h-4" />
                      <span>Annulé</span>
                    </span>
                  )}
                  {appt.status === 'planifie' && (
                    <span className="hidden lg:inline-flex items-center gap-1 text-xs text-[#6E5F7F]">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Planifié</span>
                    </span>
                  )}
                  {appt.status === 'confirme' && (
                    <span className="hidden lg:inline-flex items-center gap-1 text-xs font-semibold text-[#A87E15]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Confirmé</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <PaymentModal
        appointment={completing}
        onClose={() => setCompleting(null)}
        onConfirm={async (apptId, method, amountFcfa) => {
          await onUpdateStatus(apptId, 'termine', method, amountFcfa);
        }}
      />

      <WhatsAppReminderModal
        appointment={whatsappAppt}
        salonName={salon.name}
        onClose={() => setWhatsappAppt(null)}
      />
    </div>
  );
}
