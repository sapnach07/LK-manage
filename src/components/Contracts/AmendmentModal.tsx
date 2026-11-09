import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Plus,
  Lock,
  Share2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  PenTool,
} from 'lucide-react';
import { Contract, Amendment } from '../../types/contract';
import { Debt } from '../../types/debt';
import { buildAmendmentFullText, computeSha256Digest } from '../../utils/contractGenerator';
import { generateAmendmentPdf, shareOrDownloadContractPdf } from '../../utils/pdfGenerator';
import { addAmendmentToContract, saveDebt } from '../../services/db';
import { formatAmountInWords } from '../../utils/numberToWords';
import { SignaturePad } from './SignaturePad';
import { getLenderProfile } from '../../services/lenderProfile';

interface AmendmentModalProps {
  contract: Contract;
  debt?: Debt | null;
  onClose: () => void;
  onAmendmentCreated: (updatedContract: Contract, updatedDebt?: Debt) => void;
}

export const AmendmentModal: React.FC<AmendmentModalProps> = ({
  contract,
  debt,
  onClose,
  onAmendmentCreated,
}) => {
  const nextAmendmentNumber = (contract.amendments?.length || 0) + 1;

  const [step, setStep] = useState<'form' | 'reading' | 'signing' | 'success'>('form');
  const [addedAmount, setAddedAmount] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const lenderProfile = useMemo(() => getLenderProfile(), []);
  const minSeconds = lenderProfile.minReadingTimeSeconds !== undefined ? lenderProfile.minReadingTimeSeconds : 20;

  const [secondsRemaining, setSecondsRemaining] = useState<number>(minSeconds);
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState<boolean>(false);
  const [readCompletedAt, setReadCompletedAt] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [amendmentText, setAmendmentText] = useState<string>('');
  const [hasAccepted, setHasAccepted] = useState(false);
  const [borrowerSignature, setBorrowerSignature] = useState<string | null>(null);
  const [witnessSignature, setWitnessSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [finalAmendment, setFinalAmendment] = useState<Amendment | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const numAdded = parseFloat(addedAmount) || 0;
  const currentTotal = contract.principalAmount;
  const newTotal = currentTotal + numAdded;
  const currencyLabel = contract.currency === 'USD' ? 'USD' : 'FC';

  const handleProceedToReading = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (numAdded <= 0) {
      setError('Veuillez saisir un montant supplémentaire valide supérieur à zéro.');
      return;
    }
    if (!reason.trim()) {
      setError("Veuillez préciser le motif de cet ajout d'argent.");
      return;
    }

    const now = new Date();
    const signedAtFormatted = now.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const text = buildAmendmentFullText({
      contract,
      amendmentNumber: nextAmendmentNumber,
      addedAmount: numAdded,
      reason: reason.trim(),
      date,
      signedAt: signedAtFormatted,
      newPrincipalTotal: newTotal,
    });

    setAmendmentText(text);
    setSecondsRemaining(minSeconds);
    setScrollProgress(0);
    setHasScrolledToEnd(false);
    setStep('reading');
  };

  useEffect(() => {
    if (step !== 'reading') return;
    if (secondsRemaining <= 0) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [step, secondsRemaining]);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    const maxScroll = scrollHeight - clientHeight;

    if (maxScroll <= 0) {
      setScrollProgress(100);
      setHasScrolledToEnd(true);
      return;
    }

    const progress = Math.min(100, Math.round((scrollTop / maxScroll) * 100));
    setScrollProgress(progress);

    if (scrollTop + clientHeight >= scrollHeight - 25 || progress >= 98) {
      setHasScrolledToEnd(true);
    }
  };

  useEffect(() => {
    if (step === 'reading') {
      const timer = setTimeout(() => {
        handleScroll();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const isReadingComplete = hasScrolledToEnd && secondsRemaining === 0;

  const handleFinishReading = () => {
    if (!isReadingComplete) return;

    const now = new Date();
    const timestamp = now.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    setReadCompletedAt(timestamp);
    setError(null);
    setStep('signing');
  };

  const handleReviewAmendment = () => {
    setBorrowerSignature(null);
    setWitnessSignature(null);
    setHasAccepted(false);
    setError(null);
    setStep('reading');
  };

  const handleSignAndLockAmendment = async () => {
    setError(null);

    if (!hasAccepted) {
      setError("L'emprunteur doit accepter l'ensemble des termes de l'avenant.");
      return;
    }

    if (!borrowerSignature) {
      setError("L'emprunteur doit apposer sa signature électronique au doigt.");
      return;
    }

    if (contract.witness?.enabled && !witnessSignature) {
      setError(`Le témoin (${contract.witness.fullName}) doit également apposer sa signature.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const digest = await computeSha256Digest(amendmentText);
      const now = new Date();
      const signedAtFormatted = now.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const amendment: Amendment = {
        id: 'amend_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        contractId: contract.id,
        amendmentNumber: nextAmendmentNumber,
        addedAmount: numAdded,
        reason: reason.trim(),
        date,
        signedAt: signedAtFormatted,
        readCompletedAt: readCompletedAt || signedAtFormatted,
        newPrincipalTotal: newTotal,
        templateVersion: 'v2',
        contentDigest: digest,
        amendmentText,
        borrowerSignature,
        lenderSignature: contract.lenderSignature,
        witnessSignature: witnessSignature || undefined,
      };

      const updatedContract = await addAmendmentToContract(contract.id, amendment);

      let updatedDebt: Debt | undefined = undefined;
      if (debt) {
        updatedDebt = {
          ...debt,
          initialAmount: newTotal,
          reason: `${debt.reason} [Avenant n°${nextAmendmentNumber}: +${numAdded} ${currencyLabel}]`,
          updatedAt: Date.now(),
        };
        await saveDebt(updatedDebt);
      }

      setFinalAmendment(amendment);
      setStep('success');
      onAmendmentCreated(updatedContract, updatedDebt);
    } catch (err: unknown) {
      setError((err as Error)?.message || "Erreur lors de l'enregistrement de l'avenant.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSharePdf = async () => {
    if (!finalAmendment) return;
    const doc = generateAmendmentPdf(contract, finalAmendment);
    const filename = `avenant-${finalAmendment.amendmentNumber}-contrat-${contract.contractNumber}.pdf`;
    const title = `Avenant n°${finalAmendment.amendmentNumber} au contrat ${contract.contractNumber}`;

    const res = await shareOrDownloadContractPdf(doc, filename, title);
    if (res === 'shared') {
      setShareFeedback('Avenant PDF partagé avec succès.');
    } else {
      setShareFeedback('Avenant PDF téléchargé sur votre appareil.');
    }
    setTimeout(() => setShareFeedback(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xs p-0 sm:p-3">
      <div className="w-full h-full sm:h-[94vh] max-w-2xl rounded-t-[16px] sm:rounded-[16px] bg-[#1C232D] border border-[#2A3340] p-4 sm:p-5 text-[#ECE9E2] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2A3340] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[8px] bg-[#151A22] border border-[#2A3340] text-[#C8A96A] flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-[#ECE9E2]">
                  Avenant n°{nextAmendmentNumber} au contrat {contract.contractNumber}
                </h2>
                {step !== 'success' && step !== 'form' && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-[4px] bg-[#151A22] text-[#C8A96A] border border-[#2A3340]">
                    {step === 'reading' ? 'Étape 1 : Lecture' : 'Étape 2 : Signature'}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#98A2B0]">
                {step === 'form'
                  ? "Saisie des fonds supplémentaires remis à l'emprunteur"
                  : step === 'reading'
                  ? "Lecture intégrale de l'avenant par l'emprunteur"
                  : step === 'signing'
                  ? 'Approbation et signatures'
                  : 'Horodaté et certifié conforme'}
              </p>
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

        {error && (
          <div className="mt-3 p-3 rounded-[8px] bg-[#151A22] border border-[#E5604D] text-[#E5604D] text-xs font-medium flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#E5604D]" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: FORM TO ENTER AMOUNT AND REASON */}
        {step === 'form' && (
          <form onSubmit={handleProceedToReading} className="overflow-y-auto py-4 space-y-4 flex-1 text-xs pr-1">
            <div className="p-3.5 rounded-[8px] bg-[#151A22] border border-[#2A3340] flex justify-between items-center">
              <div>
                <span className="text-[#98A2B0] text-xs">Emprunteur</span>
                <p className="font-semibold text-[#ECE9E2] text-sm">{contract.borrower.fullName}</p>
              </div>
              <div className="text-right">
                <span className="text-[#98A2B0] text-xs">Capital actuel</span>
                <p className="font-semibold text-[#ECE9E2] text-sm tabular-nums">
                  {currentTotal.toLocaleString('fr-FR')} {currencyLabel}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#ECE9E2]">
                Somme supplémentaire remise <span className="text-[#E5604D]">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  placeholder="0"
                  value={addedAmount}
                  onChange={(e) => setAddedAmount(e.target.value)}
                  className="w-full min-h-[44px] pl-3 pr-14 rounded-[8px] bg-[#151A22] border border-[#2A3340] text-[#ECE9E2] placeholder-[#98A2B0] focus:outline-none focus:border-[#C8A96A] text-sm font-semibold tabular-nums"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#98A2B0]">
                  {currencyLabel}
                </span>
              </div>
              {numAdded > 0 && (
                <p className="text-xs text-[#98A2B0] italic">
                  En toutes lettres : {formatAmountInWords(numAdded, contract.currency)}
                </p>
              )}
            </div>

            <div className="p-3.5 rounded-[8px] bg-[#151A22] border border-[#2A3340] flex justify-between items-center text-xs">
              <span className="text-[#98A2B0] font-medium">Nouveau total du capital dû :</span>
              <span className="font-semibold text-[#5FB48C] text-base tabular-nums">
                {newTotal.toLocaleString('fr-FR')} {currencyLabel}
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#ECE9E2]">
                Motif du prêt supplémentaire <span className="text-[#E5604D]">*</span>
              </label>
              <textarea
                required
                rows={2}
                placeholder="Ex : Réapprovisionnement de stock, frais de santé..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full p-3 rounded-[8px] bg-[#151A22] border border-[#2A3340] text-[#ECE9E2] placeholder-[#98A2B0] focus:outline-none focus:border-[#C8A96A] resize-none text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#ECE9E2]">
                Date de remise des fonds <span className="text-[#E5604D]">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-[8px] bg-[#151A22] border border-[#2A3340] text-[#ECE9E2] focus:outline-none focus:border-[#C8A96A]"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full min-h-[44px] rounded-[8px] bg-[#C8A96A] hover:bg-[#d6b777] text-[#151A22] font-semibold transition cursor-pointer text-sm flex items-center justify-center gap-2"
              >
                <span>Passer à la lecture de l'avenant</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* ÉTAPE 1 : LECTURE PLEIN ÉCRAN */}
        {step === 'reading' && (
          <div className="flex-1 flex flex-col overflow-hidden py-3 space-y-3">
            {/* Progress and Timer Bar */}
            <div className="space-y-1.5 shrink-0">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-[#ECE9E2] font-medium">
                  <BookOpen className="w-3.5 h-3.5 text-[#C8A96A]" />
                  <span>Progression de la lecture de l'avenant</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-[#C8A96A] tabular-nums">{scrollProgress}% lu</span>
                  {secondsRemaining > 0 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-[#151A22] border border-[#2A3340] text-[#C8A96A] text-xs font-mono">
                      <Clock className="w-3 h-3" />
                      <span>{secondsRemaining}s restantes</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-[#151A22] border border-[#5FB48C] text-[#5FB48C] text-xs font-medium">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Temps validé</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Progress bar line */}
              <div className="w-full h-1.5 rounded-full bg-[#151A22] border border-[#2A3340] overflow-hidden">
                <div
                  className="h-full bg-[#C8A96A] transition-all duration-150"
                  style={{ width: `${scrollProgress}%` }}
                />
              </div>

              {/* Helper guidance */}
              <div className="flex items-center justify-between text-xs text-[#98A2B0] pt-0.5">
                <span>
                  {!hasScrolledToEnd
                    ? 'Défilez jusqu’au bas du texte pour débloquer la validation'
                    : 'Bas de l’avenant atteint'}
                </span>
                {secondsRemaining > 0 && (
                  <span className="text-[#C8A96A]">
                    Délai minimal : {minSeconds}s
                  </span>
                )}
              </div>
            </div>

            {/* Scrollable Text */}
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 p-4 sm:p-5 rounded-[8px] bg-[#151A22] border border-[#2A3340] overflow-y-auto whitespace-pre-line font-serif text-[13px] sm:text-[14px] leading-relaxed text-[#ECE9E2] select-text"
            >
              {amendmentText}
            </div>

            {/* Step 1 Actions */}
            <div className="pt-1 shrink-0 space-y-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep('form')}
                  className="min-h-[44px] px-4 rounded-[8px] bg-[#151A22] hover:bg-[#2A3340] text-[#ECE9E2] border border-[#2A3340] font-medium transition cursor-pointer text-xs"
                >
                  Modifier montant
                </button>

                <button
                  type="button"
                  disabled={!isReadingComplete}
                  onClick={handleFinishReading}
                  className={`flex-1 min-h-[44px] px-4 rounded-[8px] font-semibold transition flex items-center justify-center gap-2 text-sm ${
                    isReadingComplete
                      ? 'bg-[#C8A96A] hover:bg-[#d6b777] text-[#151A22] cursor-pointer'
                      : 'bg-[#151A22] text-[#98A2B0] border border-[#2A3340] cursor-not-allowed opacity-60'
                  }`}
                >
                  <span>J'ai terminé la lecture</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {!isReadingComplete && (
                <p className="text-xs text-center text-[#98A2B0]">
                  {!hasScrolledToEnd && secondsRemaining > 0
                    ? `Veuillez défiler jusqu'à la fin de l'avenant et patienter ${secondsRemaining} s.`
                    : !hasScrolledToEnd
                    ? "Veuillez défiler jusqu'au bas de l'avenant pour activer le bouton."
                    : `Veuillez patienter encore ${secondsRemaining} s.`}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ÉTAPE 2 : SIGNATURE */}
        {step === 'signing' && (
          <div className="flex-1 flex flex-col overflow-y-auto py-3 space-y-4 text-xs pr-1">
            {/* Read Completion Proof Card with Back Button */}
            <div className="p-3 rounded-[8px] bg-[#151A22] border border-[#2A3340] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#5FB48C] shrink-0" />
                <div>
                  <span className="text-[#ECE9E2] font-semibold block text-xs">
                    Lecture intégrale certifiée
                  </span>
                  <span className="text-xs text-[#98A2B0]">
                    Terminée le {readCompletedAt}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleReviewAmendment}
                className="min-h-[44px] flex items-center gap-1.5 px-3 rounded-[8px] bg-[#1C232D] hover:bg-[#2A3340] text-[#ECE9E2] text-xs font-semibold transition cursor-pointer border border-[#2A3340]"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Revoir l'avenant</span>
              </button>
            </div>

            {/* Required Mentions */}
            <div className="p-3 rounded-[8px] bg-[#151A22] border border-[#2A3340] text-[#ECE9E2] text-center font-serif text-sm font-semibold">
              « Lu et approuvé, bon pour accord »
            </div>

            {/* Acceptance */}
            <div className="p-3.5 rounded-[8px] bg-[#151A22] border border-[#2A3340] flex items-start gap-3">
              <input
                type="checkbox"
                id="accept-amendment"
                checked={hasAccepted}
                onChange={(e) => setHasAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-[#C8A96A] bg-[#1C232D] border-[#2A3340] focus:ring-[#C8A96A] cursor-pointer"
              />
              <label htmlFor="accept-amendment" className="text-xs text-[#ECE9E2] cursor-pointer select-none">
                <span className="font-semibold text-white">J'ai lu et j'accepte l'intégralité du contrat</span> et de son présent Avenant n°{nextAmendmentNumber}.
              </label>
            </div>

            {/* Signatures */}
            <div className="space-y-3">
              <SignaturePad
                label={`Signature de l'emprunteur (${contract.borrower.fullName})`}
                subtitle="Signez pour confirmer la réception des fonds supplémentaires."
                required
                onSignatureChange={(url) => setBorrowerSignature(url)}
              />

              {contract.witness?.enabled && (
                <SignaturePad
                  label={`Signature du témoin (${contract.witness.fullName})`}
                  required
                  onSignatureChange={(url) => setWitnessSignature(url)}
                />
              )}

              {/* Automatic Lender signature */}
              <div className="p-3 rounded-[8px] bg-[#151A22] border border-[#2A3340] flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-[#ECE9E2] block">
                    Signature du prêteur ({contract.lender.fullName})
                  </span>
                  <span className="text-xs text-[#5FB48C] flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Apposée automatiquement
                  </span>
                </div>
                <div className="h-10 w-24 rounded-[8px] bg-white border border-[#2A3340] p-1 flex items-center justify-center">
                  <img
                    src={contract.lenderSignature}
                    alt="Signature Prêteur"
                    className="max-h-full object-contain"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                disabled={isSubmitting || !hasAccepted || !borrowerSignature || (contract.witness?.enabled && !witnessSignature)}
                onClick={handleSignAndLockAmendment}
                className="w-full min-h-[44px] rounded-[8px] bg-[#C8A96A] hover:bg-[#d6b777] text-[#151A22] font-semibold transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
              >
                <Lock className="w-4 h-4" />
                <span>Valider et sceller l'avenant</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: SUCCESS & SHARE AMENDMENT */}
        {step === 'success' && finalAmendment && (
          <div className="py-6 space-y-4 text-center flex-1 flex flex-col justify-center overflow-y-auto">
            <div className="w-14 h-14 rounded-full bg-[#151A22] border border-[#5FB48C] text-[#5FB48C] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[4px] bg-[#151A22] text-[#5FB48C] text-xs font-semibold border border-[#2A3340] mb-2">
                <Lock className="w-3.5 h-3.5" /> Avenant n°{finalAmendment.amendmentNumber} scellé
              </span>
              <h3 className="text-lg font-semibold text-[#ECE9E2]">Avenant enregistré avec succès</h3>
              <p className="text-xs text-[#98A2B0] mt-1 max-w-md mx-auto">
                La somme de {finalAmendment.addedAmount.toLocaleString('fr-FR')} {currencyLabel} a été ajoutée. Le nouveau capital total est de {finalAmendment.newPrincipalTotal.toLocaleString('fr-FR')} {currencyLabel}.
              </p>
              {finalAmendment.readCompletedAt && (
                <p className="text-xs text-[#C8A96A] font-mono mt-1">
                  Lecture intégrale terminée le {finalAmendment.readCompletedAt}
                </p>
              )}
            </div>

            {/* SHA-256 Digest Box */}
            <div className="p-3 rounded-[8px] bg-[#151A22] border border-[#2A3340] max-w-md mx-auto text-left space-y-1 w-full">
              <div className="flex items-center justify-between text-xs text-[#98A2B0]">
                <span className="font-semibold text-[#ECE9E2]">Empreinte SHA-256 de l'avenant :</span>
                <span className="text-[#5FB48C] font-mono text-[10px]">Certifié conforme</span>
              </div>
              <p className="font-mono text-[11px] text-[#C8A96A] break-all select-all bg-[#1C232D] p-2 rounded-[8px] border border-[#2A3340]">
                {finalAmendment.contentDigest}
              </p>
            </div>

            {shareFeedback && (
              <div className="p-3 rounded-[8px] bg-[#151A22] border border-[#5FB48C] text-[#5FB48C] text-xs font-semibold max-w-md mx-auto">
                {shareFeedback}
              </div>
            )}

            <div className="pt-2 max-w-md mx-auto w-full space-y-2">
              <button
                type="button"
                onClick={handleSharePdf}
                className="w-full min-h-[44px] px-4 rounded-[8px] bg-[#C8A96A] hover:bg-[#d6b777] text-[#151A22] font-semibold transition cursor-pointer flex items-center justify-center gap-2 text-sm"
              >
                <Share2 className="w-4 h-4" />
                <span>Partager l'avenant PDF</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full min-h-[44px] rounded-[8px] bg-[#151A22] hover:bg-[#2A3340] text-xs font-medium text-[#ECE9E2] border border-[#2A3340] transition cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
