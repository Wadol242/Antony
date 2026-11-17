import React, { useState } from 'react';
import { LogOut, MapPin, Phone, Scissors, Sparkles, Store } from 'lucide-react';
import { DEFAULT_OPENING_HOURS, LIMITS } from '../constants/validation';
import type { OpeningHoursMap } from '../types';
import { formatFirestoreErrorMessage } from '../utils/errors';
import { OpeningHoursEditor } from './OpeningHoursEditor';

interface OnboardingScreenProps {
  userEmail: string | null;
  onComplete: (data: {
    name: string;
    neighborhood: string;
    phone: string;
    openingHours: OpeningHoursMap;
  }) => Promise<void>;
  onSignOut: () => Promise<void>;
}

export function OnboardingScreen({ userEmail, onComplete, onSignOut }: OnboardingScreenProps) {
  const [name, setName] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [phone, setPhone] = useState('');
  const [openingHours, setOpeningHours] = useState<OpeningHoursMap>(DEFAULT_OPENING_HOURS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Veuillez indiquer le nom de votre salon.');
      return;
    }
    if (!neighborhood.trim()) {
      setError("Veuillez indiquer le quartier ou l'adresse de votre salon.");
      return;
    }
    if (!phone.trim()) {
      setError('Veuillez indiquer le numéro de téléphone du salon.');
      return;
    }

    setSaving(true);
    try {
      await onComplete({
        name: name.trim(),
        neighborhood: neighborhood.trim(),
        phone: phone.trim(),
        openingHours,
      });
    } catch (err) {
      setError(formatFirestoreErrorMessage(err, "Impossible d'enregistrer votre salon"));
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8FC] py-6 px-4 sm:py-10 sm:px-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-[#4C1D95] text-[#DFB54B] flex items-center justify-center">
              <Scissors className="w-5 h-5" />
            </span>
            <span className="font-display text-2xl font-bold text-[#23093A]">Salonéo</span>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="min-h-[44px] px-3 py-2 rounded-xl text-sm font-medium text-[#5E526B] hover:text-[#23093A] hover:bg-[#F3ECFA] flex items-center gap-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Déconnexion</span>
          </button>
        </div>

        <div className="bg-white rounded-3xl border border-[#EBE4F2] p-6 sm:p-8 shadow-sm">
          <div className="mb-6">
            <p className="text-xs font-semibold text-[#A87E15] mb-1">
              Première connexion{userEmail ? ` · ${userEmail}` : ''}
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#23093A] mb-2">
              Configurons votre salon
            </h1>
            <p className="text-sm text-[#5E526B] leading-relaxed">
              Renseignez les informations de votre établissement. Six prestations de départ (Coupe
              homme, Coupe femme, Tresses, Brushing, Barbe, Manucure) seront ajoutées
              automatiquement, modifiables à tout moment.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-6 rounded-2xl border border-[#F2C6C6] bg-[#FDF2F2] px-4 py-3 text-sm text-[#991B1B]"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="onboarding-name"
                  className="block text-sm font-semibold text-[#23093A] mb-1.5"
                >
                  Nom du salon
                </label>
                <div className="relative">
                  <Store className="w-5 h-5 text-[#7E6F8E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="onboarding-name"
                    type="text"
                    required
                    maxLength={LIMITS.SALON_NAME_MAX}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex : Maison Ébène Coiffure"
                    className="w-full min-h-[48px] pl-11 pr-4 py-3 rounded-2xl border border-[#DFD5EA] bg-[#FAF8FC] text-base text-[#1F1629] placeholder:text-[#9689A6] focus:outline-none focus:border-[#4C1D95] focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="onboarding-neighborhood"
                  className="block text-sm font-semibold text-[#23093A] mb-1.5"
                >
                  Quartier / Adresse
                </label>
                <div className="relative">
                  <MapPin className="w-5 h-5 text-[#7E6F8E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="onboarding-neighborhood"
                    type="text"
                    required
                    maxLength={LIMITS.SALON_NEIGHBORHOOD_MAX}
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    placeholder="Ex : Poto-Poto, Avenue de l'OUA, Brazzaville"
                    className="w-full min-h-[48px] pl-11 pr-4 py-3 rounded-2xl border border-[#DFD5EA] bg-[#FAF8FC] text-base text-[#1F1629] placeholder:text-[#9689A6] focus:outline-none focus:border-[#4C1D95] focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="onboarding-phone"
                  className="block text-sm font-semibold text-[#23093A] mb-1.5"
                >
                  Téléphone du salon
                </label>
                <div className="relative">
                  <Phone className="w-5 h-5 text-[#7E6F8E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="onboarding-phone"
                    type="tel"
                    required
                    maxLength={LIMITS.PHONE_MAX}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ex : +242 06 612 34 56"
                    className="w-full min-h-[48px] pl-11 pr-4 py-3 rounded-2xl border border-[#DFD5EA] bg-[#FAF8FC] text-base text-[#1F1629] placeholder:text-[#9689A6] focus:outline-none focus:border-[#4C1D95] focus:bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#EBE4F2]">
              <h2 className="font-display text-lg font-semibold text-[#23093A] mb-1">
                Horaires d'ouverture par jour
              </h2>
              <p className="text-xs text-[#6E5F7F] mb-3">
                Appuyez sur Ouvert ou Fermé puis ajustez les heures si besoin.
              </p>
              <OpeningHoursEditor value={openingHours} onChange={setOpeningHours} />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full min-h-[54px] px-6 py-4 rounded-2xl bg-[#4C1D95] text-white font-semibold text-base flex items-center justify-center gap-2 hover:bg-[#3B0764] active:scale-[0.99] transition-all disabled:opacity-60"
            >
              <Sparkles className="w-5 h-5 text-[#DFB54B]" />
              <span>{saving ? 'Enregistrement en cours…' : 'Enregistrer et ouvrir mon salon'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
