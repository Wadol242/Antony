import React, { useState } from 'react';
import { Pencil, Plus, Scissors, Sparkles, Trash2 } from 'lucide-react';
import { LIMITS } from '../constants/validation';
import type { ServiceItem } from '../types';
import { formatFirestoreErrorMessage } from '../utils/errors';
import { formatDuration, formatFcfa } from '../utils/formatters';
import { ModalSheet } from './ModalSheet';

interface ServicesViewProps {
  services: ServiceItem[];
  loading: boolean;
  onAddService: (input: { name: string; durationMinutes: number; priceFcfa: number }) => Promise<void>;
  onUpdateService: (
    serviceId: string,
    input: { name: string; durationMinutes: number; priceFcfa: number }
  ) => Promise<void>;
  onDeleteService: (serviceId: string) => Promise<void>;
  onSeedStarters: () => Promise<void>;
}

export function ServicesView({
  services,
  loading,
  onAddService,
  onUpdateService,
  onDeleteService,
  onSeedStarters,
}: ServicesViewProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceItem | null>(null);
  const [deleting, setDeleting] = useState<ServiceItem | null>(null);

  const [name, setName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('45');
  const [priceFcfa, setPriceFcfa] = useState('5000');
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [pageError, setPageError] = useState('');

  const openAdd = () => {
    setEditing(null);
    setName('');
    setDurationMinutes('45');
    setPriceFcfa('5000');
    setError('');
    setModalOpen(true);
  };

  const openEdit = (service: ServiceItem) => {
    setEditing(service);
    setName(service.name);
    setDurationMinutes(String(service.durationMinutes));
    setPriceFcfa(String(service.priceFcfa));
    setError('');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanName = name.trim();
    const dur = parseInt(durationMinutes, 10);
    const price = parseInt(priceFcfa, 10);

    if (!cleanName) {
      setError('Veuillez indiquer le nom de la prestation.');
      return;
    }
    if (Number.isNaN(dur) || dur < LIMITS.SERVICE_DURATION_MIN || dur > LIMITS.SERVICE_DURATION_MAX) {
      setError(
        `La durée doit être comprise entre ${LIMITS.SERVICE_DURATION_MIN} et ${LIMITS.SERVICE_DURATION_MAX} minutes.`
      );
      return;
    }
    if (Number.isNaN(price) || price < LIMITS.SERVICE_PRICE_MIN || price > LIMITS.SERVICE_PRICE_MAX) {
      setError('Veuillez saisir un tarif valide en FCFA.');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await onUpdateService(editing.id, {
          name: cleanName,
          durationMinutes: dur,
          priceFcfa: price,
        });
      } else {
        await onAddService({
          name: cleanName,
          durationMinutes: dur,
          priceFcfa: price,
        });
      }
      setModalOpen(false);
    } catch (err) {
      setError(formatFirestoreErrorMessage(err, "Impossible d'enregistrer cette prestation"));
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleting) return;
    setDeleteError('');
    setSaving(true);
    try {
      await onDeleteService(deleting.id);
      setDeleting(null);
    } catch (err) {
      setDeleteError(formatFirestoreErrorMessage(err, 'Impossible de supprimer cette prestation'));
    } finally {
      setSaving(false);
    }
  };

  const handleSeed = async () => {
    setPageError('');
    setSeeding(true);
    try {
      await onSeedStarters();
    } catch (err) {
      setPageError(formatFirestoreErrorMessage(err, "Impossible d'ajouter les prestations"));
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#23093A]">
            Prestations & Tarifs
          </h1>
          <p className="text-sm text-[#5E526B] mt-1 tabular-nums">
            {services.length} {services.length <= 1 ? 'prestation proposée' : 'prestations proposées'}
          </p>
        </div>

        <button
          type="button"
          onClick={openAdd}
          className="w-full sm:w-auto min-h-[48px] px-5 py-3 rounded-2xl bg-[#4C1D95] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#3B0764] active:scale-[0.99] transition-all whitespace-nowrap shrink-0"
        >
          <Plus className="w-5 h-5 text-[#DFB54B]" />
          <span>Ajouter une prestation</span>
        </button>
      </div>

      {pageError && (
        <div
          role="alert"
          className="rounded-2xl border border-[#F2C6C6] bg-[#FDF2F2] px-4 py-3 text-sm text-[#991B1B]"
        >
          {pageError}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="bg-white rounded-3xl border border-[#EBE4F2] p-8 text-center text-sm text-[#6E5F7F]">
          Chargement des prestations…
        </div>
      ) : services.length === 0 ? (
        <div className="bg-white rounded-3xl border border-[#EBE4F2] p-8 sm:p-10 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#F3ECFA] text-[#4C1D95] flex items-center justify-center">
            <Scissors className="w-7 h-7" />
          </div>
          <h2 className="font-display text-xl font-semibold text-[#23093A] mb-2">
            Aucune prestation enregistrée
          </h2>
          <p className="text-sm text-[#5E526B] max-w-md mx-auto mb-6">
            Ajoutez vos coupes, tresses et soins avec leur durée et leur tarif en FCFA pour prendre
            des rendez-vous en un clic.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={openAdd}
              className="w-full sm:w-auto min-h-[48px] px-6 py-3 rounded-2xl bg-[#4C1D95] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#3B0764] transition-colors"
            >
              <Plus className="w-4 h-4 text-[#DFB54B]" />
              <span>Créer une prestation</span>
            </button>
            <button
              type="button"
              onClick={handleSeed}
              disabled={seeding}
              className="w-full sm:w-auto min-h-[48px] px-6 py-3 rounded-2xl border border-[#DFD5EA] bg-white text-[#23093A] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#FAF8FC] transition-colors disabled:opacity-60"
            >
              <Sparkles className="w-4 h-4 text-[#A87E15]" />
              <span>{seeding ? 'Ajout…' : 'Charger les 6 exemples'}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-[#EBE4F2] divide-y divide-[#F1ECF6] overflow-hidden">
          {services.map((service) => (
            <div
              key={service.id}
              className="p-4 sm:px-6 sm:py-5 flex items-center justify-between gap-4 hover:bg-[#FAF8FC]/70 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-[#23093A] truncate">
                  {service.name}
                </h2>
                <div className="mt-1 flex items-center gap-2 text-sm text-[#5E526B] tabular-nums">
                  <span>{formatDuration(service.durationMinutes)}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-[#A87E15]">
                    {formatFcfa(service.priceFcfa)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => openEdit(service)}
                  aria-label={`Modifier ${service.name}`}
                  className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#4C1D95] hover:bg-[#F3ECFA] transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteError('');
                    setDeleting(service);
                  }}
                  aria-label={`Supprimer ${service.name}`}
                  className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#991B1B] hover:bg-[#FDF2F2] transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit modal */}
      <ModalSheet
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Modifier la prestation' : 'Nouvelle prestation'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {error && (
            <div
              role="alert"
              className="rounded-2xl border border-[#F2C6C6] bg-[#FDF2F2] px-4 py-3 text-sm text-[#991B1B]"
            >
              {error}
            </div>
          )}

          <div>
            <label htmlFor="svc-name" className="block text-sm font-semibold text-[#23093A] mb-1.5">
              Nom de la prestation
            </label>
            <input
              id="svc-name"
              type="text"
              required
              maxLength={LIMITS.SERVICE_NAME_MAX}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex : Tresses collées"
              className="w-full min-h-[48px] px-4 py-3 rounded-2xl border border-[#DFD5EA] bg-[#FAF8FC] text-base text-[#1F1629] placeholder:text-[#9689A6] focus:outline-none focus:border-[#4C1D95] focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="svc-duration"
                className="block text-sm font-semibold text-[#23093A] mb-1.5"
              >
                Durée (en minutes)
              </label>
              <input
                id="svc-duration"
                type="number"
                inputMode="numeric"
                required
                min={LIMITS.SERVICE_DURATION_MIN}
                max={LIMITS.SERVICE_DURATION_MAX}
                step={5}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="w-full min-h-[48px] px-4 py-3 rounded-2xl border border-[#DFD5EA] bg-[#FAF8FC] text-base text-[#1F1629] tabular-nums focus:outline-none focus:border-[#4C1D95] focus:bg-white"
              />
            </div>

            <div>
              <label
                htmlFor="svc-price"
                className="block text-sm font-semibold text-[#23093A] mb-1.5"
              >
                Tarif (en FCFA)
              </label>
              <input
                id="svc-price"
                type="number"
                inputMode="numeric"
                required
                min={LIMITS.SERVICE_PRICE_MIN}
                max={LIMITS.SERVICE_PRICE_MAX}
                step={100}
                value={priceFcfa}
                onChange={(e) => setPriceFcfa(e.target.value)}
                className="w-full min-h-[48px] px-4 py-3 rounded-2xl border border-[#DFD5EA] bg-[#FAF8FC] text-base text-[#1F1629] tabular-nums focus:outline-none focus:border-[#4C1D95] focus:bg-white"
              />
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="w-full sm:w-1/3 min-h-[48px] px-5 py-3 rounded-2xl border border-[#DFD5EA] bg-white text-[#4A3D58] font-semibold text-sm hover:bg-[#FAF8FC] transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-2/3 min-h-[50px] px-6 py-3 rounded-2xl bg-[#4C1D95] text-white font-semibold text-base hover:bg-[#3B0764] transition-colors disabled:opacity-60"
            >
              {saving ? 'Enregistrement…' : editing ? 'Enregistrer les modifications' : 'Ajouter'}
            </button>
          </div>
        </form>
      </ModalSheet>

      {/* Delete confirmation modal */}
      <ModalSheet
        open={Boolean(deleting)}
        onClose={() => {
          setDeleting(null);
          setDeleteError('');
        }}
        title="Supprimer cette prestation ?"
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
          Voulez-vous vraiment supprimer{' '}
          <strong className="text-[#23093A]">{deleting?.name}</strong> ? Les rendez-vous déjà
          enregistrés garderont leur montant.
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
            disabled={saving}
            className="w-full sm:w-1/2 min-h-[48px] px-5 py-3 rounded-2xl bg-[#991B1B] text-white font-semibold text-sm hover:bg-[#7F1D1D] disabled:opacity-60"
          >
            {saving ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </ModalSheet>
    </div>
  );
}
