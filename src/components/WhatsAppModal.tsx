import React, { useState, useEffect } from 'react';
import { X, Send, Phone, MessageSquare, AlertCircle } from 'lucide-react';
import { Debt, DebtSummary } from '../types/debt';
import { sanitizeWhatsAppPhone, buildDefaultWhatsAppMessage } from '../utils/debtCalculations';

interface WhatsAppModalProps {
  debt: Debt;
  summary: DebtSummary;
  onClose: () => void;
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({ debt, summary, onClose }) => {
  const [phone, setPhone] = useState(debt.phoneNumber || '');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMessage(buildDefaultWhatsAppMessage(debt, summary));
    setPhone(debt.phoneNumber || '');
  }, [debt, summary]);

  const handleOpenWhatsApp = () => {
    const cleanPhone = sanitizeWhatsAppPhone(phone);
    if (!cleanPhone || cleanPhone.length < 8) {
      setError('Veuillez renseigner un numéro de téléphone valide avec indicatif (ex: +243...)');
      return;
    }

    if (!message.trim()) {
      setError('Le message ne peut pas être vide.');
      return;
    }

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message.trim())}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    onClose();
  };

  const cleanFormatted = sanitizeWhatsAppPhone(phone);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl text-slate-100 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Rappeler par WhatsApp</h3>
              <p className="text-[11px] text-slate-400">À : {debt.personName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="py-4 space-y-3 overflow-y-auto flex-1">
          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Recipient Phone */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Numéro de téléphone WhatsApp
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setError(null);
                }}
                placeholder="+243..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              {cleanFormatted ? `Format international wa.me/${cleanFormatted}` : 'Indicatif par défaut : +243 (RDC)'}
            </div>
          </div>

          {/* Message Preview and Editor */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-300">
                Message pré-écrit (modifiable)
              </label>
              <button
                type="button"
                onClick={() => setMessage(buildDefaultWhatsAppMessage(debt, summary))}
                className="text-[11px] text-emerald-400 hover:underline"
              >
                Réinitialiser
              </button>
            </div>
            <textarea
              rows={7}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setError(null);
              }}
              className="w-full p-3 text-xs leading-relaxed bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition resize-none font-sans"
              placeholder="Écrivez votre message..."
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-800 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleOpenWhatsApp}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 transition cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Ouvrir WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
};
