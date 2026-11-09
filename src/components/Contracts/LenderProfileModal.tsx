import React, { useState } from 'react';
import { X, UserCheck, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { LenderProfile } from '../../types/contract';
import { getLenderProfile, saveLenderProfile } from '../../services/lenderProfile';
import { SignaturePad } from './SignaturePad';

interface LenderProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (profile: LenderProfile) => void;
}

export const LenderProfileModal: React.FC<LenderProfileModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const currentProfile = getLenderProfile();

  const [fullName, setFullName] = useState(currentProfile.fullName);
  const [address, setAddress] = useState(currentProfile.address);
  const [phone, setPhone] = useState(currentProfile.phone || '+243');
  const [city, setCity] = useState(currentProfile.city || 'Kinshasa');
  const [defaultNoticeDays, setDefaultNoticeDays] = useState(currentProfile.defaultNoticeDays || 7);
  const [defaultJurisdiction, setDefaultJurisdiction] = useState(currentProfile.defaultJurisdiction || 'Kinshasa');
  const [minReadingTimeSeconds, setMinReadingTimeSeconds] = useState(currentProfile.minReadingTimeSeconds ?? 20);
  const [shortLegalClausesEnabled, setShortLegalClausesEnabled] = useState(currentProfile.shortLegalClausesEnabled ?? false);
  const [signature, setSignature] = useState<string | null>(currentProfile.signature || null);
  const [error, setError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError('Veuillez renseigner votre nom complet de prêteur.');
      return;
    }
    if (!address.trim()) {
      setError('Veuillez renseigner votre adresse de résidence.');
      return;
    }
    if (!phone.trim() || phone.trim() === '+243') {
      setError('Veuillez renseigner votre numéro de téléphone.');
      return;
    }
    if (!signature) {
      setError('Veuillez dessiner votre signature officielle ci-dessous.');
      return;
    }

    const updated = saveLenderProfile({
      fullName: fullName.trim(),
      address: address.trim(),
      phone: phone.trim(),
      city: city.trim() || 'Kinshasa',
      defaultNoticeDays: Number(defaultNoticeDays) || 7,
      defaultJurisdiction: defaultJurisdiction.trim() || 'Kinshasa',
      minReadingTimeSeconds: Number(minReadingTimeSeconds) >= 0 ? Number(minReadingTimeSeconds) : 20,
      shortLegalClausesEnabled,
      signature,
    });

    setSavedSuccess(true);
    onSaved?.(updated);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full max-w-lg rounded-t-[16px] sm:rounded-[16px] bg-[#1C232D] border border-[#2A3340] p-4 sm:p-5 text-[#ECE9E2] max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2A3340]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[8px] bg-[#151A22] border border-[#2A3340] text-[#C8A96A] flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#ECE9E2]">Profil du prêteur</h2>
              <p className="text-xs text-[#98A2B0]">Identité et signature pour vos contrats</p>
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
        <form onSubmit={handleSubmit} className="overflow-y-auto py-4 space-y-4 flex-1 text-xs pr-1">
          {error && (
            <div className="p-3 rounded-[8px] bg-[#151A22] border border-[#E5604D] text-[#E5604D] font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#E5604D]" />
              <span>{error}</span>
            </div>
          )}

          {savedSuccess && (
            <div className="p-3 rounded-[8px] bg-[#151A22] border border-[#5FB48C] text-[#5FB48C] font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#5FB48C]" />
              <span>Profil et signature enregistrés avec succès.</span>
            </div>
          )}

          <div className="p-3 rounded-[8px] bg-[#151A22] border border-[#2A3340] text-[#98A2B0] text-xs flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-[#5FB48C] shrink-0 mt-0.5" />
            <span>
              Vos coordonnées et signature restent strictement confidentielles sur cet appareil (100% hors ligne). Elles sont réutilisées automatiquement pour signer les contrats.
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#ECE9E2]">
              Nom complet du prêteur <span className="text-[#E5604D]">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ex : Jean-Luc KABILA"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-[8px] bg-[#151A22] border border-[#2A3340] text-[#ECE9E2] placeholder-[#98A2B0] focus:outline-none focus:border-[#C8A96A] text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#ECE9E2]">
                Téléphone <span className="text-[#E5604D]">*</span>
              </label>
              <input
                type="tel"
                required
                placeholder="+243..."
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-[8px] bg-[#151A22] border border-[#2A3340] text-[#ECE9E2] placeholder-[#98A2B0] focus:outline-none focus:border-[#C8A96A] text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#ECE9E2]">
                Ville de résidence <span className="text-[#E5604D]">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Kinshasa"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-[8px] bg-[#151A22] border border-[#2A3340] text-[#ECE9E2] placeholder-[#98A2B0] focus:outline-none focus:border-[#C8A96A] text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#ECE9E2]">
              Adresse complète <span className="text-[#E5604D]">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ex : N° 45, Av. de la Paix, C/ Gombe"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-[8px] bg-[#151A22] border border-[#2A3340] text-[#ECE9E2] placeholder-[#98A2B0] focus:outline-none focus:border-[#C8A96A] text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#ECE9E2]">
                Préavis de remboursement par défaut
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={defaultNoticeDays}
                  onChange={(e) => setDefaultNoticeDays(Number(e.target.value))}
                  className="w-24 min-h-[44px] px-3 rounded-[8px] bg-[#151A22] border border-[#2A3340] text-[#ECE9E2] focus:outline-none focus:border-[#C8A96A] text-sm tabular-nums"
                />
                <span className="text-xs text-[#98A2B0]">jours (7 par défaut)</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#ECE9E2]">
                Juridiction compétente par défaut
              </label>
              <input
                type="text"
                value={defaultJurisdiction}
                onChange={(e) => setDefaultJurisdiction(e.target.value)}
                placeholder="Kinshasa"
                className="w-full min-h-[44px] px-3 rounded-[8px] bg-[#151A22] border border-[#2A3340] text-[#ECE9E2] focus:outline-none focus:border-[#C8A96A] text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#ECE9E2]">
              Délai minimal de lecture avant signature
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="300"
                value={minReadingTimeSeconds}
                onChange={(e) => setMinReadingTimeSeconds(Math.max(0, Number(e.target.value)))}
                className="w-24 min-h-[44px] px-3 rounded-[8px] bg-[#151A22] border border-[#2A3340] text-[#ECE9E2] focus:outline-none focus:border-[#C8A96A] text-sm tabular-nums"
              />
              <span className="text-xs text-[#98A2B0]">secondes (20 s par défaut, 0 pour désactiver)</span>
            </div>
          </div>

          <div className="p-3.5 rounded-[8px] bg-[#151A22] border border-[#2A3340] flex items-center justify-between">
            <div className="pr-2">
              <label htmlFor="short-legal-clauses" className="text-xs font-semibold text-[#ECE9E2] block cursor-pointer">
                Clauses juridiques courtes
              </label>
              <span className="text-xs text-[#98A2B0]">
                Mention du Code du numérique et compétence du tribunal (désactivé par défaut)
              </span>
            </div>
            <input
              type="checkbox"
              id="short-legal-clauses"
              checked={shortLegalClausesEnabled}
              onChange={(e) => setShortLegalClausesEnabled(e.target.checked)}
              className="w-4 h-4 rounded text-[#C8A96A] bg-[#1C232D] border-[#2A3340] focus:ring-[#C8A96A] cursor-pointer"
            />
          </div>

          {/* Signature dessinée */}
          <div className="pt-1">
            <SignaturePad
              label="Votre signature officielle de prêteur"
              subtitle="Dessinez votre signature au doigt ou au stylet. Elle sera enregistrée une seule fois."
              required
              initialSignature={signature}
              onSignatureChange={(url) => setSignature(url)}
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full min-h-[44px] rounded-[8px] bg-[#C8A96A] hover:bg-[#d6b777] text-[#151A22] font-semibold text-sm transition cursor-pointer"
            >
              Enregistrer le profil du prêteur
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
