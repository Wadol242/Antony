import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Calendar, Clock, UserPlus } from 'lucide-react';
import { LIMITS } from '../constants/validation';
import type { AppointmentItem, ClientItem, OpeningHoursMap, ServiceItem } from '../types';
import {
  computeAvailableSlots,
  findOverlappingAppointment,
  getDayKeyFromISO,
  minutesToTime,
  timeToMinutes,
} from '../utils/booking';
import { formatFirestoreErrorMessage } from '../utils/errors';
import {
  formatDateDDMMYYYY,
  formatDuration,
  formatFcfa,
  getTodayBrazzavilleISO,
} from '../utils/formatters';
import { ModalSheet } from './ModalSheet';

interface AppointmentModalProps {
  open: boolean;
  onClose: () => void;
  clients: ClientItem[];
  services: ServiceItem[];
  appointments: AppointmentItem[];
  openingHours: OpeningHoursMap;
  editingAppointment: AppointmentItem | null;
  preselectedClientId?: string;
  initialDate?: string;
  onCreateClient: (input: { name: string; phone: string; notes: string }) => Promise<ClientItem | null>;
  onSave: (data: {
    client: ClientItem;
    service: ServiceItem;
    date: string;
    time: string;
    notes: string;
  }) => Promise<void>;
}

export function AppointmentModal({
  open,
  onClose,
  clients,
  services,
  appointments,
  openingHours,
  editingAppointment,
  preselectedClientId,
  initialDate,
  onCreateClient,
  onSave,
}: AppointmentModalProps) {
  const [clientId, setClientId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState(getTodayBrazzavilleISO());
  const [time, setTime] = useState('09:30');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Quick inline client creation
  const [addingNewClient, setAddingNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setAddingNewClient(false);
    setNewClientName('');
    setNewClientPhone('');

    if (editingAppointment) {
      setClientId(editingAppointment.clientId);
      setServiceId(editingAppointment.serviceId);
      setDate(editingAppointment.date);
      setTime(editingAppointment.time);
      setNotes(editingAppointment.notes || '');
    } else {
      setClientId(preselectedClientId || clients[0]?.id || '');
      const defaultSvc = services[0];
      setServiceId(defaultSvc?.id || '');
      const defaultDate = initialDate || getTodayBrazzavilleISO();
      setDate(defaultDate);

      let defaultTime = '10:00';
      if (defaultSvc && LIMITS.DATE_PATTERN.test(defaultDate)) {
        const conflictAt10 = findOverlappingAppointment({
          date: defaultDate,
          time: '10:00',
          durationMinutes: defaultSvc.durationMinutes,
          appointments,
        });
        if (conflictAt10) {
          const dayKey = getDayKeyFromISO(defaultDate);
          const dayHours = openingHours[dayKey];
          const takenOnDate = appointments
            .filter(
              (a) =>
                a.date === defaultDate && (a.status === 'planifie' || a.status === 'confirme')
            )
            .map((a) => ({ startTime: a.time, durationMinutes: a.durationMinutes }));
          const free = computeAvailableSlots({
            dayHours,
            durationMinutes: defaultSvc.durationMinutes,
            takenSlots: takenOnDate,
            isToday: false,
            currentMinutes: 0,
          });
          if (free.length > 0) {
            defaultTime = free[0];
          }
        }
      }
      setTime(defaultTime);
      setNotes('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingAppointment, preselectedClientId, initialDate]);

  useEffect(() => {
    if (!open || editingAppointment) return;
    if (!clientId && clients.length > 0) {
      setClientId(preselectedClientId || clients[0].id);
    }
  }, [open, editingAppointment, clientId, clients, preselectedClientId]);

  useEffect(() => {
    if (!open || editingAppointment) return;
    if (!serviceId && services.length > 0) {
      setServiceId(services[0].id);
    }
  }, [open, editingAppointment, serviceId, services]);

  const selectedService = useMemo(() => {
    const found = services.find((s) => s.id === serviceId);
    if (found) return found;
    if (editingAppointment && serviceId === editingAppointment.serviceId) {
      return {
        id: editingAppointment.serviceId,
        ownerId: editingAppointment.ownerId,
        name: editingAppointment.serviceName,
        durationMinutes: editingAppointment.durationMinutes,
        priceFcfa: editingAppointment.priceFcfa,
      };
    }
    return undefined;
  }, [services, serviceId, editingAppointment]);

  // Anti-chevauchement check against existing active appointments
  const overlappingAppt = useMemo(() => {
    if (!selectedService || !LIMITS.DATE_PATTERN.test(date) || !LIMITS.TIME_PATTERN.test(time)) {
      return null;
    }
    return findOverlappingAppointment({
      date,
      time,
      durationMinutes: selectedService.durationMinutes,
      appointments,
      excludeId: editingAppointment?.id,
    });
  }, [selectedService, date, time, appointments, editingAppointment?.id]);

  // Free slot suggestions for the chosen date & service duration
  const suggestedFreeSlots = useMemo(() => {
    if (!selectedService || !LIMITS.DATE_PATTERN.test(date)) return [];
    const dayKey = getDayKeyFromISO(date);
    const dayHours = openingHours[dayKey];
    const takenOnDate = appointments
      .filter(
        (a) =>
          a.id !== editingAppointment?.id &&
          a.date === date &&
          (a.status === 'planifie' || a.status === 'confirme')
      )
      .map((a) => ({
        startTime: a.time,
        durationMinutes: a.durationMinutes,
      }));

    return computeAvailableSlots({
      dayHours,
      durationMinutes: selectedService.durationMinutes,
      takenSlots: takenOnDate,
      isToday: false,
      currentMinutes: 0,
    });
  }, [selectedService, date, openingHours, appointments, editingAppointment?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const chosenService = selectedService;
    if (!chosenService) {
      setError('Veuillez sélectionner une prestation.');
      return;
    }

    if (!LIMITS.DATE_PATTERN.test(date)) {
      setError('Veuillez choisir une date valide.');
      return;
    }

    if (!LIMITS.TIME_PATTERN.test(time)) {
      setError('Veuillez choisir une heure valide.');
      return;
    }

    // Strict anti-overlap block
    const conflict = findOverlappingAppointment({
      date,
      time,
      durationMinutes: chosenService.durationMinutes,
      appointments,
      excludeId: editingAppointment?.id,
    });
    if (conflict) {
      const conflictEnd = minutesToTime(timeToMinutes(conflict.time) + conflict.durationMinutes);
      setError(
        `Créneau occupé : ${conflict.clientName} a déjà rendez-vous de ${conflict.time} à ${conflictEnd}. Choisissez un créneau libre.`
      );
      return;
    }

    setSaving(true);
    try {
      let chosenClient = clients.find((c) => c.id === clientId);
      if (!chosenClient && editingAppointment && clientId === editingAppointment.clientId) {
        chosenClient = {
          id: editingAppointment.clientId,
          ownerId: editingAppointment.ownerId,
          name: editingAppointment.clientName,
          phone: editingAppointment.clientPhone,
          notes: '',
        };
      }

      if (addingNewClient || (clients.length === 0 && !chosenClient)) {
        if (!newClientName.trim()) {
          setError('Veuillez saisir le nom du nouveau client.');
          return;
        }
        const created = await onCreateClient({
          name: newClientName.trim(),
          phone: newClientPhone.trim(),
          notes: '',
        });
        if (!created) {
          setError('Impossible de créer ce client.');
          return;
        }
        chosenClient = created;
      }

      if (!chosenClient) {
        setError('Veuillez sélectionner un client ou en créer un nouveau.');
        return;
      }

      await onSave({
        client: chosenClient,
        service: chosenService,
        date,
        time,
        notes: notes.trim(),
      });
      onClose();
    } catch (err) {
      setError(formatFirestoreErrorMessage(err, "Impossible d'enregistrer le rendez-vous"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title={editingAppointment ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous'}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div
            role="alert"
            className="rounded-2xl border border-[#F2C6C6] bg-[#FDF2F2] px-4 py-3 text-sm text-[#991B1B]"
          >
            {error}
          </div>
        )}

        {/* Client selector or inline create */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="rdv-client" className="text-sm font-semibold text-[#23093A]">
              Client
            </label>
            <button
              type="button"
              onClick={() => setAddingNewClient((prev) => !prev)}
              className="text-xs font-semibold text-[#4C1D95] hover:underline flex items-center gap-1 min-h-[36px] px-2"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{addingNewClient ? 'Choisir un client existant' : 'Nouveau client'}</span>
            </button>
          </div>

          {addingNewClient || (clients.length === 0 && !editingAppointment) ? (
            <div className="space-y-3 p-4 rounded-2xl bg-[#FAF8FC] border border-[#E6DDF0]">
              <p className="text-xs font-medium text-[#5E526B]">
                {clients.length === 0
                  ? 'Aucun client enregistré pour le moment. Créez votre premier client :'
                  : 'Créer et sélectionner ce nouveau client :'}
              </p>
              <input
                type="text"
                required
                maxLength={LIMITS.CLIENT_NAME_MAX}
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                onFocus={() => {
                  if (!addingNewClient) setAddingNewClient(true);
                }}
                placeholder="Nom complet (ex : Merveille Ngoma)"
                className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-[#DFD5EA] bg-white text-base text-[#1F1629] placeholder:text-[#9689A6] focus:outline-none focus:border-[#4C1D95]"
              />
              <input
                type="tel"
                maxLength={LIMITS.PHONE_MAX}
                value={newClientPhone}
                onChange={(e) => setNewClientPhone(e.target.value)}
                onFocus={() => {
                  if (!addingNewClient) setAddingNewClient(true);
                }}
                placeholder="Téléphone (ex : +242 06 500 11 22)"
                className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-[#DFD5EA] bg-white text-base text-[#1F1629] placeholder:text-[#9689A6] focus:outline-none focus:border-[#4C1D95]"
              />
            </div>
          ) : (
            <select
              id="rdv-client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full min-h-[48px] px-4 py-3 rounded-2xl border border-[#DFD5EA] bg-[#FAF8FC] text-base text-[#1F1629] focus:outline-none focus:border-[#4C1D95] focus:bg-white"
            >
              {editingAppointment &&
                !clients.some((c) => c.id === editingAppointment.clientId) && (
                  <option value={editingAppointment.clientId}>
                    {editingAppointment.clientName}
                    {editingAppointment.clientPhone ? ` (${editingAppointment.clientPhone})` : ''}
                  </option>
                )}
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.phone ? ` (${c.phone})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Service selector */}
        <div>
          <label htmlFor="rdv-service" className="block text-sm font-semibold text-[#23093A] mb-1.5">
            Prestation
          </label>
          {services.length === 0 && !editingAppointment ? (
            <p className="text-sm text-[#991B1B] bg-[#FDF2F2] rounded-2xl p-3 border border-[#F2C6C6]">
              Ajoutez d'abord au moins une prestation dans l'onglet Prestations.
            </p>
          ) : (
            <>
              <select
                id="rdv-service"
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className="w-full min-h-[48px] px-4 py-3 rounded-2xl border border-[#DFD5EA] bg-[#FAF8FC] text-base text-[#1F1629] focus:outline-none focus:border-[#4C1D95] focus:bg-white"
              >
                {editingAppointment &&
                  !services.some((s) => s.id === editingAppointment.serviceId) && (
                    <option value={editingAppointment.serviceId}>
                      {editingAppointment.serviceName} — {formatFcfa(editingAppointment.priceFcfa)}{' '}
                      ({formatDuration(editingAppointment.durationMinutes)})
                    </option>
                  )}
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {formatFcfa(s.priceFcfa)} ({formatDuration(s.durationMinutes)})
                  </option>
                ))}
              </select>
              {selectedService && (
                <p className="mt-1.5 text-xs text-[#5E526B] tabular-nums">
                  Durée prévue : {formatDuration(selectedService.durationMinutes)} · Tarif :{' '}
                  <span className="font-semibold text-[#23093A]">
                    {formatFcfa(selectedService.priceFcfa)}
                  </span>
                </p>
              )}
            </>
          )}
        </div>

        {/* Date and time */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="rdv-date" className="block text-sm font-semibold text-[#23093A] mb-1.5">
              Date ({formatDateDDMMYYYY(date)})
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-[#7E6F8E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="rdv-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full min-h-[48px] pl-10 pr-3 py-2.5 rounded-2xl border border-[#DFD5EA] bg-[#FAF8FC] text-base text-[#1F1629] tabular-nums focus:outline-none focus:border-[#4C1D95] focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label htmlFor="rdv-time" className="block text-sm font-semibold text-[#23093A] mb-1.5">
              Heure (Brazzaville)
            </label>
            <div className="relative">
              <Clock className="w-4 h-4 text-[#7E6F8E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="rdv-time"
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={`w-full min-h-[48px] pl-10 pr-3 py-2.5 rounded-2xl border text-base text-[#1F1629] tabular-nums focus:outline-none ${
                  overlappingAppt
                    ? 'border-[#DC2626] bg-[#FDF2F2]'
                    : 'border-[#DFD5EA] bg-[#FAF8FC] focus:border-[#4C1D95] focus:bg-white'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Live Overlap Alert */}
        {overlappingAppt && (
          <div
            role="alert"
            className="rounded-2xl border border-[#F2C6C6] bg-[#FDF2F2] px-4 py-3 text-sm text-[#991B1B] flex items-start gap-2.5"
          >
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Chevauchement détecté</p>
              <p className="text-xs mt-0.5 tabular-nums">
                {overlappingAppt.clientName} ({overlappingAppt.serviceName}) occupe déjà le créneau
                de {overlappingAppt.time} à{' '}
                {minutesToTime(
                  timeToMinutes(overlappingAppt.time) + overlappingAppt.durationMinutes
                )}
                .
              </p>
            </div>
          </div>
        )}

        {/* Quick 1-tap free slot suggestions */}
        {selectedService && LIMITS.DATE_PATTERN.test(date) && (
          <div>
            <p className="text-xs font-semibold text-[#5E526B] mb-2">
              Créneaux libres le {formatDateDDMMYYYY(date)} :
            </p>
            {suggestedFreeSlots.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                {suggestedFreeSlots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => {
                      setTime(slot);
                      setError('');
                    }}
                    className={`min-h-[38px] px-3 py-1 rounded-xl text-xs font-semibold tabular-nums transition-colors ${
                      time === slot
                        ? 'bg-[#4C1D95] text-white'
                        : 'bg-[#F3ECFA] text-[#4C1D95] hover:bg-[#E7DBF5]'
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#6E5F7F] bg-[#FAF8FC] border border-[#EBE4F2] rounded-xl px-3 py-2.5">
                {openingHours[getDayKeyFromISO(date)]?.open
                  ? 'Aucun créneau libre disponible selon vos horaires pour cette durée ce jour-là.'
                  : "Le salon est fermé ce jour-là selon vos horaires d'ouverture."}
              </p>
            )}
          </div>
        )}

        {/* Notes */}
        <div>
          <label htmlFor="rdv-notes" className="block text-sm font-semibold text-[#23093A] mb-1.5">
            Remarque (optionnel)
          </label>
          <textarea
            id="rdv-notes"
            rows={2}
            maxLength={LIMITS.NOTES_MAX}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex : Prévoir mèches longueur moyenne…"
            className="w-full px-4 py-3 rounded-2xl border border-[#DFD5EA] bg-[#FAF8FC] text-base text-[#1F1629] placeholder:text-[#9689A6] focus:outline-none focus:border-[#4C1D95] focus:bg-white"
          />
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-1/3 min-h-[48px] px-5 py-3 rounded-2xl border border-[#DFD5EA] bg-white text-[#4A3D58] font-semibold text-sm hover:bg-[#FAF8FC] transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving || (services.length === 0 && !editingAppointment)}
            className="w-full sm:w-2/3 min-h-[50px] px-6 py-3 rounded-2xl bg-[#4C1D95] text-white font-semibold text-base hover:bg-[#3B0764] active:scale-[0.99] transition-all disabled:opacity-50"
          >
            {saving
              ? 'Enregistrement…'
              : editingAppointment
                ? 'Mettre à jour'
                : 'Enregistrer le rendez-vous'}
          </button>
        </div>
      </form>
    </ModalSheet>
  );
}
