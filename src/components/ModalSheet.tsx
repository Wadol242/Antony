import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function ModalSheet({ open, onClose, title, children }: ModalSheetProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#180828]/55 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl border border-[#EBE4F2] shadow-xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="sm:hidden w-10 h-1.5 bg-[#DFD5EA] rounded-full mx-auto mt-3" />
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F1ECF6]">
          <h2 className="font-display text-xl font-semibold text-[#23093A] truncate pr-3">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#5E526B] hover:bg-[#F3ECFA] hover:text-[#23093A] transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
