import React, { useMemo, useState } from 'react';
import { CalendarPlus, Pencil, Phone, Search, Trash2, UserPlus, Users } from 'lucide-react';
import { LIMITS } from '../constants/validation';
import type { ClientItem } from '../types';
import { formatFirestoreErrorMessage } from '../utils/errors';
import { ModalSheet } from './ModalSheet';

interface ClientsViewProps {
  clients: ClientItem[];
  loading: boolean;
  onAddClient: (input: { name: string; phone: string; notes: string }) => Promise<ClientItem | null>;
  onUpdateClient: (
    clientId: string,
    input: { name: string; phone: string; notes: string }
  ) => Promise<void>;
  onDeleteClient: (clientId: string) => Promise<void>;
  onBookForClient: (clientId: string) => void;
}

export function ClientsView({
  clients,
  loading,
  onAddClient,
  onUpdateClient,
  onDeleteClient,
  onBookForClient,
}: ClientsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ClientItem | null>(null);
  const [deleting, setDeleting] = useState<ClientItem | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const filteredClients = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return clients;
    const digitsOnly = q.replace(/\s+/g, '');
    return clients.filter((c) => {
      const nameMatch = c.name.toLowerCase().includes(q);
      const phoneClean = c.phone.toLowerCase().replace(/\s+/g, '');
      const phoneMatch = c.phone.toLowerCase().includes(q) || phoneClean.includes(digitsOnly);
      return nameMatch || phoneMatch;
    });
  }, [clients, searchTerm]);

  const openAdd = () => {
    setEditing(null);
    setName('');
    setPhone('');
    setNotes('');
    setError('');
    setModalOpen(true);
  };

  const openEdit = (client: ClientItem) => {
    setEditing(client);
    setName(client.name);
    setPhone(client.phone);
    setNotes(client.notes);
    setError('');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Veuillez saisir le nom du client.');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await onUpdateClient(editing.id, {
          name: name.trim(),
          phone: phone.trim(),
          notes: notes.trim(),
        });
      } else {
        await onAddClient({
          name: name.trim(),
          phone: phone.trim(),
          notes: notes.trim(),
        });
      }
      setModalOpen(false);
    } catch (err) {
      setError(formatFirestoreErrorMessage(err, "Impossible d'enregistrer la fiche client"));
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleting) return;
    setDeleteError('');
    setSaving(true);
    try {
      await onDeleteClient(deleting.id);
      setDeleting(null);
    } catch (err) {
      setDeleteError(formatFirestoreErrorMessage(err, 'Impossible de supprimer le client'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#23093A]">
            Clients
          </h1>
          <p className="text-sm text-[#5E526B] mt-1 tabular-nums">
            {clients.length} {clients.length <= 1 ? 'client enregistré' : 'clients enregistrés'}
          </p>
        </div>

        <button
          type="button"
          onClick={openAdd}
          className="w-full sm:w-auto min-h-[48px] px-5 py-3 rounded-2xl bg-[#4C1D95] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#3B0764] active:scale-[0.99] transition-all whitespace-nowrap shrink-0"
        >
          <UserPlus className="w-5 h-5 text-[#DFB54B]" />
          <span>Ajouter un client</span>
        </button>
      </div>

      {/* Search bar */}
      {clients.length > 0 && (
        <div className="relative">
          <Search className="w-5 h-5 text-[#7E6F8E] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher par nom ou téléphone…"
            aria-label="Rechercher un client par nom ou numéro de téléphone"
            className="w-full min-h-[50px] pl-12 pr-4 py-3 rounded-2xl border border-[#EBE4F2] bg-white text-base text-[#1F1629] placeholder:text-[#9689A6] focus:outline-none focus:border-[#4C1D95]"
          />
        </div>
      )}

      {/* List or empty states */}
      {loading ? (
        <div className="bg-white rounded-3xl border border-[#EBE4F2] p-8 text-center text-sm text-[#6E5F7F]">
          Chargement des fiches clients…
        </div>
      ) : clients.length === 0 ? (
        <div className="bg-white rounded-3xl border border-[#EBE4F2] p-8 sm:p-10 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#F3ECFA] text-[#4C1D95] flex items-center justify-center">
            <Users className="w-7 h-7" />
          </div>
          <h2 className="font-display text-xl font-semibold text-[#23093A] mb-2">
            Aucun client pour l'instant
          </h2>
          <p className="text-sm text-[#5E526B] max-w-md mx-auto mb-6">
            Enregistrez vos clients habituels avec leur numéro de téléphone et vos notes de
            préférences pour retrouver leurs informations rapidement.
          </p>
          <button
            type="button"
            onClick={openAdd}
            className="w-full sm:w-auto min-h-[48px] px-6 py-3 rounded-2xl bg-[#4C1D95] text-white font-semibold text-sm inline-flex items-center justify-center gap-2 hover:bg-[#3B0764] transition-colors"
          >
            <UserPlus className="w-4 h-4 text-[#DFB54B]" />
            <span>Ajouter mon premier client</span>
          </button>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="bg-white rounded-3xl border border-[#EBE4F2] p-8 text-center">
          <p className="text-base font-semibold text-[#23093A] mb-1">
            Aucun client trouvé pour « {searchTerm} »
          </p>
          <p className="text-sm text-[#5E526B] mb-4">
            Vérifiez l'orthographe du nom ou les chiffres du téléphone.
          </p>
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="min-h-[44px] px-5 py-2 rounded-xl border border-[#DFD5EA] text-sm font-semibold text-[#4C1D95] hover:bg-[#FAF8FC]"
          >
            Afficher tous les clients
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-[#EBE4F2] divide-y divide-[#F1ECF6] overflow-hidden">
          {filteredClients.map((client) => (
            <div
              key={client.id}
              className="p-4 sm:px-6 sm:py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-[#FAF8FC]/70 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-[#23093A] truncate">{client.name}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#5E526B]">
                  {client.phone ? (
                    <span className="inline-flex items-center gap-1.5 tabular-nums text-[#2D1F3D]">
                      <Phone className="w-3.5 h-3.5 text-[#A87E15]" />
                      {client.phone}
                    </span>
                  ) : (
                    <span className="text-[#867996]">Pas de téléphone</span>
                  )}
                  {client.notes && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-[#6E5F7F] line-clamp-1">{client.notes}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onBookForClient(client.id)}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F3ECFA] text-[#4C1D95] text-xs font-semibold flex items-center gap-1.5 hover:bg-[#E7DBF5] transition-colors whitespace-nowrap"
                >
                  <CalendarPlus className="w-4 h-4" />
                  <span>Nouveau RDV</span>
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(client)}
                  aria-label={`Modifier ${client.name}`}
                  className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#4C1D95] hover:bg-[#F3ECFA] transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteError('');
                    setDeleting(client);
                  }}
                  aria-label={`Supprimer ${client.name}`}
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
        title={editing ? 'Modifier le client' : 'Nouveau client'}
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
            <label htmlFor="cli-name" className="block text-sm font-semibold text-[#23093A] mb-1.5">
              Nom complet
            </label>
            <input
              id="cli-name"
              type="text"
              required
              maxLength={LIMITS.CLIENT_NAME_MAX}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex : Chancelvie Makosso"
              className="w-full min-h-[48px] px-4 py-3 rounded-2xl border border-[#DFD5EA] bg-[#FAF8FC] text-base text-[#1F1629] placeholder:text-[#9689A6] focus:outline-none focus:border-[#4C1D95] focus:bg-white"
            />
          </div>

          <div>
            <label
              htmlFor="cli-phone"
              className="block text-sm font-semibold text-[#23093A] mb-1.5"
            >
              Téléphone
            </label>
            <input
              id="cli-phone"
              type="tel"
              maxLength={LIMITS.PHONE_MAX}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ex : +242 06 512 88 99"
              className="w-full min-h-[48px] px-4 py-3 rounded-2xl border border-[#DFD5EA] bg-[#FAF8FC] text-base text-[#1F1629] placeholder:text-[#9689A6] focus:outline-none focus:border-[#4C1D95] focus:bg-white"
            />
          </div>

          <div>
            <label
              htmlFor="cli-notes"
              className="block text-sm font-semibold text-[#23093A] mb-1.5"
            >
              Notes et préférences (optionnel)
            </label>
            <textarea
              id="cli-notes"
              rows={3}
              maxLength={LIMITS.NOTES_MAX}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex : Préfère le lissage doux, allergique à tel produit…"
              className="w-full px-4 py-3 rounded-2xl border border-[#DFD5EA] bg-[#FAF8FC] text-base text-[#1F1629] placeholder:text-[#9689A6] focus:outline-none focus:border-[#4C1D95] focus:bg-white"
            />
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="w-full sm:w-1/3 min-h-[48px] px-5 py-3 rounded-2xl border border-[#DFD5EA] bg-white text-[#4A3D58] font-semibold text-sm hover:bg-[#FAF8FC]"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-2/3 min-h-[50px] px-6 py-3 rounded-2xl bg-[#4C1D95] text-white font-semibold text-base hover:bg-[#3B0764] transition-colors disabled:opacity-60"
            >
              {saving ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Ajouter le client'}
            </button>
          </div>
        </form>
      </ModalSheet>

      {/* Delete confirmation */}
      <ModalSheet
        open={Boolean(deleting)}
        onClose={() => {
          setDeleting(null);
          setDeleteError('');
        }}
        title="Supprimer cette fiche client ?"
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
          <strong className="text-[#23093A]">{deleting?.name}</strong> de votre répertoire ?
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
