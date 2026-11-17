import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getDocsFromServer,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Phone,
  Scissors,
  User,
} from 'lucide-react';
import { LIMITS } from '../constants/validation';
import { db } from '../firebase';
import type { PublicSalon, PublicService, TakenSlot } from '../types';
import {
  computeAvailableSlots,
  getDayKeyFromISO,
  getNextDaysBrazzaville,
  getSlotLockIds,
  hashPhoneForSalon,
  isSlotOverlapping,
  normalizePhoneDigits,
  timeToMinutes,
} from '../utils/booking';
import {
  BRAZZAVILLE_TIMEZONE,
  formatDateDDMMYYYY,
  formatDuration,
  formatFcfa,
  formatFrenchDayWithDate,
  getCurrentTimeBrazzaville,
  getTodayBrazzavilleISO,
} from '../utils/formatters';

interface PublicBookingPageProps {
  slug: string;
}

type BookingStep = 1 | 2 | 3 | 4;

interface ConfirmedBooking {
  serviceName: string;
  durationMinutes: number;
  priceFcfa: number;
  date: string;
  time: string;
  clientName: string;
  clientPhone: string;
}

function getShortWeekday(isoDate: string): string {
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

export function PublicBookingPage({ slug }: PublicBookingPageProps) {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [publicSalon, setPublicSalon] = useState<PublicSalon | null>(null);
  const [services, setServices] = useState<PublicService[]>([]);

  const [step, setStep] = useState<BookingStep>(1);
  const [selectedService, setSelectedService] = useState<PublicService | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [takenSlots, setTakenSlots] = useState<TakenSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string>('');

  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState<ConfirmedBooking | null>(null);

  const todayISO = getTodayBrazzavilleISO();
  const upcomingDates = useMemo(() => getNextDaysBrazzaville(14), []);

  useEffect(() => {
    let active = true;
    const loadSalon = async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const salonSnap = await getDoc(doc(db, 'publicSalons', slug));
        if (!salonSnap.exists()) {
          if (active) {
            setNotFound(true);
            setLoading(false);
          }
          return;
        }

        const salonData = salonSnap.data() as PublicSalon;
        const svcSnap = await getDocs(
          query(
            collection(db, 'publicSalons', slug, 'services'),
            where('salonId', '==', salonData.salonId)
          )
        );
        const svcList: PublicService[] = svcSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<PublicService, 'id'>),
        }));
        svcList.sort((a, b) => a.name.localeCompare(b.name, 'fr'));

        if (active) {
          setPublicSalon(salonData);
          setServices(svcList);
          setLoading(false);
        }
      } catch (err) {
        console.error('Erreur chargement page publique:', err);
        if (active) {
          setNotFound(true);
          setLoading(false);
        }
      }
    };

    loadSalon();
    return () => {
      active = false;
    };
  }, [slug]);

  const fetchSlotsForDate = useCallback(
    async (dateISO: string): Promise<TakenSlot[]> => {
      setSlotsLoading(true);
      try {
        const q = query(
          collection(db, 'publicSalons', slug, 'takenSlots'),
          where('date', '==', dateISO)
        );
        const snap = await getDocsFromServer(q).catch(() => getDocs(q));
        const list: TakenSlot[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<TakenSlot, 'id'>),
        }));
        setTakenSlots(list);
        return list;
      } catch (err) {
        console.error('Erreur vérification créneaux :', err);
        setError('Impossible de vérifier les créneaux pour cette date. Réessayez.');
        setTakenSlots([]);
        return [];
      } finally {
        setSlotsLoading(false);
      }
    },
    [slug]
  );

  const handleSelectDate = async (dateISO: string) => {
    setError('');
    setSelectedDate(dateISO);
    setSelectedTime('');
    setStep(3);
    await fetchSlotsForDate(dateISO);
  };

  const availableSlots = useMemo(() => {
    if (!publicSalon || !selectedService || !selectedDate) return [];
    const dayKey = getDayKeyFromISO(selectedDate);
    const dayHours = publicSalon.openingHours[dayKey];
    const currentMin = timeToMinutes(getCurrentTimeBrazzaville());
    return computeAvailableSlots({
      dayHours,
      durationMinutes: selectedService.durationMinutes,
      takenSlots,
      isToday: selectedDate === todayISO,
      currentMinutes: currentMin,
    });
  }, [publicSalon, selectedService, selectedDate, takenSlots, todayISO]);

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicSalon || !selectedService || !selectedDate || !selectedTime) return;
    setError('');

    const cleanName = clientName.trim().slice(0, LIMITS.CLIENT_NAME_MAX);
    const cleanPhone = clientPhone.trim().slice(0, LIMITS.PHONE_MAX);
    const phoneDigits = normalizePhoneDigits(cleanPhone);

    if (!cleanName) {
      setError('Veuillez indiquer votre nom complet.');
      return;
    }
    if (phoneDigits.length < 6) {
      setError('Veuillez saisir un numéro de téléphone valide (au moins 6 chiffres).');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Re-verify slot availability directly from Firestore server right before submitting
      const freshSlots = await fetchSlotsForDate(selectedDate);
      const startMin = timeToMinutes(selectedTime);
      if (isSlotOverlapping(startMin, selectedService.durationMinutes, freshSlots)) {
        setSelectedTime('');
        setStep(3);
        setError(
          "Ce créneau vient tout juste d'être réservé. Veuillez choisir un autre horaire disponible."
        );
        setSubmitting(false);
        return;
      }

      // 2. Look up blinded phone hash index without ever reading private clients collection
      const phoneHash = await hashPhoneForSalon(publicSalon.salonId, cleanPhone);
      const phoneIndexRef = doc(db, 'publicSalons', slug, 'phoneIndex', phoneHash);
      const phoneIndexSnap = await getDoc(phoneIndexRef);

      const batch = writeBatch(db);
      let clientId: string;

      if (phoneIndexSnap.exists()) {
        clientId = String(phoneIndexSnap.data().clientId);
      } else {
        const newClientRef = doc(collection(db, 'salons', publicSalon.salonId, 'clients'));
        clientId = newClientRef.id;
        batch.set(newClientRef, {
          ownerId: publicSalon.salonId,
          name: cleanName,
          phone: cleanPhone,
          notes: 'Réservation en ligne',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        batch.set(phoneIndexRef, {
          salonId: publicSalon.salonId,
          clientId,
          createdAt: serverTimestamp(),
        });
      }

      // 3. Create confirmed appointment + public takenSlot + atomic slotLocks
      const apptRef = doc(collection(db, 'salons', publicSalon.salonId, 'appointments'));
      batch.set(apptRef, {
        ownerId: publicSalon.salonId,
        clientId,
        clientName: cleanName,
        clientPhone: cleanPhone,
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        durationMinutes: selectedService.durationMinutes,
        priceFcfa: selectedService.priceFcfa,
        date: selectedDate,
        time: selectedTime,
        status: 'confirme',
        paymentMethod: '',
        notes: 'Réservation en ligne',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch.set(doc(db, 'publicSalons', slug, 'takenSlots', apptRef.id), {
        salonId: publicSalon.salonId,
        date: selectedDate,
        startTime: selectedTime,
        durationMinutes: selectedService.durationMinutes,
        appointmentId: apptRef.id,
        createdAt: serverTimestamp(),
      });

      for (const lockId of getSlotLockIds(
        selectedDate,
        selectedTime,
        selectedService.durationMinutes
      )) {
        batch.set(doc(db, 'publicSalons', slug, 'slotLocks', lockId), {
          salonId: publicSalon.salonId,
          date: selectedDate,
          appointmentId: apptRef.id,
          createdAt: serverTimestamp(),
        });
      }

      await batch.commit();

      setConfirmed({
        serviceName: selectedService.name,
        durationMinutes: selectedService.durationMinutes,
        priceFcfa: selectedService.priceFcfa,
        date: selectedDate,
        time: selectedTime,
        clientName: cleanName,
        clientPhone: cleanPhone,
      });
    } catch (err) {
      console.error('Erreur lors de la réservation:', err);
      // If atomic lock collided at exact same millisecond, refresh slots and return to Step 3
      await fetchSlotsForDate(selectedDate);
      setSelectedTime('');
      setStep(3);
      setError(
        "Ce créneau n'est plus disponible ou une erreur s'est produite. Veuillez choisir un autre horaire."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resetBooking = () => {
    setConfirmed(null);
    setSelectedService(null);
    setSelectedDate('');
    setSelectedTime('');
    setClientName('');
    setClientPhone('');
    setError('');
    setStep(1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF8FC] flex flex-col items-center justify-center p-6">
        <span className="w-12 h-12 rounded-2xl bg-[#4C1D95] text-[#DFB54B] flex items-center justify-center mb-4">
          <Scissors className="w-6 h-6" />
        </span>
        <p className="font-display text-xl font-semibold text-[#23093A]">Salonéo</p>
        <p className="text-sm text-[#6E5F7F] mt-1">Chargement de la page du salon…</p>
      </div>
    );
  }

  if (notFound || !publicSalon) {
    return (
      <div className="min-h-screen bg-[#FAF8FC] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-3xl border border-[#EBE4F2] p-8 text-center shadow-sm">
          <span className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-[#F3ECFA] text-[#4C1D95] flex items-center justify-center">
            <Scissors className="w-7 h-7" />
          </span>
          <h1 className="font-display text-2xl font-semibold text-[#23093A] mb-2">
            Salon introuvable
          </h1>
          <p className="text-sm text-[#5E526B] leading-relaxed">
            Ce lien de réservation ne correspond à aucun salon actif. Demandez le lien exact à votre
            coiffeur ou esthéticienne.
          </p>
        </div>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="min-h-screen bg-[#FAF8FC] py-8 px-4 sm:px-6 flex items-center justify-center">
        <div className="w-full max-w-lg bg-white rounded-3xl border border-[#EBE4F2] p-6 sm:p-8 shadow-sm">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-[#EEF8F1] text-[#166534] flex items-center justify-center">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div className="text-center mb-6">
            <p className="text-xs font-semibold text-[#166534] mb-1">Statut : Confirmé</p>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#23093A]">
              Rendez-vous confirmé !
            </h1>
            <p className="text-sm text-[#5E526B] mt-2">
              Votre place est réservée chez{' '}
              <strong className="text-[#23093A]">{publicSalon.name}</strong>.
            </p>
          </div>

          <div className="rounded-2xl bg-[#FAF8FC] border border-[#EBE4F2] divide-y divide-[#EBE4F2] mb-6">
            <div className="p-4 flex items-center justify-between gap-4">
              <span className="text-sm text-[#5E526B]">Prestation</span>
              <span className="text-sm font-semibold text-[#23093A] text-right">
                {confirmed.serviceName} ({formatDuration(confirmed.durationMinutes)})
              </span>
            </div>
            <div className="p-4 flex items-center justify-between gap-4">
              <span className="text-sm text-[#5E526B]">Tarif</span>
              <span className="text-sm font-bold text-[#A87E15] tabular-nums">
                {formatFcfa(confirmed.priceFcfa)}
              </span>
            </div>
            <div className="p-4 flex items-center justify-between gap-4">
              <span className="text-sm text-[#5E526B]">Date et heure</span>
              <span className="text-sm font-semibold text-[#23093A] tabular-nums text-right">
                {formatFrenchDayWithDate(confirmed.date)} à {confirmed.time}
              </span>
            </div>
            <div className="p-4 flex items-center justify-between gap-4">
              <span className="text-sm text-[#5E526B]">Client</span>
              <span className="text-sm font-semibold text-[#23093A] text-right tabular-nums">
                {confirmed.clientName} · {confirmed.clientPhone}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={resetBooking}
            className="w-full min-h-[50px] px-6 py-3 rounded-2xl bg-[#4C1D95] text-white font-semibold text-base hover:bg-[#3B0764] transition-colors"
          >
            Prendre un autre rendez-vous
          </button>
        </div>
      </div>
    );
  }

  const selectedDayOpen =
    selectedDate && publicSalon.openingHours[getDayKeyFromISO(selectedDate)]?.open;

  return (
    <div className="min-h-screen bg-[#FAF8FC] pb-12">
      {/* Salon Banner */}
      <header className="bg-[#23093A] text-white py-6 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-[#C89B2B] text-[#23093A] flex items-center justify-center">
                <Scissors className="w-4 h-4" />
              </span>
              <span className="text-xs font-semibold text-[#FBF4DE]">Réservation en ligne</span>
            </div>
            <span className="text-xs text-[#D8CBE6]">Salonéo</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-white">
            {publicSalon.name}
          </h1>
          <p className="text-sm text-[#D8CBE6] mt-1 tabular-nums">
            Étape {step} sur 4 · Fuseau Africa/Brazzaville
          </p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 space-y-5">
        {/* Step Navigation / Back */}
        {step > 1 && (
          <button
            type="button"
            onClick={() => {
              setError('');
              setStep((prev) => (prev > 1 ? ((prev - 1) as BookingStep) : 1));
            }}
            className="min-h-[44px] px-3 py-2 -ml-2 rounded-xl text-sm font-semibold text-[#4C1D95] hover:bg-[#F3ECFA] inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Étape précédente</span>
          </button>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-2xl border border-[#F2C6C6] bg-[#FDF2F2] px-4 py-3 text-sm text-[#991B1B]"
          >
            {error}
          </div>
        )}

        {/* STEP 1: Service selection */}
        {step === 1 && (
          <section className="space-y-4">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-semibold text-[#23093A]">
                1. Choisissez une prestation
              </h2>
              <p className="text-sm text-[#5E526B] mt-1">
                Touchez la prestation souhaitée pour voir les disponibilités.
              </p>
            </div>

            {services.length === 0 ? (
              <div className="bg-white rounded-3xl border border-[#EBE4F2] p-8 text-center">
                <p className="text-base font-semibold text-[#23093A] mb-1">
                  Aucune prestation disponible en ligne
                </p>
                <p className="text-sm text-[#5E526B]">
                  Ce salon n'a pas encore publié ses prestations.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-[#EBE4F2] divide-y divide-[#F1ECF6] overflow-hidden">
                {services.map((svc) => (
                  <button
                    key={svc.id}
                    type="button"
                    onClick={() => {
                      setSelectedService(svc);
                      setError('');
                      setStep(2);
                    }}
                    className="w-full p-5 text-left flex items-center justify-between gap-4 hover:bg-[#FAF8FC] active:bg-[#F3ECFA]/60 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-[#23093A]">{svc.name}</p>
                      <p className="text-sm text-[#5E526B] mt-1 tabular-nums">
                        {formatDuration(svc.durationMinutes)} ·{' '}
                        <span className="font-semibold text-[#A87E15]">
                          {formatFcfa(svc.priceFcfa)}
                        </span>
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-[#7E6F8E] shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* STEP 2: Date selection */}
        {step === 2 && selectedService && (
          <section className="space-y-5">
            <div className="bg-white rounded-2xl border border-[#EBE4F2] px-4 py-3.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-[#6E5F7F]">Prestation choisie</p>
                <p className="text-sm font-semibold text-[#23093A] truncate tabular-nums">
                  {selectedService.name} · {formatDuration(selectedService.durationMinutes)} ·{' '}
                  {formatFcfa(selectedService.priceFcfa)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs font-semibold text-[#4C1D95] hover:underline min-h-[36px] px-2 shrink-0"
              >
                Changer
              </button>
            </div>

            <div>
              <h2 className="font-display text-xl sm:text-2xl font-semibold text-[#23093A]">
                2. Choisissez une date
              </h2>
              <p className="text-sm text-[#5E526B] mt-1">
                Sélectionnez un jour d'ouverture du salon.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {upcomingDates.map((dateISO) => {
                const dayKey = getDayKeyFromISO(dateISO);
                const dayHours = publicSalon.openingHours[dayKey];
                const isOpen = dayHours?.open ?? false;
                const isToday = dateISO === todayISO;

                return (
                  <button
                    key={dateISO}
                    type="button"
                    disabled={!isOpen}
                    onClick={() => handleSelectDate(dateISO)}
                    className={`min-h-[76px] p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                      isOpen
                        ? 'bg-white border-[#EBE4F2] hover:border-[#4C1D95] hover:bg-[#FAF8FC] active:scale-[0.99]'
                        : 'bg-[#F5F1F8] border-[#EBE4F2] opacity-55 cursor-not-allowed'
                    }`}
                  >
                    <span className="text-xs font-semibold text-[#4C1D95]">
                      {isToday ? "Aujourd'hui" : getShortWeekday(dateISO)}
                    </span>
                    <span className="text-sm font-bold text-[#23093A] tabular-nums mt-1">
                      {formatDateDDMMYYYY(dateISO)}
                    </span>
                    <span className="text-xs text-[#6E5F7F] mt-0.5 tabular-nums">
                      {isOpen ? `${dayHours.start} – ${dayHours.end}` : 'Fermé'}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="bg-white rounded-2xl border border-[#EBE4F2] p-4">
              <label
                htmlFor="pub-other-date"
                className="block text-sm font-semibold text-[#23093A] mb-2"
              >
                Ou choisir une autre date
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-[#7E6F8E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="pub-other-date"
                  type="date"
                  min={todayISO}
                  value={selectedDate}
                  onChange={(e) => {
                    if (e.target.value >= todayISO) {
                      handleSelectDate(e.target.value);
                    }
                  }}
                  className="w-full min-h-[48px] pl-10 pr-4 py-2.5 rounded-xl border border-[#DFD5EA] bg-[#FAF8FC] text-base text-[#1F1629] tabular-nums focus:outline-none focus:border-[#4C1D95] focus:bg-white"
                />
              </div>
            </div>
          </section>
        )}

        {/* STEP 3: Time slot selection */}
        {step === 3 && selectedService && selectedDate && (
          <section className="space-y-5">
            <div className="bg-white rounded-2xl border border-[#EBE4F2] px-4 py-3.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-[#6E5F7F] tabular-nums">
                  {selectedService.name} · {formatDuration(selectedService.durationMinutes)}
                </p>
                <p className="text-sm font-semibold text-[#23093A] tabular-nums">
                  {formatFrenchDayWithDate(selectedDate)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-xs font-semibold text-[#4C1D95] hover:underline min-h-[36px] px-2 shrink-0"
              >
                Autre date
              </button>
            </div>

            <div>
              <h2 className="font-display text-xl sm:text-2xl font-semibold text-[#23093A]">
                3. Choisissez un créneau disponible
              </h2>
              <p className="text-sm text-[#5E526B] mt-1">
                Seuls les créneaux libres adaptés à la durée de votre prestation sont affichés.
              </p>
            </div>

            {slotsLoading ? (
              <div className="bg-white rounded-3xl border border-[#EBE4F2] p-8 text-center text-sm text-[#6E5F7F]">
                Vérification des créneaux disponibles…
              </div>
            ) : !selectedDayOpen ? (
              <div className="bg-white rounded-3xl border border-[#EBE4F2] p-8 text-center">
                <p className="text-base font-semibold text-[#23093A] mb-2">
                  Le salon est fermé ce jour-là
                </p>
                <p className="text-sm text-[#5E526B] mb-5">
                  Veuillez sélectionner un autre jour d'ouverture.
                </p>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="min-h-[48px] px-6 py-3 rounded-2xl bg-[#4C1D95] text-white text-sm font-semibold"
                >
                  Choisir une autre date
                </button>
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="bg-white rounded-3xl border border-[#EBE4F2] p-8 text-center">
                <Clock className="w-8 h-8 mx-auto mb-3 text-[#4C1D95]" />
                <p className="text-base font-semibold text-[#23093A] mb-2">
                  Aucun créneau libre ce jour-là
                </p>
                <p className="text-sm text-[#5E526B] mb-5">
                  Tous les horaires compatibles avec la durée ({formatDuration(selectedService.durationMinutes)}) sont pris pour le {formatDateDDMMYYYY(selectedDate)}.
                </p>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="min-h-[48px] px-6 py-3 rounded-2xl bg-[#4C1D95] text-white text-sm font-semibold"
                >
                  Choisir une autre date
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {availableSlots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => {
                      setSelectedTime(slot);
                      setError('');
                      setStep(4);
                    }}
                    className="min-h-[52px] px-3 py-3 rounded-2xl border border-[#EBE4F2] bg-white text-base font-bold text-[#23093A] tabular-nums hover:border-[#4C1D95] hover:bg-[#F3ECFA] active:scale-[0.98] transition-all"
                  >
                    {slot}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* STEP 4: Client details */}
        {step === 4 && selectedService && selectedDate && selectedTime && (
          <section className="space-y-5">
            <div className="bg-white rounded-2xl border border-[#EBE4F2] p-4 space-y-1">
              <p className="text-xs font-semibold text-[#A87E15]">Récapitulatif</p>
              <p className="text-base font-semibold text-[#23093A]">
                {selectedService.name} · {formatFcfa(selectedService.priceFcfa)}
              </p>
              <p className="text-sm text-[#5E526B] tabular-nums">
                {formatFrenchDayWithDate(selectedDate)} à {selectedTime} (
                {formatDuration(selectedService.durationMinutes)})
              </p>
            </div>

            <form
              onSubmit={handleSubmitBooking}
              className="bg-white rounded-3xl border border-[#EBE4F2] p-5 sm:p-6 space-y-5"
            >
              <div>
                <h2 className="font-display text-xl sm:text-2xl font-semibold text-[#23093A]">
                  4. Vos coordonnées
                </h2>
                <p className="text-sm text-[#5E526B] mt-1">
                  Indiquez votre nom et votre téléphone pour confirmer le rendez-vous.
                </p>
              </div>

              <div>
                <label
                  htmlFor="pub-name"
                  className="block text-sm font-semibold text-[#23093A] mb-1.5"
                >
                  Votre nom complet
                </label>
                <div className="relative">
                  <User className="w-5 h-5 text-[#7E6F8E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="pub-name"
                    type="text"
                    required
                    maxLength={LIMITS.CLIENT_NAME_MAX}
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Ex : Grâce Moukala"
                    className="w-full min-h-[50px] pl-11 pr-4 py-3 rounded-2xl border border-[#DFD5EA] bg-[#FAF8FC] text-base text-[#1F1629] placeholder:text-[#9689A6] focus:outline-none focus:border-[#4C1D95] focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="pub-phone"
                  className="block text-sm font-semibold text-[#23093A] mb-1.5"
                >
                  Votre numéro de téléphone
                </label>
                <div className="relative">
                  <Phone className="w-5 h-5 text-[#7E6F8E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="pub-phone"
                    type="tel"
                    required
                    maxLength={LIMITS.PHONE_MAX}
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="Ex : +242 06 612 34 56"
                    className="w-full min-h-[50px] pl-11 pr-4 py-3 rounded-2xl border border-[#DFD5EA] bg-[#FAF8FC] text-base text-[#1F1629] placeholder:text-[#9689A6] focus:outline-none focus:border-[#4C1D95] focus:bg-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[54px] px-6 py-4 rounded-2xl bg-[#4C1D95] text-white font-semibold text-base flex items-center justify-center gap-2 hover:bg-[#3B0764] active:scale-[0.99] transition-all disabled:opacity-60"
              >
                <CheckCircle2 className="w-5 h-5 text-[#DFB54B]" />
                <span>{submitting ? 'Confirmation en cours…' : 'Confirmer le rendez-vous'}</span>
              </button>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}
