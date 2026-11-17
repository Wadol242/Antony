import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type WriteBatch,
} from 'firebase/firestore';
import {
  clampInt,
  clampText,
  LIMITS,
  STARTER_SERVICES,
} from '../constants/validation';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  AppointmentItem,
  AppointmentStatus,
  ClientItem,
  OpeningHoursMap,
  PaymentMethod,
  Salon,
  ServiceItem,
} from '../types';
import {
  getSlotLockIds,
  hashPhoneForSalon,
  normalizePhoneDigits,
  slugifySalonName,
} from '../utils/booking';

async function resolveUniqueSlug(salonName: string, uid: string): Promise<string> {
  const base = slugifySalonName(salonName);
  const candidates = [
    base,
    `${base}-${uid.slice(0, 4).toLowerCase()}`,
    `${base}-${uid.slice(0, 8).toLowerCase()}`,
  ];

  for (const candidate of candidates) {
    const snap = await getDoc(doc(db, 'publicSalons', candidate));
    if (!snap.exists() || snap.data()?.salonId === uid) {
      return candidate;
    }
  }
  return `${base}-${Date.now().toString(36)}`;
}

async function commitBatchedOps(
  ops: Array<(batch: WriteBatch) => void>,
  chunkSize = 5
): Promise<void> {
  for (let i = 0; i < ops.length; i += chunkSize) {
    const batch = writeBatch(db);
    const slice = ops.slice(i, i + chunkSize);
    for (const applyOp of slice) {
      applyOp(batch);
    }
    await batch.commit();
  }
}

export function useSalonData(user: User | null, authReady: boolean) {
  const [salon, setSalon] = useState<Salon | null>(null);
  const [salonLoading, setSalonLoading] = useState<boolean>(true);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState<boolean>(true);

  const syncedUidRef = useRef<string | null>(null);
  const syncInFlightRef = useRef<boolean>(false);
  const verifiedPublicRef = useRef<{ uid: string; slug: string } | null>(null);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setSalon(null);
      setServices([]);
      setClients([]);
      setAppointments([]);
      setSalonLoading(false);
      setCollectionsLoading(false);
      syncedUidRef.current = null;
      syncInFlightRef.current = false;
      verifiedPublicRef.current = null;
      return;
    }

    const uid = user.uid;
    setSalonLoading(true);
    setCollectionsLoading(true);

    let servicesReady = false;
    let clientsReady = false;
    let appointmentsReady = false;
    const markCollectionReady = () => {
      if (servicesReady && clientsReady && appointmentsReady) {
        setCollectionsLoading(false);
      }
    };

    const salonPath = `salons/${uid}`;
    const unsubSalon = onSnapshot(
      doc(db, 'salons', uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Omit<Salon, 'id'>;
          setSalon({ id: snap.id, ...data });
        } else {
          setSalon(null);
        }
        setSalonLoading(false);
      },
      (error) => {
        setSalonLoading(false);
        handleFirestoreError(error, OperationType.GET, salonPath);
      }
    );

    const servicesPath = `salons/${uid}/services`;
    const unsubServices = onSnapshot(
      query(collection(db, 'salons', uid, 'services'), where('ownerId', '==', uid)),
      (snap) => {
        const list: ServiceItem[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ServiceItem, 'id'>),
        }));
        list.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
        setServices(list);
        servicesReady = true;
        markCollectionReady();
      },
      (error) => {
        servicesReady = true;
        markCollectionReady();
        handleFirestoreError(error, OperationType.LIST, servicesPath);
      }
    );

    const clientsPath = `salons/${uid}/clients`;
    const unsubClients = onSnapshot(
      query(collection(db, 'salons', uid, 'clients'), where('ownerId', '==', uid)),
      (snap) => {
        const list: ClientItem[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ClientItem, 'id'>),
        }));
        list.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
        setClients(list);
        clientsReady = true;
        markCollectionReady();
      },
      (error) => {
        clientsReady = true;
        markCollectionReady();
        handleFirestoreError(error, OperationType.LIST, clientsPath);
      }
    );

    const appointmentsPath = `salons/${uid}/appointments`;
    const unsubAppointments = onSnapshot(
      query(collection(db, 'salons', uid, 'appointments'), where('ownerId', '==', uid)),
      (snap) => {
        const list: AppointmentItem[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<AppointmentItem, 'id'>),
        }));
        list.sort((a, b) => {
          const dateCmp = a.date.localeCompare(b.date);
          if (dateCmp !== 0) return dateCmp;
          return a.time.localeCompare(b.time);
        });
        setAppointments(list);
        appointmentsReady = true;
        markCollectionReady();
      },
      (error) => {
        appointmentsReady = true;
        markCollectionReady();
        handleFirestoreError(error, OperationType.LIST, appointmentsPath);
      }
    );

    return () => {
      unsubSalon();
      unsubServices();
      unsubClients();
      unsubAppointments();
    };
  }, [user, authReady]);

  const ensurePublicSalonDoc = useCallback(
    async (uid: string, activeSalon: Salon | null): Promise<string | null> => {
      if (!activeSalon) return null;
      if (
        verifiedPublicRef.current &&
        verifiedPublicRef.current.uid === uid &&
        verifiedPublicRef.current.slug === activeSalon.slug
      ) {
        return verifiedPublicRef.current.slug;
      }

      let activeSlug = activeSalon.slug;
      if (!activeSlug) {
        activeSlug = await resolveUniqueSlug(activeSalon.name, uid);
        await updateDoc(doc(db, 'salons', uid), {
          slug: activeSlug,
          updatedAt: serverTimestamp(),
        });
      }

      const pubRef = doc(db, 'publicSalons', activeSlug);
      const pubSnap = await getDoc(pubRef);
      if (!pubSnap.exists()) {
        await setDoc(pubRef, {
          salonId: uid,
          slug: activeSlug,
          name: clampText(activeSalon.name, LIMITS.SALON_NAME_MAX),
          openingHours: activeSalon.openingHours,
          updatedAt: serverTimestamp(),
        });
      } else if (pubSnap.data()?.salonId !== uid) {
        activeSlug = await resolveUniqueSlug(activeSalon.name, uid);
        await updateDoc(doc(db, 'salons', uid), {
          slug: activeSlug,
          updatedAt: serverTimestamp(),
        });
        await setDoc(doc(db, 'publicSalons', activeSlug), {
          salonId: uid,
          slug: activeSlug,
          name: clampText(activeSalon.name, LIMITS.SALON_NAME_MAX),
          openingHours: activeSalon.openingHours,
          updatedAt: serverTimestamp(),
        });
      }

      verifiedPublicRef.current = { uid, slug: activeSlug };
      return activeSlug;
    },
    []
  );

  // Automatically create/heal publicSalons storefront and subcollections once collections load
  useEffect(() => {
    if (!user || !salon || !salon.onboardingCompleted || collectionsLoading) return;
    if (syncedUidRef.current === user.uid || syncInFlightRef.current) return;

    const uid = user.uid;
    syncInFlightRef.current = true;

    const syncPublicMirror = async () => {
      try {
        // 1. Ensure parent publicSalons/{slug} document exists FIRST before any subcollection writes
        const activeSlug = await ensurePublicSalonDoc(uid, salon);
        if (!activeSlug) return;

        // 2. Build small chunked mirror operations (max 5 docs per batch to stay well below rule limits)
        const ops: Array<(batch: WriteBatch) => void> = [];

        for (const svc of services) {
          ops.push((batch) => {
            batch.set(doc(db, 'publicSalons', activeSlug, 'services', svc.id), {
              salonId: uid,
              name: clampText(svc.name, LIMITS.SERVICE_NAME_MAX),
              durationMinutes: clampInt(
                svc.durationMinutes,
                LIMITS.SERVICE_DURATION_MIN,
                LIMITS.SERVICE_DURATION_MAX
              ),
              priceFcfa: clampInt(
                svc.priceFcfa,
                LIMITS.SERVICE_PRICE_MIN,
                LIMITS.SERVICE_PRICE_MAX
              ),
              updatedAt: serverTimestamp(),
            });
          });
        }

        for (const client of clients) {
          if (normalizePhoneDigits(client.phone).length >= 6) {
            const phoneHash = await hashPhoneForSalon(uid, client.phone);
            ops.push((batch) => {
              batch.set(doc(db, 'publicSalons', activeSlug, 'phoneIndex', phoneHash), {
                salonId: uid,
                clientId: client.id,
                createdAt: serverTimestamp(),
              });
            });
          }
        }

        const activeAppts = appointments.filter(
          (a) => a.status === 'planifie' || a.status === 'confirme'
        );
        const lockedSet = new Set<string>();
        for (const appt of activeAppts) {
          ops.push((batch) => {
            batch.set(doc(db, 'publicSalons', activeSlug, 'takenSlots', appt.id), {
              salonId: uid,
              date: appt.date,
              startTime: appt.time,
              durationMinutes: appt.durationMinutes,
              appointmentId: appt.id,
              createdAt: serverTimestamp(),
            });
          });
          for (const lockId of getSlotLockIds(appt.date, appt.time, appt.durationMinutes)) {
            if (!lockedSet.has(lockId)) {
              lockedSet.add(lockId);
              ops.push((batch) => {
                batch.set(doc(db, 'publicSalons', activeSlug, 'slotLocks', lockId), {
                  salonId: uid,
                  date: appt.date,
                  appointmentId: appt.id,
                  createdAt: serverTimestamp(),
                });
              });
            }
          }
        }

        if (ops.length > 0) {
          await commitBatchedOps(ops, 5);
        }

        syncedUidRef.current = uid;
      } catch (err) {
        console.error('Erreur lors de la synchronisation de la page publique :', err);
      } finally {
        syncInFlightRef.current = false;
      }
    };

    syncPublicMirror();
  }, [user, salon, collectionsLoading, services, clients, appointments, ensurePublicSalonDoc]);

  const getActiveOccupiedBuckets = useCallback(
    (excludeAppointmentId?: string): Set<string> => {
      const set = new Set<string>();
      for (const appt of appointments) {
        if (appt.id === excludeAppointmentId) continue;
        if (appt.status !== 'planifie' && appt.status !== 'confirme') continue;
        for (const lockId of getSlotLockIds(appt.date, appt.time, appt.durationMinutes)) {
          set.add(lockId);
        }
      }
      return set;
    },
    [appointments]
  );

  const completeOnboarding = useCallback(
    async (input: {
      name: string;
      neighborhood: string;
      phone: string;
      openingHours: OpeningHoursMap;
    }) => {
      if (!user) return;
      const uid = user.uid;
      const cleanName = clampText(input.name, LIMITS.SALON_NAME_MAX);
      const slug = await resolveUniqueSlug(cleanName, uid);

      const salonPayload = {
        ownerId: uid,
        slug,
        name: cleanName,
        neighborhood: clampText(input.neighborhood, LIMITS.SALON_NEIGHBORHOOD_MAX),
        phone: clampText(input.phone, LIMITS.PHONE_MAX),
        openingHours: input.openingHours,
        onboardingCompleted: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      try {
        await setDoc(doc(db, 'salons', uid), salonPayload);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `salons/${uid}`);
      }

      try {
        await setDoc(doc(db, 'publicSalons', slug), {
          salonId: uid,
          slug,
          name: cleanName,
          openingHours: input.openingHours,
          updatedAt: serverTimestamp(),
        });
        verifiedPublicRef.current = { uid, slug };
      } catch (mirrorErr) {
        console.error('Synchronisation vitrine publique différée :', mirrorErr);
      }

      if (services.length === 0) {
        const createdServices: Array<{
          id: string;
          name: string;
          durationMinutes: number;
          priceFcfa: number;
        }> = [];
        const batch = writeBatch(db);
        const servicesCol = collection(db, 'salons', uid, 'services');
        for (const svc of STARTER_SERVICES) {
          const ref = doc(servicesCol);
          const svcName = clampText(svc.name, LIMITS.SERVICE_NAME_MAX);
          const duration = clampInt(
            svc.durationMinutes,
            LIMITS.SERVICE_DURATION_MIN,
            LIMITS.SERVICE_DURATION_MAX
          );
          const price = clampInt(
            svc.priceFcfa,
            LIMITS.SERVICE_PRICE_MIN,
            LIMITS.SERVICE_PRICE_MAX
          );
          batch.set(ref, {
            ownerId: uid,
            name: svcName,
            durationMinutes: duration,
            priceFcfa: price,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          createdServices.push({ id: ref.id, name: svcName, durationMinutes: duration, priceFcfa: price });
        }
        try {
          await batch.commit();
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `salons/${uid}/services`);
        }

        try {
          const pubOps = createdServices.map(
            (svc) => (b: WriteBatch) =>
              b.set(doc(db, 'publicSalons', slug, 'services', svc.id), {
                salonId: uid,
                name: svc.name,
                durationMinutes: svc.durationMinutes,
                priceFcfa: svc.priceFcfa,
                updatedAt: serverTimestamp(),
              })
          );
          await commitBatchedOps(pubOps, 5);
          syncedUidRef.current = uid;
        } catch (mirrorErr) {
          console.error('Synchronisation prestations publiques différée :', mirrorErr);
        }
      }
    },
    [user, services.length]
  );

  const updateSalonSettings = useCallback(
    async (input: {
      name: string;
      neighborhood: string;
      phone: string;
      openingHours: OpeningHoursMap;
    }) => {
      if (!user || !salon) return;
      const uid = user.uid;
      const cleanName = clampText(input.name, LIMITS.SALON_NAME_MAX);
      const activeSlug = salon.slug || (await resolveUniqueSlug(cleanName, uid));

      try {
        await updateDoc(doc(db, 'salons', uid), {
          name: cleanName,
          slug: activeSlug,
          neighborhood: clampText(input.neighborhood, LIMITS.SALON_NEIGHBORHOOD_MAX),
          phone: clampText(input.phone, LIMITS.PHONE_MAX),
          openingHours: input.openingHours,
          onboardingCompleted: true,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `salons/${uid}`);
      }

      try {
        const pubRef = doc(db, 'publicSalons', activeSlug);
        const pubSnap = await getDoc(pubRef);
        if (pubSnap.exists() && pubSnap.data()?.salonId === uid) {
          await updateDoc(pubRef, {
            name: cleanName,
            openingHours: input.openingHours,
            updatedAt: serverTimestamp(),
          });
        } else if (!pubSnap.exists()) {
          await setDoc(pubRef, {
            salonId: uid,
            slug: activeSlug,
            name: cleanName,
            openingHours: input.openingHours,
            updatedAt: serverTimestamp(),
          });
        }
        verifiedPublicRef.current = { uid, slug: activeSlug };
      } catch (mirrorErr) {
        console.error('Mise à jour vitrine publique différée :', mirrorErr);
      }
    },
    [user, salon]
  );

  const addService = useCallback(
    async (input: { name: string; durationMinutes: number; priceFcfa: number }) => {
      if (!user) return;
      const uid = user.uid;
      const ref = doc(collection(db, 'salons', uid, 'services'));
      const cleanName = clampText(input.name, LIMITS.SERVICE_NAME_MAX);
      const duration = clampInt(
        input.durationMinutes,
        LIMITS.SERVICE_DURATION_MIN,
        LIMITS.SERVICE_DURATION_MAX
      );
      const price = clampInt(
        input.priceFcfa,
        LIMITS.SERVICE_PRICE_MIN,
        LIMITS.SERVICE_PRICE_MAX
      );

      try {
        await setDoc(ref, {
          ownerId: uid,
          name: cleanName,
          durationMinutes: duration,
          priceFcfa: price,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `salons/${uid}/services`);
      }

      try {
        const activeSlug = await ensurePublicSalonDoc(uid, salon);
        if (activeSlug) {
          await setDoc(doc(db, 'publicSalons', activeSlug, 'services', ref.id), {
            salonId: uid,
            name: cleanName,
            durationMinutes: duration,
            priceFcfa: price,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (mirrorErr) {
        console.error('Synchronisation prestation publique ignorée :', mirrorErr);
      }
    },
    [user, salon, ensurePublicSalonDoc]
  );

  const updateService = useCallback(
    async (
      serviceId: string,
      input: { name: string; durationMinutes: number; priceFcfa: number }
    ) => {
      if (!user) return;
      const uid = user.uid;
      const cleanName = clampText(input.name, LIMITS.SERVICE_NAME_MAX);
      const duration = clampInt(
        input.durationMinutes,
        LIMITS.SERVICE_DURATION_MIN,
        LIMITS.SERVICE_DURATION_MAX
      );
      const price = clampInt(
        input.priceFcfa,
        LIMITS.SERVICE_PRICE_MIN,
        LIMITS.SERVICE_PRICE_MAX
      );

      try {
        await updateDoc(doc(db, 'salons', uid, 'services', serviceId), {
          name: cleanName,
          durationMinutes: duration,
          priceFcfa: price,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `salons/${uid}/services/${serviceId}`);
      }

      try {
        const activeSlug = await ensurePublicSalonDoc(uid, salon);
        if (activeSlug) {
          await setDoc(doc(db, 'publicSalons', activeSlug, 'services', serviceId), {
            salonId: uid,
            name: cleanName,
            durationMinutes: duration,
            priceFcfa: price,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (mirrorErr) {
        console.error('Mise à jour prestation publique ignorée :', mirrorErr);
      }
    },
    [user, salon, ensurePublicSalonDoc]
  );

  const deleteService = useCallback(
    async (serviceId: string) => {
      if (!user) return;
      const uid = user.uid;
      try {
        await deleteDoc(doc(db, 'salons', uid, 'services', serviceId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `salons/${uid}/services/${serviceId}`);
      }

      if (salon?.slug) {
        try {
          await deleteDoc(doc(db, 'publicSalons', salon.slug, 'services', serviceId));
        } catch (mirrorErr) {
          console.error('Suppression prestation publique ignorée :', mirrorErr);
        }
      }
    },
    [user, salon?.slug]
  );

  const seedStarterServices = useCallback(async () => {
    if (!user) return;
    const uid = user.uid;
    const createdServices: Array<{
      id: string;
      name: string;
      durationMinutes: number;
      priceFcfa: number;
    }> = [];
    const batch = writeBatch(db);
    const servicesCol = collection(db, 'salons', uid, 'services');
    for (const svc of STARTER_SERVICES) {
      const ref = doc(servicesCol);
      const svcName = clampText(svc.name, LIMITS.SERVICE_NAME_MAX);
      const duration = clampInt(
        svc.durationMinutes,
        LIMITS.SERVICE_DURATION_MIN,
        LIMITS.SERVICE_DURATION_MAX
      );
      const price = clampInt(svc.priceFcfa, LIMITS.SERVICE_PRICE_MIN, LIMITS.SERVICE_PRICE_MAX);
      batch.set(ref, {
        ownerId: uid,
        name: svcName,
        durationMinutes: duration,
        priceFcfa: price,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      createdServices.push({ id: ref.id, name: svcName, durationMinutes: duration, priceFcfa: price });
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `salons/${uid}/services`);
    }

    try {
      const activeSlug = await ensurePublicSalonDoc(uid, salon);
      if (activeSlug) {
        const pubOps = createdServices.map(
          (svc) => (b: WriteBatch) =>
            b.set(doc(db, 'publicSalons', activeSlug, 'services', svc.id), {
              salonId: uid,
              name: svc.name,
              durationMinutes: svc.durationMinutes,
              priceFcfa: svc.priceFcfa,
              updatedAt: serverTimestamp(),
            })
        );
        await commitBatchedOps(pubOps, 5);
      }
    } catch (mirrorErr) {
      console.error('Synchronisation prestations exemples publiques ignorée :', mirrorErr);
    }
  }, [user, salon, ensurePublicSalonDoc]);

  const addClient = useCallback(
    async (input: { name: string; phone: string; notes: string }): Promise<ClientItem | null> => {
      if (!user) return null;
      const uid = user.uid;
      const ref = doc(collection(db, 'salons', uid, 'clients'));
      const cleanName = clampText(input.name, LIMITS.CLIENT_NAME_MAX);
      const cleanPhone = clampText(input.phone, LIMITS.PHONE_MAX);
      const cleanNotes = clampText(input.notes, LIMITS.NOTES_MAX);

      try {
        await setDoc(ref, {
          ownerId: uid,
          name: cleanName,
          phone: cleanPhone,
          notes: cleanNotes,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `salons/${uid}/clients`);
      }

      if (normalizePhoneDigits(cleanPhone).length >= 6) {
        try {
          const activeSlug = await ensurePublicSalonDoc(uid, salon);
          if (activeSlug) {
            const phoneHash = await hashPhoneForSalon(uid, cleanPhone);
            await setDoc(doc(db, 'publicSalons', activeSlug, 'phoneIndex', phoneHash), {
              salonId: uid,
              clientId: ref.id,
              createdAt: serverTimestamp(),
            });
          }
        } catch (mirrorErr) {
          console.error('Synchronisation index téléphone public ignorée :', mirrorErr);
        }
      }

      return {
        id: ref.id,
        ownerId: uid,
        name: cleanName,
        phone: cleanPhone,
        notes: cleanNotes,
      };
    },
    [user, salon, ensurePublicSalonDoc]
  );

  const updateClient = useCallback(
    async (clientId: string, input: { name: string; phone: string; notes: string }) => {
      if (!user) return;
      const uid = user.uid;
      const existingClient = clients.find((c) => c.id === clientId);
      const cleanName = clampText(input.name, LIMITS.CLIENT_NAME_MAX);
      const cleanPhone = clampText(input.phone, LIMITS.PHONE_MAX);
      const cleanNotes = clampText(input.notes, LIMITS.NOTES_MAX);

      try {
        await updateDoc(doc(db, 'salons', uid, 'clients', clientId), {
          name: cleanName,
          phone: cleanPhone,
          notes: cleanNotes,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `salons/${uid}/clients/${clientId}`);
      }

      try {
        const activeSlug = await ensurePublicSalonDoc(uid, salon);
        if (activeSlug) {
          const oldNorm = existingClient ? normalizePhoneDigits(existingClient.phone) : '';
          const newNorm = normalizePhoneDigits(cleanPhone);
          if (oldNorm !== newNorm) {
            if (oldNorm.length >= 6 && existingClient) {
              const oldHash = await hashPhoneForSalon(uid, existingClient.phone);
              await deleteDoc(doc(db, 'publicSalons', activeSlug, 'phoneIndex', oldHash)).catch(
                () => {}
              );
            }
            if (newNorm.length >= 6) {
              const newHash = await hashPhoneForSalon(uid, cleanPhone);
              await setDoc(doc(db, 'publicSalons', activeSlug, 'phoneIndex', newHash), {
                salonId: uid,
                clientId,
                createdAt: serverTimestamp(),
              });
            }
          }
        }
      } catch (mirrorErr) {
        console.error('Mise à jour index téléphone public ignorée :', mirrorErr);
      }
    },
    [user, salon, clients, ensurePublicSalonDoc]
  );

  const deleteClient = useCallback(
    async (clientId: string) => {
      if (!user) return;
      const uid = user.uid;
      const existingClient = clients.find((c) => c.id === clientId);
      try {
        await deleteDoc(doc(db, 'salons', uid, 'clients', clientId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `salons/${uid}/clients/${clientId}`);
      }

      if (salon?.slug && existingClient && normalizePhoneDigits(existingClient.phone).length >= 6) {
        try {
          const oldHash = await hashPhoneForSalon(uid, existingClient.phone);
          await deleteDoc(doc(db, 'publicSalons', salon.slug, 'phoneIndex', oldHash));
        } catch (mirrorErr) {
          console.error('Suppression index téléphone public ignorée :', mirrorErr);
        }
      }
    },
    [user, salon?.slug, clients]
  );

  const addAppointment = useCallback(
    async (input: {
      client: ClientItem;
      service: ServiceItem;
      date: string;
      time: string;
      notes: string;
    }) => {
      if (!user) return;
      const uid = user.uid;
      const ref = doc(collection(db, 'salons', uid, 'appointments'));
      const duration = clampInt(
        input.service.durationMinutes,
        LIMITS.SERVICE_DURATION_MIN,
        LIMITS.SERVICE_DURATION_MAX
      );
      const price = clampInt(
        input.service.priceFcfa,
        LIMITS.SERVICE_PRICE_MIN,
        LIMITS.SERVICE_PRICE_MAX
      );

      try {
        await setDoc(ref, {
          ownerId: uid,
          clientId: input.client.id,
          clientName: clampText(input.client.name, LIMITS.CLIENT_NAME_MAX),
          clientPhone: clampText(input.client.phone, LIMITS.PHONE_MAX),
          serviceId: input.service.id,
          serviceName: clampText(input.service.name, LIMITS.SERVICE_NAME_MAX),
          durationMinutes: duration,
          priceFcfa: price,
          date: input.date,
          time: input.time,
          status: 'planifie' as AppointmentStatus,
          paymentMethod: '' as PaymentMethod,
          notes: clampText(input.notes, LIMITS.NOTES_MAX),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `salons/${uid}/appointments`);
      }

      try {
        const activeSlug = await ensurePublicSalonDoc(uid, salon);
        if (activeSlug) {
          await setDoc(doc(db, 'publicSalons', activeSlug, 'takenSlots', ref.id), {
            salonId: uid,
            date: input.date,
            startTime: input.time,
            durationMinutes: duration,
            appointmentId: ref.id,
            createdAt: serverTimestamp(),
          });

          const occupied = getActiveOccupiedBuckets();
          for (const lockId of getSlotLockIds(input.date, input.time, duration)) {
            if (!occupied.has(lockId)) {
              await setDoc(doc(db, 'publicSalons', activeSlug, 'slotLocks', lockId), {
                salonId: uid,
                date: input.date,
                appointmentId: ref.id,
                createdAt: serverTimestamp(),
              });
            }
          }
        }
      } catch (mirrorErr) {
        console.error('Synchronisation créneau public ignorée :', mirrorErr);
      }
    },
    [user, salon, ensurePublicSalonDoc, getActiveOccupiedBuckets]
  );

  const updateAppointment = useCallback(
    async (
      appointmentId: string,
      input: {
        client: ClientItem;
        service: ServiceItem;
        date: string;
        time: string;
        notes: string;
      }
    ) => {
      if (!user) return;
      const uid = user.uid;
      const previous = appointments.find((a) => a.id === appointmentId);
      const duration = clampInt(
        input.service.durationMinutes,
        LIMITS.SERVICE_DURATION_MIN,
        LIMITS.SERVICE_DURATION_MAX
      );
      const price = clampInt(
        input.service.priceFcfa,
        LIMITS.SERVICE_PRICE_MIN,
        LIMITS.SERVICE_PRICE_MAX
      );

      try {
        await updateDoc(doc(db, 'salons', uid, 'appointments', appointmentId), {
          clientId: input.client.id,
          clientName: clampText(input.client.name, LIMITS.CLIENT_NAME_MAX),
          clientPhone: clampText(input.client.phone, LIMITS.PHONE_MAX),
          serviceId: input.service.id,
          serviceName: clampText(input.service.name, LIMITS.SERVICE_NAME_MAX),
          durationMinutes: duration,
          priceFcfa: price,
          date: input.date,
          time: input.time,
          paymentMethod: (previous?.paymentMethod ?? '') as PaymentMethod,
          notes: clampText(input.notes, LIMITS.NOTES_MAX),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.UPDATE,
          `salons/${uid}/appointments/${appointmentId}`
        );
      }

      try {
        const activeSlug = await ensurePublicSalonDoc(uid, salon);
        if (activeSlug) {
          const occupiedElsewhere = getActiveOccupiedBuckets(appointmentId);
          const oldLocks = previous
            ? getSlotLockIds(previous.date, previous.time, previous.durationMinutes)
            : [];
          const newLocks = getSlotLockIds(input.date, input.time, duration);

          await deleteDoc(doc(db, 'publicSalons', activeSlug, 'takenSlots', appointmentId)).catch(
            () => {}
          );
          for (const oldLock of oldLocks) {
            if (!occupiedElsewhere.has(oldLock) && !newLocks.includes(oldLock)) {
              await deleteDoc(doc(db, 'publicSalons', activeSlug, 'slotLocks', oldLock)).catch(
                () => {}
              );
            }
          }

          await setDoc(doc(db, 'publicSalons', activeSlug, 'takenSlots', appointmentId), {
            salonId: uid,
            date: input.date,
            startTime: input.time,
            durationMinutes: duration,
            appointmentId,
            createdAt: serverTimestamp(),
          });
          for (const newLock of newLocks) {
            if (!occupiedElsewhere.has(newLock)) {
              await setDoc(doc(db, 'publicSalons', activeSlug, 'slotLocks', newLock), {
                salonId: uid,
                date: input.date,
                appointmentId,
                createdAt: serverTimestamp(),
              });
            }
          }
        }
      } catch (mirrorErr) {
        console.error('Mise à jour créneau public ignorée :', mirrorErr);
      }
    },
    [user, salon, appointments, ensurePublicSalonDoc, getActiveOccupiedBuckets]
  );

  const updateAppointmentStatus = useCallback(
    async (
      appointmentId: string,
      status: 'termine' | 'annule',
      paymentMethod?: PaymentMethod,
      priceFcfa?: number
    ) => {
      if (!user) return;
      const uid = user.uid;
      const target = appointments.find((a) => a.id === appointmentId);
      const nextPaymentMethod: PaymentMethod =
        status === 'termine' ? (paymentMethod ?? 'especes') : (target?.paymentMethod ?? '');

      const updatePayload: {
        status: 'termine' | 'annule';
        paymentMethod: PaymentMethod;
        priceFcfa?: number;
        updatedAt: ReturnType<typeof serverTimestamp>;
      } = {
        status,
        paymentMethod: nextPaymentMethod,
        updatedAt: serverTimestamp(),
      };

      if (status === 'termine' && typeof priceFcfa === 'number' && Number.isFinite(priceFcfa)) {
        updatePayload.priceFcfa = clampInt(
          priceFcfa,
          LIMITS.SERVICE_PRICE_MIN,
          LIMITS.SERVICE_PRICE_MAX
        );
      }

      try {
        await updateDoc(doc(db, 'salons', uid, 'appointments', appointmentId), updatePayload);
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.UPDATE,
          `salons/${uid}/appointments/${appointmentId}`
        );
      }

      if (status === 'annule' && salon?.slug && target) {
        try {
          const slug = salon.slug;
          const occupiedElsewhere = getActiveOccupiedBuckets(appointmentId);
          await deleteDoc(doc(db, 'publicSalons', slug, 'takenSlots', appointmentId)).catch(
            () => {}
          );
          for (const lockId of getSlotLockIds(target.date, target.time, target.durationMinutes)) {
            if (!occupiedElsewhere.has(lockId)) {
              await deleteDoc(doc(db, 'publicSalons', slug, 'slotLocks', lockId)).catch(() => {});
            }
          }
        } catch (mirrorErr) {
          console.error('Libération créneau public ignorée :', mirrorErr);
        }
      }
    },
    [user, salon?.slug, appointments, getActiveOccupiedBuckets]
  );

  const updateAppointmentPaymentMethod = useCallback(
    async (appointmentId: string, paymentMethod: PaymentMethod, priceFcfa?: number) => {
      if (!user) return;
      const uid = user.uid;
      const updatePayload: {
        paymentMethod: PaymentMethod;
        priceFcfa?: number;
        updatedAt: ReturnType<typeof serverTimestamp>;
      } = {
        paymentMethod,
        updatedAt: serverTimestamp(),
      };

      if (typeof priceFcfa === 'number' && Number.isFinite(priceFcfa)) {
        updatePayload.priceFcfa = clampInt(
          priceFcfa,
          LIMITS.SERVICE_PRICE_MIN,
          LIMITS.SERVICE_PRICE_MAX
        );
      }

      try {
        await updateDoc(doc(db, 'salons', uid, 'appointments', appointmentId), updatePayload);
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.UPDATE,
          `salons/${uid}/appointments/${appointmentId}`
        );
      }
    },
    [user]
  );

  const deleteAppointment = useCallback(
    async (appointmentId: string) => {
      if (!user) return;
      const uid = user.uid;
      const target = appointments.find((a) => a.id === appointmentId);

      try {
        await deleteDoc(doc(db, 'salons', uid, 'appointments', appointmentId));
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.DELETE,
          `salons/${uid}/appointments/${appointmentId}`
        );
      }

      if (salon?.slug && target) {
        try {
          const slug = salon.slug;
          const occupiedElsewhere = getActiveOccupiedBuckets(appointmentId);
          await deleteDoc(doc(db, 'publicSalons', slug, 'takenSlots', appointmentId)).catch(
            () => {}
          );
          for (const lockId of getSlotLockIds(target.date, target.time, target.durationMinutes)) {
            if (!occupiedElsewhere.has(lockId)) {
              await deleteDoc(doc(db, 'publicSalons', slug, 'slotLocks', lockId)).catch(() => {});
            }
          }
        } catch (mirrorErr) {
          console.error('Suppression créneau public ignorée :', mirrorErr);
        }
      }
    },
    [user, salon?.slug, appointments, getActiveOccupiedBuckets]
  );

  return {
    salon,
    salonLoading,
    collectionsLoading,
    services,
    clients,
    appointments,
    completeOnboarding,
    updateSalonSettings,
    addService,
    updateService,
    deleteService,
    seedStarterServices,
    addClient,
    updateClient,
    deleteClient,
    addAppointment,
    updateAppointment,
    updateAppointmentStatus,
    updateAppointmentPaymentMethod,
    deleteAppointment,
  };
}
