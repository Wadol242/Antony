import { useEffect, useState } from 'react';
import { Check, Copy, MessageCircle } from 'lucide-react';
import type { AppointmentItem } from '../types';
import { buildWhatsAppLink, buildWhatsAppReminderText } from '../utils/booking';
import { ModalSheet } from './ModalSheet';

interface WhatsAppReminderModalProps {
  appointment: AppointmentItem | null;
  salonName: string;
  onClose: () => void;
}

export function WhatsAppReminderModal({
  appointment,
  salonName,
  onClose,
}: WhatsAppReminderModalProps) {
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (appointment) {
      setMessage(
        buildWhatsAppReminderText({
          clientName: appointment.clientName,
          salonName,
          date: appointment.date,
          time: appointment.time,
          serviceName: appointment.serviceName,
          priceFcfa: appointment.priceFcfa,
        })
      );
      setCopied(false);
    }
  }, [appointment, salonName]);

  if (!appointment) return null;

  const waUrl = buildWhatsAppLink(appointment.clientPhone, message);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = message;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <ModalSheet open={Boolean(appointment)} onClose={onClose} title="Rappel WhatsApp">
      <div className="space-y-4">
        <div className="rounded-2xl bg-[#FAF8FC] border border-[#EBE4F2] px-4 py-3">
          <p className="text-sm font-semibold text-[#23093A]">{appointment.clientName}</p>
          <p className="text-xs text-[#5E526B] tabular-nums mt-0.5">
            {appointment.clientPhone || 'Aucun numéro de téléphone enregistré pour ce client'}
          </p>
        </div>

        <div>
          <label htmlFor="wa-msg" className="block text-sm font-semibold text-[#23093A] mb-1.5">
            Message de rappel
          </label>
          <textarea
            id="wa-msg"
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border border-[#DFD5EA] bg-[#FAF8FC] text-sm text-[#1F1629] leading-relaxed focus:outline-none focus:border-[#4C1D95] focus:bg-white"
          />
        </div>

        {!waUrl && (
          <p className="text-xs text-[#991B1B] bg-[#FDF2F2] border border-[#F2C6C6] rounded-xl px-3.5 py-2.5">
            Numéro de téléphone absent ou trop court : vous pouvez copier le message ci-dessous pour
            l'envoyer manuellement.
          </p>
        )}

        <div className="pt-1 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className="w-full sm:w-1/2 min-h-[48px] px-4 py-3 rounded-2xl border border-[#DFD5EA] bg-white text-[#23093A] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#FAF8FC] transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-[#166534]" />
                <span>Message copié !</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-[#4C1D95]" />
                <span>Copier le message</span>
              </>
            )}
          </button>

          {waUrl ? (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-1/2 min-h-[48px] px-4 py-3 rounded-2xl bg-[#166534] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#14532D] transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Envoyer sur WhatsApp</span>
            </a>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-1/2 min-h-[48px] px-4 py-3 rounded-2xl bg-[#4C1D95] text-white font-semibold text-sm"
            >
              Fermer
            </button>
          )}
        </div>
      </div>
    </ModalSheet>
  );
}
