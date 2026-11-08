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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl text-slate-100 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Profil du Prêteur</h2>
              <p className="text-xs text-slate-400">Identité & Signature pour vos contrats</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto py-4 space-y-4 flex-1 text-xs pr-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {savedSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>Profil et signature enregistrés avec succès !</span>
            </div>
          )}

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-400 text-[11px] flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Vos coordonnées et votre signature dessinée restent strictement confidentielles sur votre appareil (100% hors ligne). Elles sont réutilisées automatiquement pour signer les contrats de prêt.
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Nom complet du prêteur <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Jean-Luc KABILA"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Téléphone <span className="text-rose-400">*</span>
              </label>
              <input
                type="tel"
                required
                placeholder="+243810000000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Ville de résidence <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Kinshasa"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Adresse complète <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ex: N° 45, Av. de la Paix, C/ Gombe"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Préavis de remboursement par défaut
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={defaultNoticeDays}
                  onChange={(e) => setDefaultNoticeDays(Number(e.target.value))}
                  className="w-24 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-amber-500"
                />
                <span className="text-xs text-slate-400">jours (7 jours par défaut)</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Juridiction compétente par défaut
              </label>
              <input
                type="text"
                value={defaultJurisdiction}
                onChange={(e) => setDefaultJurisdiction(e.target.value)}
                placeholder="Kinshasa"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Délai minimal de lecture avant signature
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="300"
                value={minReadingTimeSeconds}
                onChange={(e) => setMinReadingTimeSeconds(Math.max(0, Number(e.target.value)))}
                className="w-24 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-amber-500"
              />
              <span className="text-xs text-slate-400">secondes (20 s par défaut, 0 pour désactiver)</span>
            </div>
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
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition cursor-pointer shadow-lg shadow-amber-500/20"
            >
              Enregistrer mon profil de prêteur
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
