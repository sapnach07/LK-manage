import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  FilePlus,
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

  // Global steps: 'form' -> 'reading' (Étape 1) -> 'signing' (Étape 2) -> 'success'
  const [step, setStep] = useState<'form' | 'reading' | 'signing' | 'success'>('form');
  const [addedAmount, setAddedAmount] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Reading Timer & Scroll state
  const lenderProfile = useMemo(() => getLenderProfile(), []);
  const minSeconds = lenderProfile.minReadingTimeSeconds !== undefined ? lenderProfile.minReadingTimeSeconds : 20;

  const [secondsRemaining, setSecondsRemaining] = useState<number>(minSeconds);
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState<boolean>(false);
  const [readCompletedAt, setReadCompletedAt] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Signing state (Étape 2)
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
  const currencySymbol = contract.currency === 'USD' ? '$' : 'FC';

  // Step 1: Form validation to enter reading step
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
    // Reset timer & scroll for reading
    setSecondsRemaining(minSeconds);
    setScrollProgress(0);
    setHasScrolledToEnd(false);
    setStep('reading');
  };

  // Countdown timer for reading step
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

  // Scroll handler for reading step
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

  // Check initial scroll bounds on entering reading step
  useEffect(() => {
    if (step === 'reading') {
      const timer = setTimeout(() => {
        handleScroll();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const isReadingComplete = hasScrolledToEnd && secondsRemaining === 0;

  // Move from Étape 1 (lecture) to Étape 2 (signature)
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

  // Button « Revoir le contrat » / avenant allows returning to step 1 (erasing current signature)
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
        contentDigest: digest,
        amendmentText,
        borrowerSignature,
        lenderSignature: contract.lenderSignature,
        witnessSignature: witnessSignature || undefined,
      };

      const updatedContract = await addAmendmentToContract(contract.id, amendment);

      // If debt exists, update debt's initial amount to reflect the new total
      let updatedDebt: Debt | undefined = undefined;
      if (debt) {
        updatedDebt = {
          ...debt,
          initialAmount: newTotal,
          reason: `${debt.reason} [Avenant n°${nextAmendmentNumber}: +${numAdded} ${currencySymbol}]`,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xs p-0 sm:p-3">
      <div className="w-full h-full sm:h-[94vh] max-w-2xl sm:rounded-2xl bg-slate-900 border-0 sm:border border-slate-800 p-4 sm:p-5 shadow-2xl text-slate-100 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <FilePlus className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  Avenant n°{nextAmendmentNumber} au Contrat {contract.contractNumber}
                </h2>
                {step !== 'success' && step !== 'form' && (
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 border border-amber-500/30">
                    {step === 'reading' ? 'Étape 1 : Lecture' : 'Étape 2 : Signature'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
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
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: FORM TO ENTER AMOUNT AND REASON */}
        {step === 'form' && (
          <form onSubmit={handleProceedToReading} className="overflow-y-auto py-4 space-y-4 flex-1 text-xs pr-1">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
              <div>
                <span className="text-slate-400 text-[11px]">Emprunteur</span>
                <p className="font-bold text-white text-xs">{contract.borrower.fullName}</p>
              </div>
              <div className="text-right">
                <span className="text-slate-400 text-[11px]">Capital actuel</span>
                <p className="font-bold text-amber-400 text-xs">
                  {currentTotal.toLocaleString('fr-FR')} {currencySymbol}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Somme supplémentaire remise <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={addedAmount}
                  onChange={(e) => setAddedAmount(e.target.value)}
                  className="w-full pl-3 pr-14 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 text-sm font-semibold"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-400">
                  {currencySymbol}
                </span>
              </div>
              {numAdded > 0 && (
                <p className="text-[11px] text-slate-400 italic">
                  En toutes lettres : {formatAmountInWords(numAdded, contract.currency)}
                </p>
              )}
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-400 font-medium">Nouveau total du capital dû :</span>
              <span className="font-bold text-emerald-400 text-sm">
                {newTotal.toLocaleString('fr-FR')} {currencySymbol}
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Motif du prêt supplémentaire <span className="text-rose-400">*</span>
              </label>
              <textarea
                required
                rows={2}
                placeholder="Ex: Frais médicaux complémentaires, réapprovisionnement..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Date de remise des fonds <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition cursor-pointer shadow-lg shadow-amber-500/20 text-xs flex items-center justify-center gap-2"
              >
                <span>Passer à la lecture de l'avenant</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* ÉTAPE 1 : LECTURE PLEIN ÉCRAN DE L'AVENANT */}
        {step === 'reading' && (
          <div className="flex-1 flex flex-col overflow-hidden py-3 space-y-3">
            {/* Progress and Timer Bar */}
            <div className="space-y-1.5 shrink-0">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                  <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                  <span>Progression de la lecture de l'avenant</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-amber-400">{scrollProgress}% lu</span>
                  {secondsRemaining > 0 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-mono font-semibold animate-pulse">
                      <Clock className="w-3 h-3" />
                      <span>{secondsRemaining}s restantes</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Temps validé</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Progress bar line */}
              <div className="w-full h-2 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-150"
                  style={{ width: `${scrollProgress}%` }}
                />
              </div>

              {/* Helper guidance */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                <span>
                  {!hasScrolledToEnd
                    ? 'Défilez jusqu’au bas du texte pour débloquer la validation'
                    : 'Bas de l’avenant atteint'}
                </span>
                {secondsRemaining > 0 && (
                  <span className="text-amber-400/90 italic">
                    Délai minimal de lecture en cours ({minSeconds}s)
                  </span>
                )}
              </div>
            </div>

            {/* Large Scrollable Text */}
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800 overflow-y-auto whitespace-pre-line font-serif text-[13px] sm:text-[14px] leading-relaxed text-slate-200 select-text shadow-inner"
            >
              {amendmentText}
            </div>

            {/* Step 1 Actions */}
            <div className="pt-1 shrink-0 space-y-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep('form')}
                  className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition cursor-pointer text-xs"
                >
                  Modifier montant
                </button>

                <button
                  type="button"
                  disabled={!isReadingComplete}
                  onClick={handleFinishReading}
                  className={`flex-1 py-3 px-4 rounded-xl font-bold transition flex items-center justify-center gap-2 text-xs shadow-lg ${
                    isReadingComplete
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20 cursor-pointer animate-bounce-subtle'
                      : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  }`}
                >
                  <span>J'ai terminé la lecture</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {!isReadingComplete && (
                <p className="text-[11px] text-center text-slate-500">
                  {!hasScrolledToEnd && secondsRemaining > 0
                    ? `Veuillez défiler jusqu'à la fin de l'avenant et patienter ${secondsRemaining} s.`
                    : !hasScrolledToEnd
                    ? "Veuillez défiler jusqu'au bas de l'avenant pour activer le bouton."
                    : `Veuillez patienter encore ${secondsRemaining} s (temps de lecture obligatoire).`}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ÉTAPE 2 : SIGNATURE DE L'AVENANT */}
        {step === 'signing' && (
          <div className="flex-1 flex flex-col overflow-y-auto py-3 space-y-4 text-xs pr-1">
            {/* Read Completion Proof Card with Back Button */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <span className="text-slate-200 font-semibold block text-xs">
                    Lecture intégrale certifiée
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Terminée le {readCompletedAt}
                  </span>
                </div>
              </div>

              {/* Button « Revoir le contrat » / avenant: erases signature and returns to step 1 */}
              <button
                type="button"
                onClick={handleReviewAmendment}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition cursor-pointer border border-slate-700"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Revoir l'avenant</span>
              </button>
            </div>

            {/* Required Mentions */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-center font-serif text-sm font-semibold tracking-wide">
              « Lu et approuvé, bon pour accord »
            </div>

            {/* Acceptance */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-3">
              <input
                type="checkbox"
                id="accept-amendment"
                checked={hasAccepted}
                onChange={(e) => setHasAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700 focus:ring-amber-500 cursor-pointer"
              />
              <label htmlFor="accept-amendment" className="text-xs text-slate-200 cursor-pointer select-none">
                <span className="font-bold text-white">J'ai lu et j'accepte l'intégralité du contrat</span> et de son présent Avenant n°{nextAmendmentNumber}.
              </label>
            </div>

            {/* Signatures */}
            <div className="space-y-3">
              <SignaturePad
                label={`Signature de l'Emprunteur (${contract.borrower.fullName})`}
                subtitle="Signez pour confirmer la réception des fonds supplémentaires."
                required
                onSignatureChange={(url) => setBorrowerSignature(url)}
              />

              {contract.witness?.enabled && (
                <SignaturePad
                  label={`Signature du Témoin (${contract.witness.fullName})`}
                  required
                  onSignatureChange={(url) => setWitnessSignature(url)}
                />
              )}

              {/* Automatic Lender signature */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-200 block">
                    Signature du Prêteur ({contract.lender.fullName})
                  </span>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3 h-3" />
                    Apposée automatiquement
                  </span>
                </div>
                <div className="h-10 w-24 rounded bg-white p-1 flex items-center justify-center">
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
                className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition cursor-pointer shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed text-xs"
              >
                <Lock className="w-4 h-4" />
                <span>Valider et Sceller l'Avenant</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: SUCCESS & SHARE AMENDMENT */}
        {step === 'success' && finalAmendment && (
          <div className="py-6 space-y-5 text-center flex-1 flex flex-col justify-center overflow-y-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20 mb-2">
                <Lock className="w-3.5 h-3.5" /> Avenant n°{finalAmendment.amendmentNumber} scellé et verrouillé
              </span>
              <h3 className="text-lg font-bold text-white">Avenant enregistré avec succès !</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                La somme supplémentaire de {finalAmendment.addedAmount.toLocaleString('fr-FR')} {currencySymbol} a été ajoutée au capital initial. Le nouveau solde total est de {finalAmendment.newPrincipalTotal.toLocaleString('fr-FR')} {currencySymbol}.
              </p>
              {finalAmendment.readCompletedAt && (
                <p className="text-[11px] text-amber-400/90 font-mono mt-1">
                  Lecture intégrale terminée le {finalAmendment.readCompletedAt}
                </p>
              )}
            </div>

            {/* SHA-256 Digest Box */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 max-w-md mx-auto text-left space-y-1">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-semibold text-slate-300">Empreinte SHA-256 de l'avenant :</span>
                <span className="text-emerald-400 font-mono text-[10px]">Certifié conforme</span>
              </div>
              <p className="font-mono text-[10px] text-amber-300 break-all select-all bg-slate-900 p-2 rounded border border-slate-800">
                {finalAmendment.contentDigest}
              </p>
            </div>

            {shareFeedback && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold max-w-md mx-auto">
                {shareFeedback}
              </div>
            )}

            <div className="pt-2 max-w-md mx-auto w-full space-y-2">
              <button
                type="button"
                onClick={handleSharePdf}
                className="w-full py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 text-xs"
              >
                <Share2 className="w-4 h-4" />
                <span>Partager l'Avenant PDF (WhatsApp, etc.)</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition cursor-pointer"
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
