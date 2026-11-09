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
      <div className="w-full max-w-lg rounded-t-[16px] sm:rounded-[16px] bg-[#1C232D] border border-[#2A3340] p-4 sm:p-5 text-[#ECE9E2] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2A3340]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[8px] bg-[#151A22] border border-[#2A3340] text-[#5FB48C] flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#ECE9E2]">Rappeler par WhatsApp</h3>
              <p className="text-xs text-[#98A2B0]">À : {debt.personName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-[8px] text-[#98A2B0] hover:text-[#ECE9E2] hover:bg-[#151A22] transition flex items-center justify-center cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="py-4 space-y-3 overflow-y-auto flex-1 text-xs">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-[8px] bg-[#151A22] border border-[#E5604D] text-[#E5604D]">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#E5604D]" />
              <span>{error}</span>
            </div>
          )}

          {/* Recipient Phone */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#ECE9E2]">
              Numéro de téléphone WhatsApp
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-[#98A2B0] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setError(null);
                }}
                placeholder="+243..."
                className="w-full min-h-[44px] pl-9 pr-3 text-sm bg-[#151A22] border border-[#2A3340] rounded-[8px] text-[#ECE9E2] placeholder-[#98A2B0] focus:outline-none focus:border-[#C8A96A] transition"
              />
            </div>
            <div className="text-xs text-[#98A2B0]">
              {cleanFormatted ? `Format international wa.me/${cleanFormatted}` : 'Indicatif par défaut : +243 (RDC)'}
            </div>
          </div>

          {/* Message Preview and Editor */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-[#ECE9E2]">
                Message pré-écrit (modifiable)
              </label>
              <button
                type="button"
                onClick={() => setMessage(buildDefaultWhatsAppMessage(debt, summary))}
                className="text-xs text-[#C8A96A] hover:underline cursor-pointer"
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
              className="w-full p-3 text-xs leading-relaxed bg-[#151A22] border border-[#2A3340] rounded-[8px] text-[#ECE9E2] placeholder-[#98A2B0] focus:outline-none focus:border-[#C8A96A] transition resize-none font-sans"
              placeholder="Écrivez votre message..."
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-[#2A3340] flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] rounded-[8px] bg-[#151A22] hover:bg-[#2A3340] text-xs font-medium text-[#ECE9E2] border border-[#2A3340] transition cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleOpenWhatsApp}
            className="flex-1 min-h-[44px] rounded-[8px] bg-[#C8A96A] hover:bg-[#d6b777] text-xs font-semibold text-[#151A22] flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Ouvrir WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
};
