import { useMemo, useState } from 'react';
import { Banknote, Calendar, Pencil, TrendingUp } from 'lucide-react';
import { getPaymentMethodLabel, PAYMENT_METHODS } from '../constants/validation';
import type { AppointmentItem, PaymentMethod } from '../types';
import { addDaysISO, getWeekStartMondayISO } from '../utils/booking';
import { formatDateDDMMYYYY, formatFcfa, getTodayBrazzavilleISO } from '../utils/formatters';
import { PaymentModal } from './PaymentModal';

interface RevenuesViewProps {
  appointments: AppointmentItem[];
  loading: boolean;
  onUpdatePaymentMethod: (
    appointmentId: string,
    method: PaymentMethod,
    priceFcfa?: number
  ) => Promise<void>;
}

type PeriodMode = 'today' | 'week' | 'month' | 'all';

export function RevenuesView({
  appointments,
  loading,
  onUpdatePaymentMethod,
}: RevenuesViewProps) {
  const [period, setPeriod] = useState<PeriodMode>('month');
  const [editingPayment, setEditingPayment] = useState<AppointmentItem | null>(null);

  const todayISO = getTodayBrazzavilleISO();
  const weekStartISO = getWeekStartMondayISO(todayISO);
  const weekEndISO = addDaysISO(weekStartISO, 6);
  const monthPrefix = todayISO.slice(0, 7);

  const periodAppointments = useMemo(() => {
    return appointments.filter((a) => {
      if (period === 'today') return a.date === todayISO;
      if (period === 'week') return a.date >= weekStartISO && a.date <= weekEndISO;
      if (period === 'month') return a.date.startsWith(monthPrefix);
      return true;
    });
  }, [appointments, period, todayISO, weekStartISO, weekEndISO, monthPrefix]);

  const stats = useMemo(() => {
    const done = periodAppointments
      .filter((a) => a.status === 'termine')
      .sort((a, b) => {
        const d = b.date.localeCompare(a.date);
        return d !== 0 ? d : b.time.localeCompare(a.time);
      });
    const planned = periodAppointments.filter(
      (a) => a.status === 'planifie' || a.status === 'confirme'
    );

    const totalEarned = done.reduce((sum, a) => sum + a.priceFcfa, 0);
    const totalExpected = planned.reduce((sum, a) => sum + a.priceFcfa, 0);
    const averageTicket = done.length > 0 ? Math.round(totalEarned / done.length) : 0;

    // Breakdown by payment method
    const methodMap = new Map<string, { label: string; total: number; count: number }>();
    for (const m of PAYMENT_METHODS) {
      methodMap.set(m.id, { label: m.label, total: 0, count: 0 });
    }
    methodMap.set('', { label: 'Non précisé', total: 0, count: 0 });

    for (const appt of done) {
      const key = appt.paymentMethod ?? '';
      const entry = methodMap.get(key) ?? { label: 'Non précisé', total: 0, count: 0 };
      entry.total += appt.priceFcfa;
      entry.count += 1;
      methodMap.set(key, entry);
    }

    const byPaymentMethod = Array.from(methodMap.entries())
      .map(([id, data]) => ({ id, ...data }))
      .filter((item) => item.count > 0 || item.id === 'especes' || item.id === 'mtn_momo' || item.id === 'airtel_money')
      .sort((a, b) => b.total - a.total);

    // Breakdown by service
    const serviceMap = new Map<string, { name: string; total: number; count: number }>();
    for (const appt of done) {
      const existing = serviceMap.get(appt.serviceName) ?? {
        name: appt.serviceName,
        total: 0,
        count: 0,
      };
      existing.total += appt.priceFcfa;
      existing.count += 1;
      serviceMap.set(appt.serviceName, existing);
    }
    const byService = Array.from(serviceMap.values()).sort((a, b) => b.total - a.total);

    return {
      done,
      totalEarned,
      totalExpected,
      averageTicket,
      byPaymentMethod,
      byService,
    };
  }, [periodAppointments]);

  const periodLabel =
    period === 'today'
      ? `Aujourd'hui (${formatDateDDMMYYYY(todayISO)})`
      : period === 'week'
        ? `Semaine du ${formatDateDDMMYYYY(weekStartISO)} au ${formatDateDDMMYYYY(weekEndISO)}`
        : period === 'month'
          ? 'Mois en cours'
          : 'Depuis le début';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#23093A]">
            Revenus & Caisse
          </h1>
          <p className="text-sm text-[#5E526B] mt-1 tabular-nums">{periodLabel}</p>
        </div>

        {/* Period switcher */}
        <div className="grid grid-cols-4 gap-1 p-1 bg-[#F1ECF6] rounded-2xl">
          {(
            [
              { id: 'today', label: 'Jour' },
              { id: 'week', label: 'Semaine' },
              { id: 'month', label: 'Mois' },
              { id: 'all', label: 'Tout' },
            ] as { id: PeriodMode; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setPeriod(tab.id)}
              className={`min-h-[40px] px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-colors whitespace-nowrap ${
                period === tab.id
                  ? 'bg-white text-[#23093A] shadow-xs'
                  : 'text-[#5E526B] hover:text-[#23093A]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#23093A] text-white rounded-3xl p-5 sm:p-6">
          <div className="flex items-center justify-between text-xs font-semibold text-[#DFB54B] mb-2">
            <span>Revenus encaissés</span>
            <Banknote className="w-4 h-4" />
          </div>
          <p className="font-display text-2xl sm:text-3xl font-bold text-white tabular-nums">
            {formatFcfa(stats.totalEarned)}
          </p>
          <p className="text-xs text-[#D8CBE6] mt-1 tabular-nums">
            {stats.done.length} {stats.done.length <= 1 ? 'prestation payée' : 'prestations payées'}
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-[#EBE4F2] p-5 sm:p-6">
          <div className="flex items-center justify-between text-xs font-semibold text-[#6E5F7F] mb-2">
            <span>À encaisser (prévu)</span>
            <Calendar className="w-4 h-4 text-[#4C1D95]" />
          </div>
          <p className="font-display text-2xl sm:text-3xl font-bold text-[#23093A] tabular-nums">
            {formatFcfa(stats.totalExpected)}
          </p>
          <p className="text-xs text-[#5E526B] mt-1">Rendez-vous planifiés ou confirmés</p>
        </div>

        <div className="bg-white rounded-3xl border border-[#EBE4F2] p-5 sm:p-6">
          <div className="flex items-center justify-between text-xs font-semibold text-[#6E5F7F] mb-2">
            <span>Panier moyen</span>
            <TrendingUp className="w-4 h-4 text-[#A87E15]" />
          </div>
          <p className="font-display text-2xl sm:text-3xl font-bold text-[#23093A] tabular-nums">
            {formatFcfa(stats.averageTicket)}
          </p>
          <p className="text-xs text-[#5E526B] mt-1">Par rendez-vous terminé</p>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-3xl border border-[#EBE4F2] p-8 text-center text-sm text-[#6E5F7F]">
          Calcul des recettes en cours…
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Breakdown by Payment Method */}
          <div className="bg-white rounded-3xl border border-[#EBE4F2] p-5 sm:p-6 space-y-4">
            <h2 className="font-display text-xl font-semibold text-[#23093A]">
              Par mode de paiement
            </h2>
            <div className="space-y-4">
              {stats.byPaymentMethod.map((item) => {
                const pct =
                  stats.totalEarned > 0
                    ? Math.round((item.total / stats.totalEarned) * 100)
                    : 0;
                return (
                  <div key={item.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold text-[#23093A]">
                        {item.label}
                        <span className="font-normal text-xs text-[#6E5F7F] ml-2 tabular-nums">
                          ({item.count})
                        </span>
                      </span>
                      <span className="font-bold text-[#23093A] tabular-nums">
                        {formatFcfa(item.total)}
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-[#F3ECFA] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#4C1D95] transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Breakdown by Service */}
          <div className="bg-white rounded-3xl border border-[#EBE4F2] p-5 sm:p-6 space-y-4">
            <h2 className="font-display text-xl font-semibold text-[#23093A]">
              Par prestation
            </h2>
            {stats.byService.length === 0 ? (
              <p className="text-sm text-[#5E526B] py-4">
                Aucune prestation terminée sur cette période. Marquez un rendez-vous comme « Terminé
                » pour le voir ici.
              </p>
            ) : (
              <div className="divide-y divide-[#F1ECF6]">
                {stats.byService.map((svc) => (
                  <div
                    key={svc.name}
                    className="py-3 flex items-center justify-between gap-4 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-[#23093A] truncate">{svc.name}</p>
                      <p className="text-xs text-[#6E5F7F] tabular-nums">
                        {svc.count} {svc.count <= 1 ? 'prestation' : 'prestations'}
                      </p>
                    </div>
                    <span className="font-bold text-sm text-[#A87E15] tabular-nums shrink-0">
                      {formatFcfa(svc.total)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Encaissements history */}
      <div className="bg-white rounded-3xl border border-[#EBE4F2] overflow-hidden">
        <div className="px-5 py-4 sm:px-6 border-b border-[#F1ECF6]">
          <h2 className="font-display text-xl font-semibold text-[#23093A]">
            Historique des encaissements
          </h2>
        </div>

        {stats.done.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-base font-semibold text-[#23093A] mb-1">
              Aucun encaissement sur cette période
            </p>
            <p className="text-sm text-[#5E526B]">
              Lorsqu'un rendez-vous est terminé, sélectionnez son mode de paiement pour l'ajouter à
              la caisse.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#F1ECF6]">
            {stats.done.map((appt) => (
              <div
                key={appt.id}
                className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-xs text-[#6E5F7F] tabular-nums">
                    {formatDateDDMMYYYY(appt.date)} · {appt.time} ·{' '}
                    <span className="font-semibold text-[#4C1D95]">
                      {getPaymentMethodLabel(appt.paymentMethod)}
                    </span>
                  </p>
                  <p className="text-sm font-semibold text-[#23093A] mt-0.5 truncate">
                    {appt.clientName} — {appt.serviceName}
                  </p>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                  <span className="font-bold text-base text-[#166534] tabular-nums">
                    {formatFcfa(appt.priceFcfa)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditingPayment(appt)}
                    aria-label={`Modifier le paiement de ${appt.clientName}`}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[#EBE4F2] text-xs font-semibold text-[#4C1D95] hover:bg-[#F3ECFA] flex items-center gap-1.5 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Paiement</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <PaymentModal
        appointment={editingPayment}
        onClose={() => setEditingPayment(null)}
        onConfirm={onUpdatePaymentMethod}
      />
    </div>
  );
}
