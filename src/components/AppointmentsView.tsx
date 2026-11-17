import { useMemo, useState } from 'react';
import {
  Calendar,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  MessageCircle,
  Pencil,
  Trash2,
  XCircle,
} from 'lucide-react';
import { getPaymentMethodLabel } from '../constants/validation';
import type { AppointmentItem, AppointmentStatus, PaymentMethod } from '../types';
import {
  addDaysISO,
  getWeekDatesISO,
  getWeekStartMondayISO,
  minutesToTime,
  timeToMinutes,
} from '../utils/booking';
import { formatFirestoreErrorMessage } from '../utils/errors';
import {
  BRAZZAVILLE_TIMEZONE,
  formatDateDDMMYYYY,
  formatDuration,
  formatFcfa,
  formatFrenchDayWithDate,
  getTodayBrazzavilleISO,
} from '../utils/formatters';
import { ModalSheet } from './ModalSheet';
import { PaymentModal } from './PaymentModal';
import { WhatsAppReminderModal } from './WhatsAppReminderModal';

interface AppointmentsViewProps {
  salonName: string;
  appointments: AppointmentItem[];
  loading: boolean;
  onNewAppointment: (initialDate?: string) => void;
  onEditAppointment: (appointment: AppointmentItem) => void;
  onUpdateStatus: (
    appointmentId: string,
    status: 'termine' | 'annule',
    paymentMethod?: PaymentMethod,
    priceFcfa?: number
  ) => Promise<void>;
  onDeleteAppointment: (appointmentId: string) => Promise<void>;
}

type ViewMode = 'day' | 'week' | 'list';
type ListFilterMode = 'today' | 'upcoming' | 'all' | 'done';

function StatusLabel({ status }: { status: AppointmentStatus }) {
  if (status === 'termine') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#166534]">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        <span>Terminé</span>
      </span>
    );
  }
  if (status === 'confirme') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#A87E15]">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        <span>Confirmé</span>
      </span>
    );
  }
  if (status === 'annule') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#991B1B]">
        <XCircle className="w-4 h-4 shrink-0" />
        <span>Annulé</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4C1D95]">
      <Clock className="w-4 h-4 shrink-0" />
      <span>Planifié</span>
    </span>
  );
}

function getShortDayName(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return '';
  const dt = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0)
  );
  const label = new Intl.DateTimeFormat('fr-FR', {
    timeZone: BRAZZAVILLE_TIMEZONE,
    weekday: 'short',
  }).format(dt);
  return label.charAt(0).toUpperCase() + label.slice(1).replace('.', '');
}

export function AppointmentsView({
  salonName,
  appointments,
  loading,
  onNewAppointment,
  onEditAppointment,
  onUpdateStatus,
  onDeleteAppointment,
}: AppointmentsViewProps) {
  const todayISO = getTodayBrazzavilleISO();
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [focusedDate, setFocusedDate] = useState<string>(todayISO);
  const [listFilter, setListFilter] = useState<ListFilterMode>('upcoming');

  const [deleting, setDeleting] = useState<AppointmentItem | null>(null);
  const [completing, setCompleting] = useState<AppointmentItem | null>(null);
  const [whatsappAppt, setWhatsappAppt] = useState<AppointmentItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const weekStartISO = useMemo(() => getWeekStartMondayISO(focusedDate), [focusedDate]);
  const weekDates = useMemo(() => getWeekDatesISO(weekStartISO), [weekStartISO]);

  const dayAppointments = useMemo(() => {
    return appointments
      .filter((a) => a.date === focusedDate)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [appointments, focusedDate]);

  const listAppointments = useMemo(() => {
    switch (listFilter) {
      case 'today':
        return appointments.filter((a) => a.date === todayISO);
      case 'upcoming':
        return appointments.filter(
          (a) => a.date >= todayISO && (a.status === 'planifie' || a.status === 'confirme')
        );
      case 'done':
        return appointments.filter((a) => a.status === 'termine');
      case 'all':
      default:
        return [...appointments].sort((a, b) => {
          const d = b.date.localeCompare(a.date);
          if (d !== 0) return d;
          return a.time.localeCompare(b.time);
        });
    }
  }, [appointments, listFilter, todayISO]);

  const handleCancel = async (id: string) => {
    setActionError('');
    setBusyId(id);
    try {
      await onUpdateStatus(id, 'annule');
    } catch (err) {
      setActionError(formatFirestoreErrorMessage(err, "Impossible d'annuler le rendez-vous"));
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleting) return;
    setDeleteError('');
    setBusyId(deleting.id);
    try {
      await onDeleteAppointment(deleting.id);
      setDeleting(null);
    } catch (err) {
      setDeleteError(formatFirestoreErrorMessage(err, 'Impossible de supprimer le rendez-vous'));
    } finally {
      setBusyId(null);
    }
  };

  const renderAppointmentRow = (appt: AppointmentItem, showDate = true) => {
    const isPlanned = appt.status === 'planifie' || appt.status === 'confirme';
    const isBusy = busyId === appt.id;
    const endTime = minutesToTime(timeToMinutes(appt.time) + appt.durationMinutes);

    return (
      <div key={appt.id} className="p-4 sm:p-5 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-[#5E526B] tabular-nums mb-1">
              <span className="font-bold text-sm text-[#4C1D95]">
                {appt.time} – {endTime}
              </span>
              {showDate && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{formatFrenchDayWithDate(appt.date)}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <StatusLabel status={appt.status} />
              {appt.status === 'termine' && appt.paymentMethod && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-[#166534]">
                    {getPaymentMethodLabel(appt.paymentMethod)}
                  </span>
                </>
              )}
            </div>

            <h3 className="text-base font-semibold text-[#23093A]">
              {appt.clientName}
              {appt.clientPhone ? (
                <span className="font-normal text-sm text-[#6E5F7F] ml-2 tabular-nums">
                  {appt.clientPhone}
                </span>
              ) : null}
            </h3>

            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#4A3D58] tabular-nums">
              <span>{appt.serviceName}</span>
              <span aria-hidden="true">·</span>
              <span>{formatDuration(appt.durationMinutes)}</span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-[#A87E15]">{formatFcfa(appt.priceFcfa)}</span>
            </div>

            {appt.notes && <p className="mt-1.5 text-xs text-[#6E5F7F]">{appt.notes}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 sm:pt-0 shrink-0">
            {isPlanned && (
              <>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => setCompleting(appt)}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#EEF8F1] text-[#166534] text-xs font-semibold flex items-center gap-1.5 hover:bg-[#DCFCE7] transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Terminé</span>
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
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => onEditAppointment(appt)}
                  aria-label={`Modifier le rendez-vous de ${appt.clientName}`}
                  className="min-w-[42px] min-h-[42px] rounded-xl flex items-center justify-center text-[#4C1D95] hover:bg-[#F3ECFA] transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleCancel(appt.id)}
                  className="min-h-[42px] px-3 py-2 rounded-xl border border-[#EBE4F2] text-[#6E5F7F] text-xs font-semibold hover:bg-[#FDF2F2] hover:text-[#991B1B] transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  Annuler
                </button>
              </>
            )}
            <button
              type="button"
              disabled={isBusy}
              onClick={() => {
                setDeleteError('');
                setDeleting(appt);
              }}
              aria-label={`Supprimer le rendez-vous de ${appt.clientName}`}
              className="min-w-[42px] min-h-[42px] rounded-xl flex items-center justify-center text-[#991B1B] hover:bg-[#FDF2F2] transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#23093A]">
            Rendez-vous
          </h1>
          <p className="text-sm text-[#5E526B] mt-1 tabular-nums">
            Aujourd'hui : {formatDateDDMMYYYY(todayISO)} · Fuseau Africa/Brazzaville
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNewAppointment(viewMode === 'day' ? focusedDate : todayISO)}
          className="w-full sm:w-auto min-h-[48px] px-5 py-3 rounded-2xl bg-[#4C1D95] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#3B0764] active:scale-[0.99] transition-all whitespace-nowrap shrink-0"
        >
          <CalendarPlus className="w-5 h-5 text-[#DFB54B]" />
          <span>Nouveau rendez-vous</span>
        </button>
      </div>

      {/* View Mode Switcher: Jour | Semaine | Liste */}
      <div className="grid grid-cols-3 gap-1 p-1 bg-[#F1ECF6] rounded-2xl max-w-md">
        {(
          [
            { id: 'day', label: 'Jour' },
            { id: 'week', label: 'Semaine' },
            { id: 'list', label: 'Liste' },
          ] as { id: ViewMode; label: string }[]
        ).map((mode) => (
          <button
            key={mode.id}
            type="button"
            onClick={() => setViewMode(mode.id)}
            className={`min-h-[42px] px-4 py-2 text-sm font-semibold rounded-xl transition-colors whitespace-nowrap ${
              viewMode === mode.id
                ? 'bg-white text-[#23093A] shadow-xs'
                : 'text-[#5E526B] hover:text-[#23093A]'
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {actionError && (
        <div
          role="alert"
          className="rounded-2xl border border-[#F2C6C6] bg-[#FDF2F2] px-4 py-3 text-sm text-[#991B1B]"
        >
          {actionError}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-3xl border border-[#EBE4F2] p-8 text-center text-sm text-[#6E5F7F]">
          Chargement du calendrier…
        </div>
      ) : viewMode === 'day' ? (
        /* VUE JOUR */
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#EBE4F2] p-3 sm:px-5 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setFocusedDate((d) => addDaysISO(d, -1))}
              aria-label="Jour précédent"
              className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#4C1D95] hover:bg-[#F3ECFA]"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-center">
              <span className="font-display text-base sm:text-lg font-semibold text-[#23093A] tabular-nums">
                {formatFrenchDayWithDate(focusedDate)}
              </span>
              {focusedDate !== todayISO && (
                <button
                  type="button"
                  onClick={() => setFocusedDate(todayISO)}
                  className="text-xs font-semibold text-[#4C1D95] hover:underline"
                >
                  Revenir à aujourd'hui
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setFocusedDate((d) => addDaysISO(d, 1))}
              aria-label="Jour suivant"
              className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#4C1D95] hover:bg-[#F3ECFA]"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {dayAppointments.length === 0 ? (
            <div className="bg-white rounded-3xl border border-[#EBE4F2] p-8 sm:p-10 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#F3ECFA] text-[#4C1D95] flex items-center justify-center">
                <Calendar className="w-7 h-7" />
              </div>
              <h2 className="font-display text-xl font-semibold text-[#23093A] mb-2">
                Aucun rendez-vous le {formatDateDDMMYYYY(focusedDate)}
              </h2>
              <p className="text-sm text-[#5E526B] max-w-md mx-auto mb-6">
                Planifiez un rendez-vous pour cette journée en choisissant un client et une
                prestation.
              </p>
              <button
                type="button"
                onClick={() => onNewAppointment(focusedDate)}
                className="min-h-[48px] px-6 py-3 rounded-2xl bg-[#4C1D95] text-white font-semibold text-sm inline-flex items-center gap-2 hover:bg-[#3B0764] transition-colors"
              >
                <CalendarPlus className="w-4 h-4 text-[#DFB54B]" />
                <span>Ajouter pour ce jour</span>
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-[#EBE4F2] divide-y divide-[#F1ECF6] overflow-hidden">
              {dayAppointments.map((appt) => renderAppointmentRow(appt, false))}
            </div>
          )}
        </div>
      ) : viewMode === 'week' ? (
        /* VUE SEMAINE */
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#EBE4F2] p-3 sm:px-5 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setFocusedDate((d) => addDaysISO(d, -7))}
              aria-label="Semaine précédente"
              className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#4C1D95] hover:bg-[#F3ECFA]"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="text-center">
              <p className="font-display text-base sm:text-lg font-semibold text-[#23093A] tabular-nums">
                Semaine du {formatDateDDMMYYYY(weekDates[0])} au {formatDateDDMMYYYY(weekDates[6])}
              </p>
              {weekStartISO !== getWeekStartMondayISO(todayISO) && (
                <button
                  type="button"
                  onClick={() => setFocusedDate(todayISO)}
                  className="text-xs font-semibold text-[#4C1D95] hover:underline mt-0.5"
                >
                  Semaine actuelle
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setFocusedDate((d) => addDaysISO(d, 7))}
              aria-label="Semaine suivante"
              className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#4C1D95] hover:bg-[#F3ECFA]"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* 7-day selector strip (mobile & desktop) */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {weekDates.map((dateISO) => {
              const count = appointments.filter(
                (a) => a.date === dateISO && a.status !== 'annule'
              ).length;
              const isSelected = dateISO === focusedDate;
              const isToday = dateISO === todayISO;
              const dayNum = dateISO.slice(8, 10);

              return (
                <button
                  key={dateISO}
                  type="button"
                  onClick={() => setFocusedDate(dateISO)}
                  className={`min-h-[72px] p-1.5 sm:p-2.5 rounded-2xl border flex flex-col items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-[#4C1D95] border-[#4C1D95] text-white'
                      : isToday
                        ? 'bg-[#FBF4DE] border-[#DFB54B] text-[#23093A]'
                        : 'bg-white border-[#EBE4F2] text-[#23093A] hover:bg-[#FAF8FC]'
                  }`}
                >
                  <span
                    className={`text-[11px] font-medium ${
                      isSelected ? 'text-[#EAE2F3]' : 'text-[#6E5F7F]'
                    }`}
                  >
                    {getShortDayName(dateISO)}
                  </span>
                  <span className="text-base font-bold tabular-nums mt-0.5">{dayNum}</span>
                  <span
                    className={`text-[10px] font-semibold tabular-nums mt-1 ${
                      isSelected
                        ? 'text-[#DFB54B]'
                        : count > 0
                          ? 'text-[#4C1D95]'
                          : 'text-[#9689A6]'
                    }`}
                  >
                    {count} RDV
                  </span>
                </button>
              );
            })}
          </div>

          {/* Desktop 7-day summary columns + selected day full details */}
          <div className="bg-white rounded-3xl border border-[#EBE4F2] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#F1ECF6] flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold text-[#23093A] tabular-nums">
                  {formatFrenchDayWithDate(focusedDate)}
                </h2>
                <p className="text-xs text-[#5E526B] tabular-nums">
                  {dayAppointments.length}{' '}
                  {dayAppointments.length <= 1 ? 'rendez-vous' : 'rendez-vous'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNewAppointment(focusedDate)}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#F3ECFA] text-[#4C1D95] text-xs font-semibold flex items-center gap-1.5 hover:bg-[#E7DBF5] transition-colors whitespace-nowrap"
              >
                <CalendarPlus className="w-4 h-4" />
                <span>Ajouter</span>
              </button>
            </div>

            {dayAppointments.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#5E526B]">
                Aucun rendez-vous prévu ce jour-là.
              </div>
            ) : (
              <div className="divide-y divide-[#F1ECF6]">
                {dayAppointments.map((appt) => renderAppointmentRow(appt, false))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* VUE LISTE */
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-1 p-1 bg-[#F1ECF6] rounded-2xl max-w-lg">
            {(
              [
                { id: 'today', label: "Aujourd'hui" },
                { id: 'upcoming', label: 'À venir' },
                { id: 'done', label: 'Terminés' },
                { id: 'all', label: 'Tous' },
              ] as { id: ListFilterMode; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setListFilter(tab.id)}
                className={`min-h-[40px] px-2 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-colors whitespace-nowrap truncate ${
                  listFilter === tab.id
                    ? 'bg-white text-[#23093A] shadow-xs'
                    : 'text-[#5E526B] hover:text-[#23093A]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {listAppointments.length === 0 ? (
            <div className="bg-white rounded-3xl border border-[#EBE4F2] p-8 text-center">
              <p className="text-base font-semibold text-[#23093A] mb-1">
                Aucun rendez-vous dans cette vue
              </p>
              <p className="text-sm text-[#5E526B]">
                Changez de filtre ou créez un nouveau rendez-vous.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-[#EBE4F2] divide-y divide-[#F1ECF6] overflow-hidden">
              {listAppointments.map((appt) => renderAppointmentRow(appt, true))}
            </div>
          )}
        </div>
      )}

      {/* Payment method & amount modal when marking Terminé */}
      <PaymentModal
        appointment={completing}
        onClose={() => setCompleting(null)}
        onConfirm={async (apptId, method, amountFcfa) => {
          await onUpdateStatus(apptId, 'termine', method, amountFcfa);
        }}
      />

      {/* WhatsApp reminder modal */}
      <WhatsAppReminderModal
        appointment={whatsappAppt}
        salonName={salonName}
        onClose={() => setWhatsappAppt(null)}
      />

      {/* Delete confirmation */}
      <ModalSheet
        open={Boolean(deleting)}
        onClose={() => {
          setDeleting(null);
          setDeleteError('');
        }}
        title="Supprimer ce rendez-vous ?"
      >
        {deleteError && (
          <div
            role="alert"
            className="mb-4 rounded-2xl border border-[#F2C6C6] bg-[#FDF2F2] px-4 py-3 text-sm text-[#991B1B]"
          >
            {deleteError}
          </div>
        )}
        <p className="text-sm text-[#5E526B] mb-6 leading-relaxed">
          Voulez-vous supprimer le rendez-vous de{' '}
          <strong className="text-[#23093A]">{deleting?.clientName}</strong> prévu le{' '}
          <span className="tabular-nums">
            {deleting ? formatDateDDMMYYYY(deleting.date) : ''} à {deleting?.time}
          </span>{' '}
          ?
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => setDeleting(null)}
            className="w-full sm:w-1/2 min-h-[48px] px-5 py-3 rounded-2xl border border-[#DFD5EA] bg-white text-[#4A3D58] font-semibold text-sm hover:bg-[#FAF8FC]"
          >
            Conserver
          </button>
          <button
            type="button"
            onClick={handleConfirmDelete}
            disabled={busyId === deleting?.id}
            className="w-full sm:w-1/2 min-h-[48px] px-5 py-3 rounded-2xl bg-[#991B1B] text-white font-semibold text-sm hover:bg-[#7F1D1D] disabled:opacity-60"
          >
            Supprimer
          </button>
        </div>
      </ModalSheet>
    </div>
  );
}
