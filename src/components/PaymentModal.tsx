import React, { useEffect, useState } from 'react';
import { Banknote, CheckCircle2, CreditCard, Smartphone, Wallet } from 'lucide-react';
import { LIMITS, PAYMENT_METHODS } from '../constants/validation';
import type { AppointmentItem, PaymentMethod } from '../types';
import { formatFirestoreErrorMessage } from '../utils/errors';
import { formatDateDDMMYYYY, formatFcfa } from '../utils/formatters';
import { ModalSheet } from './ModalSheet';

interface PaymentModalProps {
  appointment: AppointmentItem | null;
  onClose: () => void;
  onConfirm: (
    appointmentId: string,
    paymentMethod: PaymentMethod,
    amountFcfa: number
  ) => Promise<void>;
}

function PaymentIcon({ id }: { id: string }) {
  switch (id) {
    case 'especes':
      return <Banknote className="w-5 h-5" />;
    case 'mtn_momo':
    case 'airtel_money':
      return <Smartphone className="w-5 h-5" />;
    case 'carte':
      return <CreditCard className="w-5 h-5" />;
    default:
      return <Wallet className="w-5 h-5" />;
  }
}

export function PaymentModal({ appointment, onClose, onConfirm }: PaymentModalProps) {
  const [selected, setSelected] = useState<PaymentMethod>('especes');
  const [amountInput, setAmountInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (appointment) {
      setSelected(appointment.paymentMethod || 'especes');
      setAmountInput(String(appointment.priceFcfa));
      setError('');
    }
  }, [appointment]);

  if (!appointment) return null;

  const isAlreadyDone = appointment.status === 'termine';

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const parsedAmount = parseInt(amountInput.replace(/\s+/g, ''), 10);
    if (
      Number.isNaN(parsedAmount) ||
      parsedAmount < LIMITS.SERVICE_PRICE_MIN ||
      parsedAmount > LIMITS.SERVICE_PRICE_MAX
    ) {
      setError('Veuillez saisir un montant valide en FCFA (0 ou plus).');
      return;
    }

    setSaving(true);
    try {
      await onConfirm(appointment.id, selected, parsedAmount);
      onClose();
    } catch (err) {
      setError(formatFirestoreErrorMessage(err, "Impossible d'enregistrer le paiement"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheet
      open={Boolean(appointment)}
      onClose={onClose}
      title={isAlreadyDone ? 'Modifier le paiement' : 'Encaisser et terminer'}
    >
      <form onSubmit={handleConfirm} className="space-y-5">
        {error && (
          <div
            role="alert"
            className="rounded-2xl border border-[#F2C6C6] bg-[#FDF2F2] px-4 py-3 text-sm text-[#991B1B]"
          >
            {error}
          </div>
        )}

        <div className="rounded-2xl bg-[#FAF8FC] border border-[#EBE4F2] p-4">
          <p className="text-xs text-[#6E5F7F] tabular-nums">
            {formatDateDDMMYYYY(appointment.date)} à {appointment.time}
          </p>
          <p className="text-base font-semibold text-[#23093A] mt-0.5">
            {appointment.clientName} · {appointment.serviceName}
          </p>
          <p className="text-xs text-[#5E526B] mt-1 tabular-nums">
            Tarif prévu : <strong className="text-[#23093A]">{formatFcfa(appointment.priceFcfa)}</strong>
          </p>
        </div>

        <div>
          <label
            htmlFor="pay-amount"
            className="block text-sm font-semibold text-[#23093A] mb-1.5"
          >
            Montant payé (en FCFA)
          </label>
          <div className="relative">
            <input
              id="pay-amount"
              type="number"
              inputMode="numeric"
              required
              min={LIMITS.SERVICE_PRICE_MIN}
              max={LIMITS.SERVICE_PRICE_MAX}
              step={100}
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              className="w-full min-h-[52px] pl-4 pr-20 py-3 rounded-2xl border border-[#DFD5EA] bg-[#FAF8FC] text-lg font-bold text-[#23093A] tabular-nums focus:outline-none focus:border-[#4C1D95] focus:bg-white"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-[#A87E15] pointer-events-none">
              FCFA
            </span>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-[#23093A] mb-2.5">
            Mode de paiement utilisé
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {PAYMENT_METHODS.map((method) => {
              const active = selected === method.id;
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setSelected(method.id)}
                  className={`min-h-[52px] px-4 py-3 rounded-2xl border text-left font-semibold text-sm flex items-center gap-3 transition-all ${
                    active
                      ? 'border-[#4C1D95] bg-[#F3ECFA] text-[#23093A]'
                      : 'border-[#EBE4F2] bg-white text-[#4A3D58] hover:bg-[#FAF8FC]'
                  }`}
                >
                  <span
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      active ? 'bg-[#4C1D95] text-[#DFB54B]' : 'bg-[#F3ECFA] text-[#4C1D95]'
                    }`}
                  >
                    <PaymentIcon id={method.id} />
                  </span>
                  <span>{method.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-1/3 min-h-[48px] px-5 py-3 rounded-2xl border border-[#DFD5EA] bg-white text-[#4A3D58] font-semibold text-sm hover:bg-[#FAF8FC]"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-2/3 min-h-[50px] px-6 py-3 rounded-2xl bg-[#4C1D95] text-white font-semibold text-base flex items-center justify-center gap-2 hover:bg-[#3B0764] transition-colors disabled:opacity-60"
          >
            <CheckCircle2 className="w-5 h-5 text-[#DFB54B]" />
            <span>
              {saving
                ? 'Enregistrement…'
                : isAlreadyDone
                  ? 'Enregistrer le paiement'
                  : 'Valider et encaisser'}
            </span>
          </button>
        </div>
      </form>
    </ModalSheet>
  );
}
