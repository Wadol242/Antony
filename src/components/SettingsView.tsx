import React, { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Link2, LogOut, MapPin, Phone, Store } from 'lucide-react';
import { LIMITS } from '../constants/validation';
import type { OpeningHoursMap, Salon } from '../types';
import { formatFirestoreErrorMessage } from '../utils/errors';
import { OpeningHoursEditor } from './OpeningHoursEditor';

interface SettingsViewProps {
  salon: Salon;
  userEmail: string | null;
  onSaveSettings: (input: {
    name: string;
    neighborhood: string;
    phone: string;
    openingHours: OpeningHoursMap;
  }) => Promise<void>;
  onSignOut: () => Promise<void>;
}

export function SettingsView({
  salon,
  userEmail,
  onSaveSettings,
  onSignOut,
}: SettingsViewProps) {
  const [name, setName] = useState(salon.name);
  const [neighborhood, setNeighborhood] = useState(salon.neighborhood);
  const [phone, setPhone] = useState(salon.phone);
  const [openingHours, setOpeningHours] = useState<OpeningHoursMap>(salon.openingHours);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setName(salon.name);
    setNeighborhood(salon.neighborhood);
    setPhone(salon.phone);
    setOpeningHours(salon.openingHours);
  }, [salon]);

  const publicPath = salon.slug ? `/s/${salon.slug}` : '';
  const publicUrl =
    publicPath && typeof window !== 'undefined' ? `${window.location.origin}${publicPath}` : '';

  const handleCopyLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = publicUrl;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSavedNotice(false);

    if (!name.trim() || !neighborhood.trim() || !phone.trim()) {
      setError('Veuillez remplir le nom, le quartier et le téléphone du salon.');
      return;
    }

    setSaving(true);
    try {
      await onSaveSettings({
        name: name.trim(),
        neighborhood: neighborhood.trim(),
        phone: phone.trim(),
        openingHours,
      });
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3500);
    } catch (err) {
      setError(formatFirestoreErrorMessage(err, "Impossible d'enregistrer les modifications"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#23093A]">
          Paramètres du salon
        </h1>
        <p className="text-sm text-[#5E526B] mt-1">
          Partagez votre lien de réservation, modifiez vos coordonnées et vos horaires.
        </p>
      </div>

      {/* Shareable Public Booking Link Card */}
      <div className="bg-white rounded-3xl border border-[#EBE4F2] p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-[#FBF4DE] text-[#A87E15] flex items-center justify-center shrink-0">
            <Link2 className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold text-[#23093A]">
              Lien de réservation en ligne
            </h2>
            <p className="text-sm text-[#5E526B] mt-0.5">
              Partagez ce lien sur WhatsApp ou Instagram : vos clients choisissent leur prestation et
              leur créneau sans créer de compte.
            </p>
          </div>
        </div>

        {publicUrl ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0 px-4 py-3 rounded-2xl border border-[#DFD5EA] bg-[#FAF8FC] text-sm font-medium text-[#23093A] truncate">
              {publicUrl}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex-1 sm:flex-initial min-h-[48px] px-5 py-3 rounded-2xl bg-[#4C1D95] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#3B0764] transition-colors whitespace-nowrap"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-[#DFB54B]" />
                    <span>Lien copié !</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-[#DFB54B]" />
                    <span>Copier le lien</span>
                  </>
                )}
              </button>
              <a
                href={publicPath}
                className="min-h-[48px] px-4 py-3 rounded-2xl border border-[#DFD5EA] bg-white text-[#23093A] font-semibold text-sm inline-flex items-center justify-center gap-1.5 hover:bg-[#FAF8FC] transition-colors whitespace-nowrap"
              >
                <ExternalLink className="w-4 h-4 text-[#4C1D95]" />
                <span>Ouvrir</span>
              </a>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[#6E5F7F]">Préparation du lien de réservation en cours…</p>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-3xl border border-[#EBE4F2] p-5 sm:p-8 space-y-6"
      >
        {error && (
          <div
            role="alert"
            className="rounded-2xl border border-[#F2C6C6] bg-[#FDF2F2] px-4 py-3 text-sm text-[#991B1B]"
          >
            {error}
          </div>
        )}

        {savedNotice && (
          <div className="rounded-2xl border border-[#B7E4C7] bg-[#EEF8F1] px-4 py-3 text-sm font-medium text-[#166534] flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>Les informations du salon ont bien été mises à jour.</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label
              htmlFor="set-name"
              className="block text-sm font-semibold text-[#23093A] mb-1.5"
            >
              Nom du salon
            </label>
            <div className="relative">
              <Store className="w-5 h-5 text-[#7E6F8E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="set-name"
                type="text"
                required
                maxLength={LIMITS.SALON_NAME_MAX}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full min-h-[48px] pl-11 pr-4 py-3 rounded-2xl border border-[#DFD5EA] bg-[#FAF8FC] text-base text-[#1F1629] focus:outline-none focus:border-[#4C1D95] focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="set-neighborhood"
              className="block text-sm font-semibold text-[#23093A] mb-1.5"
            >
              Quartier / Adresse
            </label>
            <div className="relative">
              <MapPin className="w-5 h-5 text-[#7E6F8E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="set-neighborhood"
                type="text"
                required
                maxLength={LIMITS.SALON_NEIGHBORHOOD_MAX}
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="w-full min-h-[48px] pl-11 pr-4 py-3 rounded-2xl border border-[#DFD5EA] bg-[#FAF8FC] text-base text-[#1F1629] focus:outline-none focus:border-[#4C1D95] focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="set-phone"
              className="block text-sm font-semibold text-[#23093A] mb-1.5"
            >
              Téléphone
            </label>
            <div className="relative">
              <Phone className="w-5 h-5 text-[#7E6F8E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="set-phone"
                type="tel"
                required
                maxLength={LIMITS.PHONE_MAX}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full min-h-[48px] pl-11 pr-4 py-3 rounded-2xl border border-[#DFD5EA] bg-[#FAF8FC] text-base text-[#1F1629] focus:outline-none focus:border-[#4C1D95] focus:bg-white"
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-[#F1ECF6]">
          <h2 className="font-display text-lg font-semibold text-[#23093A] mb-1">
            Horaires d'ouverture
          </h2>
          <p className="text-xs text-[#6E5F7F] mb-3">Fuseau horaire : Africa/Brazzaville</p>
          <OpeningHoursEditor value={openingHours} onChange={setOpeningHours} />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full sm:w-auto min-h-[50px] px-8 py-3 rounded-2xl bg-[#4C1D95] text-white font-semibold text-base hover:bg-[#3B0764] transition-colors disabled:opacity-60"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
        </button>
      </form>

      {/* Account section */}
      <div className="bg-white rounded-3xl border border-[#EBE4F2] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-[#23093A]">Compte connecté</h2>
          <p className="text-sm text-[#5E526B] mt-0.5">
            {userEmail || 'Compte salon privé'} · Un salon par compte
          </p>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          className="w-full sm:w-auto min-h-[48px] px-6 py-3 rounded-2xl border border-[#F2C6C6] bg-[#FDF2F2] text-[#991B1B] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#FBE4E4] transition-colors whitespace-nowrap"
        >
          <LogOut className="w-4 h-4" />
          <span>Se déconnecter</span>
        </button>
      </div>
    </div>
  );
}
