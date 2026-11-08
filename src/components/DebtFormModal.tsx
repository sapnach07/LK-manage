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
  MapPin,
  Shield,
  FileSignature,
  Clock,
  UserCheck,
} from 'lucide-react';
import { Debt, DebtType, Currency, InterestType } from '../types/debt';
import { DeliveryMethod, BorrowerIdentity, LatePenalty, Witness } from '../types/contract';
import { compressImageFile } from '../utils/imageCompressor';
import { calculateInterest, formatCurrencyValue } from '../utils/debtCalculations';

interface DebtFormModalProps {
  initialDebt?: Debt | null;
  existingDebts?: Debt[];
  onSaveWithoutContract: (debtData: Omit<Debt, 'id' | 'createdAt' | 'updatedAt' | 'repayments'> & { id?: string }) => Promise<Debt | void>;
  onRequestReadAndSign: (params: {
    debtData: Omit<Debt, 'id' | 'createdAt' | 'updatedAt' | 'repayments'>;
    contractParams: {
      otherPartyAddress: string;
      deliveryMethods: DeliveryMethod[];
      hasDueDate: boolean;
      dueDate?: string;
      noticeDays?: number;
      latePenalty?: LatePenalty;
      witness?: Witness;
      borrowerIdentity?: BorrowerIdentity;
    };
  }) => Promise<void>;
  onClose: () => void;
  defaultToContractMode?: boolean;
}

export const DebtFormModal: React.FC<DebtFormModalProps> = ({
  initialDebt,
  existingDebts = [],
  onSaveWithoutContract,
  onRequestReadAndSign,
  onClose,
  defaultToContractMode = true,
}) => {
  const isEditing = !!initialDebt;

  // Base Debt Form State
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

  // Due date (optional or required based on hasDueDate)
  const [hasDueDate, setHasDueDate] = useState<boolean>(true);
  const defaultDue = new Date();
  defaultDue.setDate(defaultDue.getDate() + 30);
  const defaultDueStr = defaultDue.toISOString().split('T')[0];
  const [dueDate, setDueDate] = useState(initialDebt?.dueDate || defaultDueStr);
  const [noticeDays, setNoticeDays] = useState<number>(7);

  // Interest
  const [interestType, setInterestType] = useState<InterestType>(initialDebt?.interestType || 'none');
  const [interestRate, setInterestRate] = useState<string>(
    initialDebt?.interestRate !== undefined && initialDebt.interestRate !== null ? String(initialDebt.interestRate) : ''
  );
  const [interestFixedAmount, setInterestFixedAmount] = useState<string>(
    initialDebt?.interestFixedAmount !== undefined && initialDebt.interestFixedAmount !== null
      ? String(initialDebt.interestFixedAmount)
      : ''
  );

  // Interrupteur « Établir un contrat » (activé par défaut comme exigé)
  // If editing an existing debt, user cannot add contract (only at creation)
  const [wantsContract, setWantsContract] = useState<boolean>(!isEditing && defaultToContractMode);
  const [otherPartyAddress, setOtherPartyAddress] = useState<string>('');
  const [deliveryMethods, setDeliveryMethods] = useState<DeliveryMethod[]>(['especes']);

  // Late penalty (only if hasDueDate)
  const [latePenaltyEnabled, setLatePenaltyEnabled] = useState<boolean>(false);
  const [latePenaltyRate, setLatePenaltyRate] = useState<string>('2');
  const [latePenaltyPeriod, setLatePenaltyPeriod] = useState<'jour' | 'semaine' | 'mois'>('mois');

  // Witness
  const [witnessEnabled, setWitnessEnabled] = useState<boolean>(false);
  const [witnessFullName, setWitnessFullName] = useState<string>('');

  // Borrower official ID (option désactivée par défaut)
  const [borrowerIdEnabled, setBorrowerIdEnabled] = useState<boolean>(false);
  const [borrowerIdType, setBorrowerIdType] = useState<'carte_electeur' | 'passeport' | 'permis_conduire' | 'autre'>('carte_electeur');
  const [borrowerIdNumber, setBorrowerIdNumber] = useState<string>('');

  const [proofPhoto, setProofPhoto] = useState<string | null>(initialDebt?.proofPhoto || null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Duplicate debt warning dialog
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      setError(null);
      const compressedDataUrl = await compressImageFile(file, 800, 0.82);
      setProofPhoto(compressedDataUrl);
    } catch (err: unknown) {
      setError((err as Error)?.message || "Erreur lors de la compression de l'image.");
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const toggleDeliveryMethod = (method: DeliveryMethod) => {
    if (deliveryMethods.includes(method)) {
      if (deliveryMethods.length === 1) return; // Keep at least one
      setDeliveryMethods(deliveryMethods.filter((m) => m !== method));
    } else {
      setDeliveryMethods([...deliveryMethods, method]);
    }
  };

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

  const validateCommonFields = (): boolean => {
    if (!personName.trim()) {
      setError('Veuillez renseigner le nom complet de la personne.');
      return false;
    }
    if (parsedCapital <= 0) {
      setError('Le montant doit être supérieur à 0.');
      return false;
    }
    if (!startDate) {
      setError('Veuillez renseigner la date de début.');
      return false;
    }
    if (hasDueDate) {
      if (!dueDate) {
        setError("Veuillez renseigner la date d'échéance.");
        return false;
      }
      if (dueDate < startDate) {
        setError("La date d'échéance ne peut pas être antérieure à la date de début.");
        return false;
      }
    }
    return true;
  };

  const buildDebtPayload = () => {
    const effectiveDueDate = hasDueDate ? dueDate : defaultDueStr;
    return {
      type,
      personName: personName.trim(),
      phoneNumber: phoneNumber.trim(),
      reason: reason.trim() || (type === 'on_me_doit' ? 'Prêt d’argent' : 'Dette personnelle'),
      currency,
      initialAmount: parsedCapital,
      startDate,
      dueDate: effectiveDueDate,
      interestType,
      interestRate: (interestType === 'percentage_once' || interestType === 'percentage_monthly') ? parsedRate : undefined,
      interestFixedAmount: interestType === 'fixed_amount' ? parsedFixed : undefined,
      proofPhoto,
      isUnsigned: false,
    };
  };

  // Anti-doublon check: same name, same amount, same currency, same date
  const checkIsDuplicate = (): boolean => {
    return existingDebts.some((d) => {
      // Exclude self if editing
      if (isEditing && d.id === initialDebt?.id) return false;
      const sameName = d.personName.trim().toLowerCase() === personName.trim().toLowerCase();
      const sameAmount = Math.abs(d.initialAmount - parsedCapital) < 0.001;
      const sameCurrency = d.currency === currency;
      const sameDate = d.startDate === startDate;
      return sameName && sameAmount && sameCurrency && sameDate;
    });
  };

  // Execute standard save (without contract)
  const executeStandardSave = async () => {
    setIsSubmitting(true);
    try {
      const payload = buildDebtPayload();
      await onSaveWithoutContract(isEditing ? { ...payload, id: initialDebt.id } : payload);
      onClose();
    } catch (err: unknown) {
      setError((err as Error)?.message || "Erreur lors de l'enregistrement de la dette.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Execute read & sign flow
  const executeReadAndSign = async () => {
    if (!otherPartyAddress.trim()) {
      setError("Veuillez renseigner l'adresse de la personne pour établir le contrat officiel.");
      return;
    }

    if (witnessEnabled && !witnessFullName.trim()) {
      setError("Veuillez renseigner le nom complet du témoin.");
      return;
    }

    if (borrowerIdEnabled && !borrowerIdNumber.trim()) {
      setError("Veuillez saisir le numéro de la pièce d'identité.");
      return;
    }

    setIsSubmitting(true);
    try {
      const debtData = buildDebtPayload();
      await onRequestReadAndSign({
        debtData,
        contractParams: {
          otherPartyAddress: otherPartyAddress.trim(),
          deliveryMethods,
          hasDueDate,
          dueDate: hasDueDate ? dueDate : undefined,
          noticeDays: !hasDueDate ? noticeDays : undefined,
          latePenalty: hasDueDate && latePenaltyEnabled ? {
            enabled: true,
            rate: parseFloat(latePenaltyRate) || 2,
            period: latePenaltyPeriod,
          } : undefined,
          witness: witnessEnabled ? {
            enabled: true,
            fullName: witnessFullName.trim(),
          } : undefined,
          borrowerIdentity: borrowerIdEnabled ? {
            enabled: true,
            type: borrowerIdType,
            number: borrowerIdNumber.trim(),
          } : undefined,
        },
      });
      onClose();
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Erreur lors de la préparation du contrat.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Form submission handler
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validateCommonFields()) return;

    const actionToRun = wantsContract ? executeReadAndSign : executeStandardSave;

    // Check duplicate
    if (checkIsDuplicate()) {
      setPendingAction(() => actionToRun);
      setShowDuplicateWarning(true);
      return;
    }

    await actionToRun();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl text-slate-100 max-h-[92vh] flex flex-col relative">
        {/* Anti-doublon Warning Modal */}
        {showDuplicateWarning && (
          <div className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-sm flex items-center justify-center p-4 rounded-3xl sm:rounded-2xl">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-amber-500/40 p-5 shadow-2xl text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-white">Cette dette existe déjà</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Une dette portant sur le même montant ({parsedCapital.toLocaleString('fr-FR')} {currency}), le même nom ({personName}) et la même date ({startDate}) est déjà enregistrée.
                </p>
                <p className="text-xs font-semibold text-amber-400">
                  Continuer quand même ?
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowDuplicateWarning(false);
                    setPendingAction(null);
                  }}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition cursor-pointer"
                >
                  Annuler
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    setShowDuplicateWarning(false);
                    if (pendingAction) {
                      await pendingAction();
                    }
                  }}
                  className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer shadow-md shadow-amber-500/20"
                >
                  Continuer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              {isEditing ? 'Modifier la dette' : type === 'on_me_doit' ? 'Nouveau prêt / Créance' : 'Nouvelle dette'}
            </h2>
            <p className="text-xs text-slate-400">
              {type === 'on_me_doit'
                ? 'Prêt accordé à un tiers'
                : 'Somme empruntée à un tiers'}
            </p>
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
        <form onSubmit={handleFormSubmit} className="overflow-y-auto py-4 space-y-4 flex-1 text-xs pr-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Type selector */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-950 border border-slate-800">
            <button
              type="button"
              onClick={() => setType('on_me_doit')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                type === 'on_me_doit'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>On me doit (Prêt)</span>
            </button>
            <button
              type="button"
              onClick={() => setType('je_dois')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                type === 'je_dois'
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Je dois</span>
            </button>
          </div>

          {/* INTERRUPTEUR « ÉTABLIR UN CONTRAT » (Activé par défaut à la création) */}
          {!isEditing && (
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-amber-500/30 flex items-center justify-between shadow-inner">
              <div className="space-y-0.5 pr-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <FileSignature className="w-4 h-4 text-amber-400" />
                  Établir un contrat
                </span>
                <p className="text-[11px] text-slate-400">
                  {wantsContract
                    ? type === 'on_me_doit'
                      ? 'L’emprunteur lira et signera sur votre écran avant enregistrement'
                      : 'Le prêteur lira et signera sur votre écran, votre signature sera jointe'
                    : 'Enregistrement direct de la dette sans formalisme juridique'}
                </p>
              </div>

              {/* Toggle switch */}
              <button
                type="button"
                onClick={() => setWantsContract(!wantsContract)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  wantsContract ? 'bg-amber-500' : 'bg-slate-800'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    wantsContract ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          )}

          {/* Person details */}
          <div className="space-y-3 p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {type === 'on_me_doit' ? "Nom complet de l'emprunteur" : 'Nom complet du prêteur'}
                </span>
                <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Patrick MUKENDI"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>Téléphone (format international)</span>
              </label>
              <input
                type="tel"
                placeholder="+243810000000"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            {/* Address of the other party */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {type === 'on_me_doit' ? "Adresse de l'emprunteur" : 'Adresse du prêteur'}
                </span>
                {wantsContract && <span className="text-rose-400">*</span>}
              </label>
              <input
                type="text"
                placeholder="Ex: N° 12, Av. Kasavubu, C/ Bandalungwa, Kinshasa"
                value={otherPartyAddress}
                onChange={(e) => setOtherPartyAddress(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Amount and Currency */}
          <div className="space-y-3 p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                <span>Montant et Devise</span>
                <span className="text-rose-400">*</span>
              </label>
              <div className="flex gap-1 p-0.5 rounded-xl bg-slate-900 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    currency === 'USD' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  USD ($)
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('FC')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    currency === 'FC' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  FC
                </button>
              </div>
            </div>

            <div className="relative">
              <input
                type="number"
                step="any"
                min="0.01"
                required
                placeholder="0.00"
                value={initialAmount}
                onChange={(e) => setInitialAmount(e.target.value)}
                className="w-full pl-3 pr-14 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 font-semibold text-sm"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-xs text-amber-400">
                {currency === 'USD' ? '$ USD' : 'FC'}
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>Motif / Note</span>
              </label>
              <textarea
                rows={2}
                placeholder="Ex: Prêt personnel pour achat matériel"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>
          </div>

          {/* Dates & Repayment Mode */}
          <div className="space-y-3 p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Date de remise des fonds</span>
                <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Échéance ou non */}
            <div className="pt-1 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-200">
                  Fixer une date d'échéance
                </label>
                <input
                  type="checkbox"
                  checked={hasDueDate}
                  onChange={(e) => setHasDueDate(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700 cursor-pointer"
                />
              </div>

              {hasDueDate ? (
                <div className="space-y-1.5 pl-2 border-l-2 border-amber-500/30">
                  <span className="text-[11px] text-slate-400">Date d'échéance</span>
                  <input
                    type="date"
                    required={hasDueDate}
                    min={startDate}
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              ) : (
                <div className="space-y-1.5 pl-2 border-l-2 border-slate-700 text-[11px] text-slate-400">
                  <span>Remboursable sur demande avec un préavis de :</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="90"
                      value={noticeDays}
                      onChange={(e) => setNoticeDays(Number(e.target.value))}
                      className="w-20 px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 text-center"
                    />
                    <span>jours (7 jours par défaut)</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* CONTRACT CLAUSES (Displayed when wantsContract is enabled) */}
          {wantsContract && (
            <div className="space-y-3.5 p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <FileSignature className="w-4 h-4" />
                  Clauses du Contrat ({type === 'on_me_doit' ? 'Prêt accordé' : 'Dette je dois'})
                </span>
                <span className="text-[10px] text-slate-400">Sous seing privé</span>
              </div>

              {/* Mode de remise (plusieurs possibles) */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300 block">
                  Mode de remise des fonds (plusieurs possibles)
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggleDeliveryMethod('especes')}
                    className={`py-2 px-1 rounded-xl text-[11px] font-medium border text-center transition cursor-pointer ${
                      deliveryMethods.includes('especes')
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Espèces
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleDeliveryMethod('mobile_money')}
                    className={`py-2 px-1 rounded-xl text-[11px] font-medium border text-center transition cursor-pointer ${
                      deliveryMethods.includes('mobile_money')
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Mobile Money
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleDeliveryMethod('virement_bancaire')}
                    className={`py-2 px-1 rounded-xl text-[11px] font-medium border text-center transition cursor-pointer ${
                      deliveryMethods.includes('virement_bancaire')
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Virement
                  </button>
                </div>
              </div>

              {/* Pénalité de retard (uniquement si échéance) */}
              {hasDueDate && (
                <div className="space-y-2 pt-1 border-t border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-slate-300">
                      Pénalité de retard en cas de non-remboursement
                    </label>
                    <input
                      type="checkbox"
                      checked={latePenaltyEnabled}
                      onChange={(e) => setLatePenaltyEnabled(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700 cursor-pointer"
                    />
                  </div>

                  {latePenaltyEnabled && (
                    <div className="flex items-center gap-2 pl-2 border-l-2 border-amber-500/30 text-xs">
                      <span>Taux :</span>
                      <input
                        type="number"
                        step="any"
                        min="0.1"
                        value={latePenaltyRate}
                        onChange={(e) => setLatePenaltyRate(e.target.value)}
                        className="w-16 px-2 py-1 rounded bg-slate-950 border border-slate-800 text-slate-100 text-center"
                      />
                      <span>% par</span>
                      <select
                        value={latePenaltyPeriod}
                        onChange={(e) => setLatePenaltyPeriod(e.target.value as any)}
                        className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-slate-100"
                      >
                        <option value="jour">jour</option>
                        <option value="semaine">semaine</option>
                        <option value="mois">mois</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Témoin ou non */}
              <div className="space-y-2 pt-1 border-t border-slate-800/80">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Présence d'un témoin à la signature
                  </label>
                  <input
                    type="checkbox"
                    checked={witnessEnabled}
                    onChange={(e) => setWitnessEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700 cursor-pointer"
                  />
                </div>

                {witnessEnabled && (
                  <div className="pl-2 border-l-2 border-amber-500/30">
                    <input
                      type="text"
                      placeholder="Nom complet du témoin"
                      value={witnessFullName}
                      onChange={(e) => setWitnessFullName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Pièce d'identité (désactivée par défaut) */}
              <div className="space-y-2 pt-1 border-t border-slate-800/80">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block">
                      Pièce d'identité de l'autre partie
                    </label>
                    <span className="text-[10px] text-slate-500">Option désactivée par défaut</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={borrowerIdEnabled}
                    onChange={(e) => setBorrowerIdEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700 cursor-pointer"
                  />
                </div>

                {borrowerIdEnabled && (
                  <div className="space-y-2 pl-2 border-l-2 border-amber-500/30">
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={borrowerIdType}
                        onChange={(e) => setBorrowerIdType(e.target.value as any)}
                        className="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                      >
                        <option value="carte_electeur">Carte d'électeur</option>
                        <option value="passeport">Passeport</option>
                        <option value="permis_conduire">Permis de conduire</option>
                        <option value="autre">Autre document</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Numéro de la pièce"
                        value={borrowerIdNumber}
                        onChange={(e) => setBorrowerIdNumber(e.target.value)}
                        className="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Intérêts */}
          <div className="space-y-3 p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Percent className="w-3.5 h-3.5 text-slate-400" />
              <span>Modalités d'intérêts</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setInterestType('none')}
                className={`py-2 px-2.5 rounded-xl border text-center transition cursor-pointer ${
                  interestType === 'none'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                (1) Aucun
              </button>
              <button
                type="button"
                onClick={() => setInterestType('percentage_once')}
                className={`py-2 px-2.5 rounded-xl border text-center transition cursor-pointer ${
                  interestType === 'percentage_once'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                (2) % unique
              </button>
              <button
                type="button"
                onClick={() => setInterestType('percentage_monthly')}
                className={`py-2 px-2.5 rounded-xl border text-center transition cursor-pointer ${
                  interestType === 'percentage_monthly'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                (3) % mensuel simple
              </button>
            </div>

            {(interestType === 'percentage_once' || interestType === 'percentage_monthly') && (
              <div className="space-y-1 pl-2 border-l-2 border-amber-500">
                <span className="text-[11px] text-slate-400">Taux en pourcentage (%) :</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="Ex: 10 pour 10%"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none"
                />
              </div>
            )}

            {/* Calculations preview */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Capital :</span>
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

          {/* Proof Photo Upload */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-slate-400" />
                Photo de preuve (reçu, contrat physique)
              </label>
              <span className="text-[10px] text-slate-500">Compressée ~800px</span>
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
                  {isCompressing ? 'Compression (~800px)...' : 'Prendre une photo ou importer un reçu'}
                </span>
              </button>
            )}
          </div>
        </form>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-800 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition cursor-pointer"
          >
            Annuler
          </button>

          {/* MAIN ACTION BUTTON */}
          {wantsContract ? (
            /* Activé : « Lire et faire signer » */
            <button
              type="button"
              onClick={handleFormSubmit}
              disabled={isSubmitting || isCompressing}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 transition cursor-pointer disabled:opacity-50"
            >
              <FileSignature className="w-4 h-4" />
              <span>Lire et faire signer</span>
            </button>
          ) : (
            /* Désactivé : « Enregistrer » */
            <button
              type="button"
              onClick={handleFormSubmit}
              disabled={isSubmitting || isCompressing}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950 transition cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isEditing ? 'Mettre à jour' : 'Enregistrer'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
