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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4">
      <div className="w-full max-w-lg rounded-t-[16px] sm:rounded-[16px] bg-[#1C232D] border border-[#2A3340] p-5 text-[#ECE9E2] max-h-[92vh] flex flex-col relative">
        {/* Anti-doublon Warning Modal */}
        {showDuplicateWarning && (
          <div className="absolute inset-0 z-50 bg-[#151A22]/95 flex items-center justify-center p-4 rounded-t-[16px] sm:rounded-[16px]">
            <div className="w-full max-w-sm rounded-[16px] bg-[#1C232D] border border-[#2A3340] p-5 text-center space-y-4">
              <div className="w-11 h-11 rounded-[8px] bg-[#151A22] border border-[#2A3340] text-[#C8A96A] flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-semibold text-[#ECE9E2]">Cette dette existe déjà</h3>
                <p className="text-sm text-[#98A2B0] leading-relaxed">
                  Une dette portant sur le même montant ({parsedCapital.toLocaleString('fr-FR')} {currency}), le même nom ({personName}) et la même date ({startDate}) est déjà enregistrée.
                </p>
                <p className="text-sm font-medium text-[#C8A96A]">
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
                  className="min-h-[44px] py-2 px-3 rounded-[8px] bg-[#151A22] hover:bg-[#252F3D] text-[#ECE9E2] font-medium text-sm border border-[#2A3340] transition cursor-pointer"
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
                  className="min-h-[44px] py-2 px-3 rounded-[8px] bg-[#C8A96A] hover:bg-[#bfa05f] text-[#151A22] font-semibold text-sm transition cursor-pointer"
                >
                  Continuer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2A3340]">
          <div>
            <h2 className="text-base font-semibold text-[#ECE9E2] flex items-center gap-2">
              {isEditing ? 'Modifier la dette' : type === 'on_me_doit' ? 'Nouveau prêt / Créance' : 'Nouvelle dette'}
            </h2>
            <p className="text-xs text-[#98A2B0]">
              {type === 'on_me_doit'
                ? 'Prêt accordé à un tiers'
                : 'Somme empruntée à un tiers'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 rounded-[8px] text-[#98A2B0] hover:text-[#ECE9E2] hover:bg-[#151A22] flex items-center justify-center transition cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleFormSubmit} className="overflow-y-auto py-4 space-y-3 flex-1 text-xs pr-1">
          {error && (
            <div className="p-3 rounded-[8px] bg-[#151A22] border border-[#E5604D] text-[#E5604D] font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#E5604D]" />
              <span>{error}</span>
            </div>
          )}

          {/* Type selector */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-[8px] bg-[#151A22] border border-[#2A3340]">
            <button
              type="button"
              onClick={() => setType('on_me_doit')}
              className={`min-h-[44px] py-2 px-3 rounded-[6px] text-sm font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                type === 'on_me_doit'
                  ? 'bg-[#C8A96A] text-[#151A22]'
                  : 'text-[#98A2B0] hover:text-[#ECE9E2]'
              }`}
            >
              <span>On me doit (Prêt)</span>
            </button>
            <button
              type="button"
              onClick={() => setType('je_dois')}
              className={`min-h-[44px] py-2 px-3 rounded-[6px] text-sm font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                type === 'je_dois'
                  ? 'bg-[#1C232D] text-[#ECE9E2] border border-[#C8A96A]'
                  : 'text-[#98A2B0] hover:text-[#ECE9E2]'
              }`}
            >
              <span>Je dois</span>
            </button>
          </div>

          {/* INTERRUPTEUR « ÉTABLIR UN CONTRAT » (Activé par défaut à la création) */}
          {!isEditing && (
            <div className="p-3.5 rounded-[8px] bg-[#151A22] border border-[#2A3340] flex items-center justify-between">
              <div className="space-y-0.5 pr-2">
                <span className="text-sm font-semibold text-[#ECE9E2] flex items-center gap-2">
                  <FileSignature className="w-4 h-4 text-[#C8A96A]" />
                  Établir un contrat
                </span>
                <p className="text-xs text-[#98A2B0]">
                  {wantsContract
                    ? type === 'on_me_doit'
                      ? 'L’emprunteur lira et signera sur votre écran avant enregistrement'
                      : 'Le prêteur lira et signera sur votre écran, votre signature sera jointe'
                    : 'Enregistrement direct de la dette sans formalisme juridique'}
                </p>
              </div>

              {/* Toggle switch (44px touch) */}
              <button
                type="button"
                onClick={() => setWantsContract(!wantsContract)}
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none items-center ${
                  wantsContract ? 'bg-[#C8A96A]' : 'bg-[#2A3340]'
                }`}
                aria-label="Activer ou désactiver le contrat"
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full transition duration-200 ease-in-out ${
                    wantsContract ? 'translate-x-5 bg-[#151A22]' : 'translate-x-0.5 bg-[#98A2B0]'
                  }`}
                />
              </button>
            </div>
          )}

          {/* Person details */}
          {/* Person details */}
          <div className="space-y-3 p-3.5 rounded-[8px] bg-[#151A22] border border-[#2A3340]">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#98A2B0] flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#98A2B0]" />
                <span>
                  {type === 'on_me_doit' ? "Nom complet de l'emprunteur" : 'Nom complet du prêteur'}
                </span>
                <span className="text-[#E5604D]">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Patrick MUKENDI"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2.5 rounded-[8px] bg-[#1C232D] border border-[#2A3340] text-[#ECE9E2] placeholder-[#98A2B0] text-sm focus:outline-none focus:border-[#C8A96A]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#98A2B0] flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#98A2B0]" />
                <span>Téléphone (format international)</span>
              </label>
              <input
                type="tel"
                placeholder="+243810000000"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2.5 rounded-[8px] bg-[#1C232D] border border-[#2A3340] text-[#ECE9E2] placeholder-[#98A2B0] text-sm focus:outline-none focus:border-[#C8A96A] tabular-nums"
              />
            </div>

            {/* Address of the other party */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#98A2B0] flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#98A2B0]" />
                <span>
                  {type === 'on_me_doit' ? "Adresse de l'emprunteur" : 'Adresse du prêteur'}
                </span>
                {wantsContract && <span className="text-[#E5604D]">*</span>}
              </label>
              <input
                type="text"
                placeholder="Ex: N° 12, Av. Kasavubu, C/ Bandalungwa, Kinshasa"
                value={otherPartyAddress}
                onChange={(e) => setOtherPartyAddress(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2.5 rounded-[8px] bg-[#1C232D] border border-[#2A3340] text-[#ECE9E2] placeholder-[#98A2B0] text-sm focus:outline-none focus:border-[#C8A96A]"
              />
            </div>
          </div>

          {/* Amount and Currency */}
          <div className="space-y-3 p-3.5 rounded-[8px] bg-[#151A22] border border-[#2A3340]">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[#98A2B0] flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-[#98A2B0]" />
                <span>Montant et devise</span>
                <span className="text-[#E5604D]">*</span>
              </label>
              <div className="flex gap-1 p-0.5 rounded-[6px] bg-[#1C232D] border border-[#2A3340]">
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`min-h-[32px] px-3 py-1 rounded-[4px] text-xs font-semibold transition cursor-pointer ${
                    currency === 'USD' ? 'bg-[#C8A96A] text-[#151A22]' : 'text-[#98A2B0] hover:text-[#ECE9E2]'
                  }`}
                >
                  USD
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('FC')}
                  className={`min-h-[32px] px-3 py-1 rounded-[4px] text-xs font-semibold transition cursor-pointer ${
                    currency === 'FC' ? 'bg-[#C8A96A] text-[#151A22]' : 'text-[#98A2B0] hover:text-[#ECE9E2]'
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
                className="w-full min-h-[44px] pl-3 pr-16 py-2.5 rounded-[8px] bg-[#1C232D] border border-[#2A3340] text-[#ECE9E2] placeholder-[#98A2B0] focus:outline-none focus:border-[#C8A96A] font-semibold text-base tabular-nums"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-semibold text-xs text-[#98A2B0]">
                {currency}
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#98A2B0] flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#98A2B0]" />
                <span>Motif / Note</span>
              </label>
              <textarea
                rows={2}
                placeholder="Ex: Prêt personnel pour achat matériel"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 rounded-[8px] bg-[#1C232D] border border-[#2A3340] text-[#ECE9E2] placeholder-[#98A2B0] text-sm focus:outline-none focus:border-[#C8A96A] resize-none"
              />
            </div>
          </div>

          {/* Dates & Repayment Mode */}
          <div className="space-y-3 p-3.5 rounded-[8px] bg-[#151A22] border border-[#2A3340]">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#98A2B0] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#98A2B0]" />
                <span>Date de remise des fonds</span>
                <span className="text-[#E5604D]">*</span>
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 rounded-[8px] bg-[#1C232D] border border-[#2A3340] text-[#ECE9E2] text-sm focus:outline-none focus:border-[#C8A96A]"
              />
            </div>

            {/* Échéance ou non */}
            <div className="pt-1 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-[#ECE9E2]">
                  Fixer une date d'échéance
                </label>
                <input
                  type="checkbox"
                  checked={hasDueDate}
                  onChange={(e) => setHasDueDate(e.target.checked)}
                  className="w-5 h-5 rounded-[4px] text-[#C8A96A] bg-[#1C232D] border-[#2A3340] cursor-pointer"
                />
              </div>

              {hasDueDate ? (
                <div className="space-y-1.5 pl-2 border-l-2 border-[#2A3340]">
                  <span className="text-xs text-[#98A2B0]">Date d'échéance</span>
                  <input
                    type="date"
                    required={hasDueDate}
                    min={startDate}
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-[8px] bg-[#1C232D] border border-[#2A3340] text-[#ECE9E2] text-sm focus:outline-none focus:border-[#C8A96A]"
                  />
                </div>
              ) : (
                <div className="space-y-1.5 pl-2 border-l-2 border-[#2A3340] text-xs text-[#98A2B0]">
                  <span>Remboursable sur demande avec un préavis de :</span>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      min="1"
                      max="90"
                      value={noticeDays}
                      onChange={(e) => setNoticeDays(Number(e.target.value))}
                      className="w-20 min-h-[36px] px-2 py-1.5 rounded-[6px] bg-[#1C232D] border border-[#2A3340] text-[#ECE9E2] text-center text-sm tabular-nums"
                    />
                    <span>jours (7 jours par défaut)</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* CONTRACT CLAUSES (Displayed when wantsContract is enabled) */}
          {/* CONTRACT CLAUSES (Displayed when wantsContract is enabled) */}
          {wantsContract && (
            <div className="space-y-3.5 p-3.5 rounded-[8px] bg-[#151A22] border border-[#2A3340]">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[#ECE9E2] flex items-center gap-1.5">
                  <FileSignature className="w-4 h-4 text-[#C8A96A]" />
                  Clauses du contrat
                </span>
                <span className="text-xs text-[#98A2B0]">Sous seing privé</span>
              </div>

              {/* Mode de remise (plusieurs possibles) */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#98A2B0] block">
                  Mode de remise des fonds (plusieurs possibles)
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggleDeliveryMethod('especes')}
                    className={`min-h-[40px] py-2 px-1 rounded-[6px] text-xs font-medium border text-center transition cursor-pointer ${
                      deliveryMethods.includes('especes')
                        ? 'bg-[#1C232D] border-[#C8A96A] text-[#ECE9E2] font-semibold'
                        : 'bg-[#151A22] border-[#2A3340] text-[#98A2B0] hover:text-[#ECE9E2]'
                    }`}
                  >
                    Espèces
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleDeliveryMethod('mobile_money')}
                    className={`min-h-[40px] py-2 px-1 rounded-[6px] text-xs font-medium border text-center transition cursor-pointer ${
                      deliveryMethods.includes('mobile_money')
                        ? 'bg-[#1C232D] border-[#C8A96A] text-[#ECE9E2] font-semibold'
                        : 'bg-[#151A22] border-[#2A3340] text-[#98A2B0] hover:text-[#ECE9E2]'
                    }`}
                  >
                    Mobile money
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleDeliveryMethod('virement_bancaire')}
                    className={`min-h-[40px] py-2 px-1 rounded-[6px] text-xs font-medium border text-center transition cursor-pointer ${
                      deliveryMethods.includes('virement_bancaire')
                        ? 'bg-[#1C232D] border-[#C8A96A] text-[#ECE9E2] font-semibold'
                        : 'bg-[#151A22] border-[#2A3340] text-[#98A2B0] hover:text-[#ECE9E2]'
                    }`}
                  >
                    Virement
                  </button>
                </div>
              </div>

              {/* Pénalité de retard (uniquement si échéance) */}
              {hasDueDate && (
                <div className="space-y-2 pt-2 border-t border-[#2A3340]">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-[#ECE9E2]">
                      Pénalité de retard en cas de non-remboursement
                    </label>
                    <input
                      type="checkbox"
                      checked={latePenaltyEnabled}
                      onChange={(e) => setLatePenaltyEnabled(e.target.checked)}
                      className="w-5 h-5 rounded-[4px] text-[#C8A96A] bg-[#1C232D] border-[#2A3340] cursor-pointer"
                    />
                  </div>

                  {latePenaltyEnabled && (
                    <div className="flex items-center gap-2 pl-2 border-l-2 border-[#2A3340] text-xs text-[#98A2B0]">
                      <span>Taux :</span>
                      <input
                        type="number"
                        step="any"
                        min="0.1"
                        value={latePenaltyRate}
                        onChange={(e) => setLatePenaltyRate(e.target.value)}
                        className="w-16 min-h-[36px] px-2 py-1 rounded-[6px] bg-[#1C232D] border border-[#2A3340] text-[#ECE9E2] text-center text-sm tabular-nums"
                      />
                      <span>% par</span>
                      <select
                        value={latePenaltyPeriod}
                        onChange={(e) => setLatePenaltyPeriod(e.target.value as any)}
                        className="min-h-[36px] px-2 py-1 rounded-[6px] bg-[#1C232D] border border-[#2A3340] text-[#ECE9E2] text-xs"
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
              <div className="space-y-2 pt-2 border-t border-[#2A3340]">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-[#ECE9E2]">
                    Présence d'un témoin à la signature
                  </label>
                  <input
                    type="checkbox"
                    checked={witnessEnabled}
                    onChange={(e) => setWitnessEnabled(e.target.checked)}
                    className="w-5 h-5 rounded-[4px] text-[#C8A96A] bg-[#1C232D] border-[#2A3340] cursor-pointer"
                  />
                </div>

                {witnessEnabled && (
                  <div className="pl-2 border-l-2 border-[#2A3340]">
                    <input
                      type="text"
                      placeholder="Nom complet du témoin"
                      value={witnessFullName}
                      onChange={(e) => setWitnessFullName(e.target.value)}
                      className="w-full min-h-[44px] px-3 py-2 rounded-[8px] bg-[#1C232D] border border-[#2A3340] text-[#ECE9E2] placeholder-[#98A2B0] text-sm focus:outline-none focus:border-[#C8A96A]"
                    />
                  </div>
                )}
              </div>

              {/* Pièce d'identité (désactivée par défaut) */}
              <div className="space-y-2 pt-2 border-t border-[#2A3340]">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-medium text-[#ECE9E2] block">
                      Pièce d'identité de l'autre partie
                    </label>
                    <span className="text-xs text-[#98A2B0]">Option désactivée par défaut</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={borrowerIdEnabled}
                    onChange={(e) => setBorrowerIdEnabled(e.target.checked)}
                    className="w-5 h-5 rounded-[4px] text-[#C8A96A] bg-[#1C232D] border-[#2A3340] cursor-pointer"
                  />
                </div>

                {borrowerIdEnabled && (
                  <div className="space-y-2 pl-2 border-l-2 border-[#2A3340]">
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={borrowerIdType}
                        onChange={(e) => setBorrowerIdType(e.target.value as any)}
                        className="min-h-[44px] px-2.5 py-2 rounded-[8px] bg-[#1C232D] border border-[#2A3340] text-[#ECE9E2] text-xs"
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
                        className="min-h-[44px] px-2.5 py-2 rounded-[8px] bg-[#1C232D] border border-[#2A3340] text-[#ECE9E2] placeholder-[#98A2B0] text-sm focus:outline-none focus:border-[#C8A96A]"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Intérêts */}
          <div className="space-y-3 p-3.5 rounded-[8px] bg-[#151A22] border border-[#2A3340]">
            <label className="text-xs font-medium text-[#98A2B0] flex items-center gap-1.5">
              <Percent className="w-3.5 h-3.5 text-[#98A2B0]" />
              <span>Modalités d'intérêts</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setInterestType('none')}
                className={`min-h-[44px] py-2 px-2.5 rounded-[8px] border text-center transition cursor-pointer text-xs ${
                  interestType === 'none'
                    ? 'bg-[#1C232D] border-[#C8A96A] text-[#ECE9E2] font-semibold'
                    : 'bg-[#151A22] border-[#2A3340] text-[#98A2B0] hover:text-[#ECE9E2]'
                }`}
              >
                Aucun intérêt
              </button>
              <button
                type="button"
                onClick={() => setInterestType('percentage_once')}
                className={`min-h-[44px] py-2 px-2.5 rounded-[8px] border text-center transition cursor-pointer text-xs ${
                  interestType === 'percentage_once'
                    ? 'bg-[#1C232D] border-[#C8A96A] text-[#ECE9E2] font-semibold'
                    : 'bg-[#151A22] border-[#2A3340] text-[#98A2B0] hover:text-[#ECE9E2]'
                }`}
              >
                Pourcentage unique
              </button>
              <button
                type="button"
                onClick={() => setInterestType('percentage_monthly')}
                className={`min-h-[44px] py-2 px-2.5 rounded-[8px] border text-center transition cursor-pointer text-xs ${
                  interestType === 'percentage_monthly'
                    ? 'bg-[#1C232D] border-[#C8A96A] text-[#ECE9E2] font-semibold'
                    : 'bg-[#151A22] border-[#2A3340] text-[#98A2B0] hover:text-[#ECE9E2]'
                }`}
              >
                Pourcentage mensuel
              </button>
            </div>

            {(interestType === 'percentage_once' || interestType === 'percentage_monthly') && (
              <div className="space-y-1.5 pl-2 border-l-2 border-[#2A3340]">
                <span className="text-xs text-[#98A2B0]">Taux en pourcentage (%) :</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="Ex: 10 pour 10%"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-[8px] bg-[#1C232D] border border-[#2A3340] text-[#ECE9E2] placeholder-[#98A2B0] text-sm focus:outline-none focus:border-[#C8A96A] tabular-nums"
                />
              </div>
            )}

            {/* Calculations preview */}
            <div className="p-3 rounded-[8px] bg-[#1C232D] border border-[#2A3340] text-xs space-y-1.5">
              <div className="flex justify-between text-[#98A2B0]">
                <span>Capital :</span>
                <span className="font-medium text-[#ECE9E2] tabular-nums">{formatCurrencyValue(parsedCapital, currency)}</span>
              </div>
              <div className="flex justify-between text-[#98A2B0]">
                <span>Intérêts ({previewInterest.formulaDescription}) :</span>
                <span className="font-medium text-[#C8A96A] tabular-nums">
                  +{formatCurrencyValue(previewInterest.interestAmount, currency)}
                </span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-[#2A3340] font-semibold text-[#ECE9E2] text-sm">
                <span>Total dû prévu :</span>
                <span className="text-[#5FB48C] tabular-nums">{formatCurrencyValue(previewTotal, currency)}</span>
              </div>
            </div>
          </div>

          {/* Proof Photo Upload */}
          <div className="p-3.5 rounded-[8px] bg-[#151A22] border border-[#2A3340] space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[#ECE9E2] flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-[#98A2B0]" />
                Photo de preuve (reçu, contrat physique)
              </label>
              <span className="text-xs text-[#98A2B0]">Compressée ~800px</span>
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
              <div className="relative rounded-[8px] overflow-hidden border border-[#2A3340] bg-[#151A22] flex items-center justify-center max-h-48 group">
                <img src={proofPhoto} alt="Preuve" className="max-h-48 w-full object-contain" />
                <button
                  type="button"
                  onClick={() => setProofPhoto(null)}
                  className="absolute top-2 right-2 w-11 h-11 rounded-[8px] bg-[#E5604D] hover:bg-rose-600 text-white flex items-center justify-center transition cursor-pointer"
                  title="Supprimer la photo"
                  aria-label="Supprimer photo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={isCompressing}
                onClick={() => fileInputRef.current?.click()}
                className="w-full min-h-[48px] py-3 px-4 rounded-[8px] border border-dashed border-[#2A3340] hover:border-[#98A2B0] bg-[#1C232D] flex flex-col items-center justify-center gap-1.5 text-[#98A2B0] hover:text-[#ECE9E2] transition cursor-pointer disabled:opacity-50"
              >
                <Camera className="w-5 h-5 text-[#98A2B0]" />
                <span className="text-xs font-medium">
                  {isCompressing ? 'Compression (~800px)...' : 'Prendre une photo ou importer un reçu'}
                </span>
              </button>
            )}
          </div>
        </form>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-[#2A3340] flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] py-2.5 px-4 rounded-[8px] bg-[#151A22] hover:bg-[#252F3D] text-sm font-medium text-[#98A2B0] hover:text-[#ECE9E2] border border-[#2A3340] transition cursor-pointer"
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
              className="flex-1 min-h-[44px] py-2.5 px-4 rounded-[8px] bg-[#C8A96A] hover:bg-[#bfa05f] active:bg-[#b29454] text-[#151A22] text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              <FileSignature className="w-4 h-4" />
              <span>Lire et faire signer</span>
            </button>
          ) : (
            /* Désactivé : « Enregistrer la dette » */
            <button
              type="button"
              onClick={handleFormSubmit}
              disabled={isSubmitting || isCompressing}
              className="flex-1 min-h-[44px] py-2.5 px-4 rounded-[8px] bg-[#C8A96A] hover:bg-[#bfa05f] active:bg-[#b29454] text-[#151A22] text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isEditing ? 'Mettre à jour la dette' : 'Enregistrer la dette'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
