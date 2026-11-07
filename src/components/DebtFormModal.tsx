import React, { useState, useRef } from 'react';
import {
  X,
  Camera,
  Trash2,
  Calendar,
  User,
  Phone,
  FileText,
  DollarSign,
  Percent,
  Check,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { Debt, DebtType, Currency, InterestType } from '../types/debt';
import { compressImageFile } from '../utils/imageCompressor';
import { calculateInterest, formatCurrencyValue } from '../utils/debtCalculations';

interface DebtFormModalProps {
  initialDebt?: Debt | null;
  onSave: (debtData: Omit<Debt, 'id' | 'createdAt' | 'updatedAt' | 'repayments'> & { id?: string }) => Promise<void>;
  onClose: () => void;
}

export const DebtFormModal: React.FC<DebtFormModalProps> = ({ initialDebt, onSave, onClose }) => {
  const isEditing = !!initialDebt;

  // Form State
  const [type, setType] = useState<DebtType>(initialDebt?.type || 'on_me_doit');
  const [personName, setPersonName] = useState(initialDebt?.personName || '');
  const [phoneNumber, setPhoneNumber] = useState(initialDebt?.phoneNumber || '+243 ');
  const [reason, setReason] = useState(initialDebt?.reason || '');
  const [currency, setCurrency] = useState<Currency>(initialDebt?.currency || 'USD');
  const [initialAmount, setInitialAmount] = useState<string>(
    initialDebt?.initialAmount ? String(initialDebt.initialAmount) : ''
  );

  const todayStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(initialDebt?.startDate || todayStr);

  // Due date default to 30 days ahead if new debt
  const defaultDue = new Date();
  defaultDue.setDate(defaultDue.getDate() + 30);
  const defaultDueStr = defaultDue.toISOString().split('T')[0];
  const [dueDate, setDueDate] = useState(initialDebt?.dueDate || defaultDueStr);

  const [interestType, setInterestType] = useState<InterestType>(initialDebt?.interestType || 'none');
  const [interestRate, setInterestRate] = useState<string>(
    initialDebt?.interestRate !== undefined && initialDebt.interestRate !== null ? String(initialDebt.interestRate) : ''
  );
  const [interestFixedAmount, setInterestFixedAmount] = useState<string>(
    initialDebt?.interestFixedAmount !== undefined && initialDebt.interestFixedAmount !== null
      ? String(initialDebt.interestFixedAmount)
      : ''
  );

  const [proofPhoto, setProofPhoto] = useState<string | null>(initialDebt?.proofPhoto || null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle Photo selection and ~800px compression
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      setError(null);
      const compressedDataUrl = await compressImageFile(file, 800, 0.82);
      setProofPhoto(compressedDataUrl);
    } catch (err: any) {
      setError(err?.message || "Erreur lors de la compression de l'image.");
    } finally {
      setIsCompressing(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Preview calculations
  const parsedCapital = parseFloat(initialAmount) || 0;
  const parsedRate = parseFloat(interestRate) || 0;
  const parsedFixed = parseFloat(interestFixedAmount) || 0;

  const previewInterest = calculateInterest({
    initialAmount: parsedCapital,
    interestType,
    interestRate: parsedRate,
    interestFixedAmount: parsedFixed,
    currency,
    startDate,
  });

  const previewTotal = Math.round((parsedCapital + previewInterest.interestAmount) * 100) / 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!personName.trim()) {
      setError('Veuillez renseigner le nom de la personne.');
      return;
    }

    if (parsedCapital <= 0) {
      setError('Le montant doit être supérieur à 0.');
      return;
    }

    if (!startDate) {
      setError('Veuillez renseigner la date de début.');
      return;
    }

    if (!dueDate) {
      setError("Veuillez renseigner la date d'échéance.");
      return;
    }

    if (dueDate < startDate) {
      setError("La date d'échéance ne peut pas être antérieure à la date de début.");
      return;
    }

    if (interestType === 'percentage_once' || interestType === 'percentage_monthly') {
      if (parsedRate < 0) {
        setError("Le taux d'intérêt doit être positif ou nul.");
        return;
      }
    }

    if (interestType === 'fixed_amount') {
      if (parsedFixed < 0) {
        setError("Le montant d'intérêt fixe doit être positif ou nul.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await onSave({
        ...(initialDebt?.id ? { id: initialDebt.id } : {}),
        type,
        personName: personName.trim(),
        phoneNumber: phoneNumber.trim(),
        reason: reason.trim(),
        currency,
        initialAmount: parsedCapital,
        startDate,
        dueDate,
        interestType,
        interestRate:
          interestType === 'percentage_once' || interestType === 'percentage_monthly' ? parsedRate : undefined,
        interestFixedAmount: interestType === 'fixed_amount' ? parsedFixed : undefined,
        proofPhoto,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || "Erreur lors de l'enregistrement de la dette.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full max-w-xl rounded-t-3xl sm:rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl text-slate-100 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-white">
              {isEditing ? 'Modifier la dette' : 'Nouvelle dette / créance'}
            </h2>
            <p className="text-xs text-slate-400">Stockage 100% local sur votre appareil</p>
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

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto py-4 space-y-4 flex-1 pr-1">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Type Segmented Toggle: Je dois vs On me doit */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Type d'engagement</label>
            <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-950 border border-slate-800">
              <button
                type="button"
                onClick={() => setType('on_me_doit')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                  type === 'on_me_doit'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>On me doit (Créance)</span>
              </button>
              <button
                type="button"
                onClick={() => setType('je_dois')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                  type === 'je_dois'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Je dois (Dette)</span>
              </button>
            </div>
          </div>

          {/* Contact Details: Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Nom de la personne <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  placeholder="Ex: Jean Mukendi"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Téléphone (format international)
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+243 81 000 0000"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>
          </div>

          {/* Currency & Amount */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="block text-xs font-medium text-slate-300 mb-1">Devise</label>
              <div className="grid grid-cols-2 p-0.5 rounded-xl bg-slate-950 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                    currency === 'USD' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  USD ($)
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('FC')}
                  className={`py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                    currency === 'FC' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  FC
                </button>
              </div>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Capital initial <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <DollarSign className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={initialAmount}
                  onChange={(e) => setInitialAmount(e.target.value)}
                  placeholder={currency === 'USD' ? 'Ex: 150' : 'Ex: 100000'}
                  className="w-full pl-9 pr-12 py-2 text-sm font-semibold bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  {currency}
                </span>
              </div>
            </div>
          </div>

          {/* Reason / Free Note */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Motif / note libre</label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: Achat marchandises, avance caution, etc."
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition resize-none"
              />
            </div>
          </div>

          {/* Dates: Start & Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Date de début <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Date d'échéance <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>
          </div>

          {/* Interests Choice Section */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-amber-400" />
                Calcul des intérêts
              </label>
              <span className="text-[10px] text-slate-400">4 options au choix</span>
            </div>

            {/* Radio / button grid for interest types */}
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setInterestType('none')}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                  interestType === 'none'
                    ? 'bg-slate-800 border-slate-600 text-white font-medium'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300'
                }`}
              >
                <div className="font-semibold text-xs">1. Aucun</div>
                <div className="text-[10px] text-slate-400 mt-0.5">0 % intérêt</div>
              </button>

              <button
                type="button"
                onClick={() => setInterestType('percentage_once')}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                  interestType === 'percentage_once'
                    ? 'bg-slate-800 border-slate-600 text-white font-medium'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300'
                }`}
              >
                <div className="font-semibold text-xs">2. Pourcentage unique</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Appliqué une seule fois</div>
              </button>

              <button
                type="button"
                onClick={() => setInterestType('percentage_monthly')}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                  interestType === 'percentage_monthly'
                    ? 'bg-slate-800 border-slate-600 text-white font-medium'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300'
                }`}
              >
                <div className="font-semibold text-xs">3. Mensuel simple</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Par mois écoulé, sans comp.</div>
              </button>

              <button
                type="button"
                onClick={() => setInterestType('fixed_amount')}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                  interestType === 'fixed_amount'
                    ? 'bg-slate-800 border-slate-600 text-white font-medium'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300'
                }`}
              >
                <div className="font-semibold text-xs">4. Montant fixe</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Somme forfaitaire ajoutée</div>
              </button>
            </div>

            {/* Conditional input fields based on chosen interest */}
            {interestType === 'percentage_once' && (
              <div className="pt-2">
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Taux unique sur le capital (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    placeholder="Ex: 10 pour 10%"
                    className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-400"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                </div>
              </div>
            )}

            {interestType === 'percentage_monthly' && (
              <div className="pt-2 space-y-1">
                <label className="block text-[11px] font-medium text-slate-300">
                  Taux mensuel simple (% par mois)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    placeholder="Ex: 5 pour 5%/mois"
                    className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-400"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">% / mois</span>
                </div>
                <p className="text-[10px] text-slate-400 italic">
                  Sans composition. S'applique au capital initial pour chaque mois révolu depuis le début.
                </p>
              </div>
            )}

            {interestType === 'fixed_amount' && (
              <div className="pt-2">
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Montant fixe ajouté ({currency})
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={interestFixedAmount}
                    onChange={(e) => setInterestFixedAmount(e.target.value)}
                    placeholder={`Ex: ${currency === 'USD' ? '20' : '25000'}`}
                    className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-400"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    {currency}
                  </span>
                </div>
              </div>
            )}

            {/* Clear Financial Preview Breakdown */}
            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Capital initial :</span>
                <span className="font-medium text-slate-200">{formatCurrencyValue(parsedCapital, currency)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Intérêts ({previewInterest.formulaDescription}) :</span>
                <span className="font-medium text-amber-400">
                  +{formatCurrencyValue(previewInterest.interestAmount, currency)}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-800 font-bold text-white">
                <span>Total dû prévu :</span>
                <span className="text-emerald-400">{formatCurrencyValue(previewTotal, currency)}</span>
              </div>
            </div>
          </div>

          {/* Proof Photo Upload (~800px compressed) */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-slate-400" />
                Photo de preuve (reçu, contrat, échange)
              </label>
              <span className="text-[10px] text-slate-500">Compressée à ~800px</span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoSelect}
              className="hidden"
            />

            {proofPhoto ? (
              <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950 flex items-center justify-center max-h-48 group">
                <img src={proofPhoto} alt="Preuve" className="max-h-48 w-full object-contain" />
                <button
                  type="button"
                  onClick={() => setProofPhoto(null)}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-600 text-white shadow-md transition cursor-pointer"
                  title="Supprimer la photo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={isCompressing}
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 px-4 rounded-xl border border-dashed border-slate-700 hover:border-slate-500 bg-slate-900/50 hover:bg-slate-900 flex flex-col items-center justify-center gap-1.5 text-slate-400 hover:text-slate-200 transition cursor-pointer disabled:opacity-50"
              >
                <Camera className="w-5 h-5 text-slate-500" />
                <span className="text-xs font-medium">
                  {isCompressing ? 'Compression en cours (~800px)...' : 'Prendre une photo ou importer un reçu'}
                </span>
                <span className="text-[10px] text-slate-500">Optionnel · Optimisé pour le stockage local</span>
              </button>
            )}
          </div>
        </form>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-800 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || isCompressing}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 transition cursor-pointer disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>{isSubmitting ? 'Enregistrement...' : isEditing ? 'Mettre à jour' : 'Créer la dette'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
