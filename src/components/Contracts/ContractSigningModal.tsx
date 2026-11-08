import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  FileText,
  ShieldCheck,
  Share2,
  CheckCircle2,
  Lock,
  AlertCircle,
  Clock,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  PenTool,
  HelpCircle,
} from 'lucide-react';
import { Contract } from '../../types/contract';
import { Debt } from '../../types/debt';
import { SignaturePad } from './SignaturePad';
import { computeSha256Digest } from '../../utils/contractGenerator';
import { generateContractPdf, shareOrDownloadContractPdf } from '../../utils/pdfGenerator';
import { getLenderProfile } from '../../services/lenderProfile';

interface ContractSigningModalProps {
  contractDraft: Omit<
    Contract,
    | 'contractText'
    | 'contentDigest'
    | 'isLocked'
    | 'signedAt'
    | 'readCompletedAt'
  > & {
    contractText: string;
    preCalculatedDebt?: Omit<Debt, 'id' | 'createdAt' | 'updatedAt' | 'repayments'>;
  };
  onContractFinalized: (contract: Contract, debtData?: Omit<Debt, 'id' | 'createdAt' | 'updatedAt' | 'repayments'>) => void;
  onSignCancelled: (action: 'save_unsigned' | 'abandon') => void;
  onClose: () => void;
}

export const ContractSigningModal: React.FC<ContractSigningModalProps> = ({
  contractDraft,
  onContractFinalized,
  onSignCancelled,
  onClose,
}) => {
  // Step state: 'reading' (Étape 1) or 'signing' (Étape 2) or 'success'
  const [currentStep, setCurrentStep] = useState<'reading' | 'signing' | 'success'>('reading');

  // Cancel confirmation dialog state
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);

  // Reading Timer & Scroll state
  const lenderProfile = useMemo(() => getLenderProfile(), []);
  const minSeconds = lenderProfile.minReadingTimeSeconds !== undefined ? lenderProfile.minReadingTimeSeconds : 20;

  const [secondsRemaining, setSecondsRemaining] = useState<number>(minSeconds);
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState<boolean>(false);
  const [readCompletedAt, setReadCompletedAt] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Signatures state (Étape 2)
  const isJeDois = contractDraft.debtType === 'je_dois';
  // If je_dois: user (lender in contract.borrower) is borrower, the other party is lender.
  // The other party signs live in person, user's saved signature is automatically applied.
  const [hasAccepted, setHasAccepted] = useState(false);
  const [liveSignature, setLiveSignature] = useState<string | null>(null);
  const [witnessSignature, setWitnessSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signedContract, setSignedContract] = useState<Contract | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const isWitnessRequired = !!(contractDraft.witness?.enabled && contractDraft.witness.fullName.trim());

  // Countdown timer for reading
  useEffect(() => {
    if (currentStep !== 'reading') return;
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
  }, [currentStep, secondsRemaining]);

  // Scroll handler to measure progress and detect bottom
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
    if (currentStep === 'reading') {
      const timer = setTimeout(() => {
        handleScroll();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentStep]);

  const isReadingComplete = hasScrolledToEnd && secondsRemaining === 0;

  // Move from Étape 1 to Étape 2
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
    setCurrentStep('signing');
  };

  // Button « Revoir le contrat » allows going back to step 1 (erasing signature entered)
  const handleReviewContract = () => {
    setLiveSignature(null);
    setWitnessSignature(null);
    setHasAccepted(false);
    setError(null);
    setCurrentStep('reading');
  };

  // Intercept close button if not yet finalized: ask "La personne n'a pas signé"
  const handleAttemptClose = () => {
    if (currentStep === 'success') {
      onClose();
      return;
    }
    setShowCancelPrompt(true);
  };

  const handleSignAndLock = async () => {
    setError(null);

    if (!hasAccepted) {
      setError("La case confirmant la lecture et l'acceptation de l'intégralité du contrat doit être cochée.");
      return;
    }

    if (!liveSignature) {
      setError(
        isJeDois
          ? `Le prêteur (${contractDraft.lender.fullName}) doit obligatoirement apposer sa signature.`
          : `L'emprunteur (${contractDraft.borrower.fullName}) doit obligatoirement apposer sa signature.`
      );
      return;
    }

    if (isWitnessRequired && !witnessSignature) {
      setError(`Le témoin (${contractDraft.witness?.fullName}) doit également apposer sa signature.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date();
      const signedAtFormatted = now.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      // Compute SHA-256 fingerprint on the contract text
      const digest = await computeSha256Digest(contractDraft.contractText);

      // Distribute signatures based on roles:
      // If on_me_doit: lenderSignature = saved profile signature, borrowerSignature = liveSignature
      // If je_dois: borrowerSignature = saved profile signature, lenderSignature = liveSignature
      const finalLenderSignature = isJeDois ? liveSignature : contractDraft.lenderSignature;
      const finalBorrowerSignature = isJeDois ? contractDraft.borrowerSignature : liveSignature;

      const finalContract: Contract = {
        ...contractDraft,
        signedAt: signedAtFormatted,
        readCompletedAt: readCompletedAt || signedAtFormatted,
        isLocked: true,
        status: 'active',
        contentDigest: digest,
        lenderSignature: finalLenderSignature,
        borrowerSignature: finalBorrowerSignature,
        witnessSignature: witnessSignature || undefined,
        amendments: [],
      };

      setSignedContract(finalContract);
      setCurrentStep('success');
      // Pass back to parent to atomically save both Debt AND Contract
      onContractFinalized(finalContract, contractDraft.preCalculatedDebt);
    } catch (err: unknown) {
      setError((err as Error)?.message || "Erreur lors de l'enregistrement du contrat.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSharePdf = async () => {
    if (!signedContract) return;
    const doc = generateContractPdf(signedContract);
    const filename = `contrat-${signedContract.contractNumber}.pdf`;
    const title = `Contrat de prêt ${signedContract.contractNumber} - ${signedContract.borrower.fullName}`;

    const res = await shareOrDownloadContractPdf(doc, filename, title);
    if (res === 'shared') {
      setShareFeedback('Contrat PDF partagé avec succès.');
    } else {
      setShareFeedback('Contrat PDF téléchargé sur votre appareil.');
    }
    setTimeout(() => setShareFeedback(null), 3000);
  };

  // Live signing person label
  const liveSignerName = isJeDois ? contractDraft.lender.fullName : contractDraft.borrower.fullName;
  const liveSignerRole = isJeDois ? 'Prêteur' : 'Emprunteur';

  // Saved auto-signed person
  const autoSignerName = isJeDois ? contractDraft.borrower.fullName : contractDraft.lender.fullName;
  const autoSignerRole = isJeDois ? 'Emprunteur (vous)' : 'Prêteur (vous)';
  const autoSignatureData = isJeDois ? contractDraft.borrowerSignature : contractDraft.lenderSignature;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xs p-0 sm:p-3">
      <div className="w-full h-full sm:h-[94vh] max-w-2xl sm:rounded-2xl bg-slate-900 border-0 sm:border border-slate-800 p-4 sm:p-5 shadow-2xl text-slate-100 flex flex-col overflow-hidden relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              {currentStep === 'reading' ? <BookOpen className="w-4 h-4" /> : <PenTool className="w-4 h-4" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  {currentStep === 'success'
                    ? 'Contrat certifié & verrouillé'
                    : `Contrat N° ${contractDraft.contractNumber}`}
                </h2>
                {currentStep !== 'success' && (
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 border border-amber-500/30">
                    {currentStep === 'reading' ? 'Étape 1 : Lecture' : 'Étape 2 : Signature'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {currentStep === 'reading'
                  ? `Lecture préalable obligatoire par ${liveSignerName}`
                  : currentStep === 'signing'
                  ? 'Approbation et signatures électroniques'
                  : 'Horodaté et certifié conforme'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAttemptClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* DIALOG "LA PERSONNE N'A PAS SIGNÉ" */}
        {showCancelPrompt && (
          <div className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
                <HelpCircle className="w-6 h-6" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-white">La personne n'a pas signé</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Le contrat n'a pas été finalisé par une signature électronique. Que souhaitez-vous faire ?
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowCancelPrompt(false);
                    onSignCancelled('save_unsigned');
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer shadow-md shadow-amber-500/20"
                >
                  Enregistrer la dette comme non signée
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowCancelPrompt(false);
                    onSignCancelled('abandon');
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 font-semibold text-xs border border-slate-700 transition cursor-pointer"
                >
                  Abandonner (ne rien enregistrer)
                </button>

                <button
                  type="button"
                  onClick={() => setShowCancelPrompt(false)}
                  className="w-full py-2 text-xs text-slate-400 hover:text-white transition cursor-pointer"
                >
                  Reprendre la signature
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= SUCCESS & SHARE VIEW ================= */}
        {currentStep === 'success' && signedContract ? (
          <div className="py-6 space-y-5 text-center flex-1 flex flex-col justify-center overflow-y-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20 mb-2">
                <Lock className="w-3.5 h-3.5" /> Contrat n°{signedContract.contractNumber} scellé et enregistré
              </span>
              <h3 className="text-lg font-bold text-white">Dette & Contrat enregistrés ensemble !</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Signé par {signedContract.borrower.fullName} et {signedContract.lender.fullName}
                {signedContract.witnessSignature && ` en présence du témoin ${signedContract.witness?.fullName}`}.
              </p>
              {signedContract.readCompletedAt && (
                <p className="text-[11px] text-amber-400/90 font-mono mt-1">
                  Lecture intégrale terminée le {signedContract.readCompletedAt}
                </p>
              )}
            </div>

            {/* SHA-256 Digest Box */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 max-w-md mx-auto text-left space-y-1">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-semibold text-slate-300">Empreinte numérique SHA-256 :</span>
                <span className="text-emerald-400 font-mono text-[10px]">Certifié conforme</span>
              </div>
              <p className="font-mono text-[10px] text-amber-300 break-all select-all bg-slate-900 p-2 rounded border border-slate-800">
                {signedContract.contentDigest}
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
                <span>Partager le Contrat PDF (WhatsApp, Mail, etc.)</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition cursor-pointer"
              >
                Fermer et retourner à la liste
              </button>
            </div>
          </div>
        ) : currentStep === 'reading' ? (
          /* ================= ÉTAPE 1 : LECTURE PLEIN ÉCRAN ================= */
          <div className="flex-1 flex flex-col overflow-hidden py-3 space-y-3">
            {/* Progress and Timer Bar */}
            <div className="space-y-1.5 shrink-0">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                  <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                  <span>Progression de la lecture</span>
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
                    : 'Bas du contrat atteint'}
                </span>
                {secondsRemaining > 0 && (
                  <span className="text-amber-400/90 italic">
                    Délai minimal de lecture ({minSeconds}s)
                  </span>
                )}
              </div>
            </div>

            {/* Large Scrollable Contract Text */}
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800 overflow-y-auto whitespace-pre-line font-serif text-[13px] sm:text-[14px] leading-relaxed text-slate-200 select-text shadow-inner"
            >
              {contractDraft.contractText}
            </div>

            {/* Step 1 Footer Action */}
            <div className="pt-1 shrink-0 space-y-2">
              <button
                type="button"
                disabled={!isReadingComplete}
                onClick={handleFinishReading}
                className={`w-full py-3.5 px-4 rounded-xl font-bold transition flex items-center justify-center gap-2 text-xs shadow-lg ${
                  isReadingComplete
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20 cursor-pointer animate-bounce-subtle'
                    : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                }`}
              >
                <span>J'ai terminé la lecture</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {!isReadingComplete && (
                <p className="text-[11px] text-center text-slate-500">
                  {!hasScrolledToEnd && secondsRemaining > 0
                    ? `Veuillez défiler jusqu'à la fin du contrat et patienter ${secondsRemaining} s.`
                    : !hasScrolledToEnd
                    ? "Veuillez défiler jusqu'à la toute fin du contrat pour activer le bouton."
                    : `Veuillez patienter encore ${secondsRemaining} s (temps de lecture obligatoire).`}
                </p>
              )}
            </div>
          </div>
        ) : (
          /* ================= ÉTAPE 2 : SIGNATURE ================= */
          <div className="flex-1 flex flex-col overflow-y-auto py-3 space-y-4 text-xs pr-1">
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

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

              <button
                type="button"
                onClick={handleReviewContract}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition cursor-pointer border border-slate-700"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Revoir le contrat</span>
              </button>
            </div>

            {/* Required Mentions */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-center font-serif text-sm font-semibold tracking-wide">
              « Lu et approuvé, bon pour accord »
            </div>

            {/* Acceptance Checkbox */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-3">
              <input
                type="checkbox"
                id="accept-contract"
                checked={hasAccepted}
                onChange={(e) => setHasAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700 focus:ring-amber-500 cursor-pointer"
              />
              <label htmlFor="accept-contract" className="text-xs text-slate-200 cursor-pointer select-none">
                <span className="font-bold text-white">J'ai lu et j'accepte l'intégralité du contrat</span> de prêt sous seing privé et m'engage à en respecter toutes les clauses.
              </label>
            </div>

            {/* Signatures Section */}
            <div className="space-y-4 pt-1">
              {/* 1. Live Signature of the other party (Borrower if on_me_doit, Lender if je_dois) */}
              <SignaturePad
                label={`Signature du ${liveSignerRole} (${liveSignerName})`}
                subtitle={`Signez au doigt ou au stylet pour valider votre engagement en tant que ${liveSignerRole.toLowerCase()}.`}
                required
                onSignatureChange={(url) => setLiveSignature(url)}
              />

              {/* 2. Witness Signature (if enabled) */}
              {isWitnessRequired && (
                <SignaturePad
                  label={`Signature du Témoin (${contractDraft.witness?.fullName})`}
                  subtitle="Le témoin confirme avoir assisté à la conclusion du présent contrat."
                  required
                  onSignatureChange={(url) => setWitnessSignature(url)}
                />
              )}

              {/* 3. Automatic Signature of the user (Lender if on_me_doit, Borrower if je_dois) */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">
                    Signature du {autoSignerRole} ({autoSignerName})
                  </span>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3 h-3" />
                    Apposée automatiquement
                  </span>
                </div>
                <div className="h-16 rounded-lg bg-white border border-slate-700 p-1 flex items-center justify-center">
                  {autoSignatureData ? (
                    <img
                      src={autoSignatureData}
                      alt={`Signature ${autoSignerRole}`}
                      className="max-h-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-slate-400 italic">Signature officielle préenregistrée</span>
                  )}
                </div>
              </div>
            </div>

            {/* Validation & Lock Button */}
            <div className="pt-2">
              <button
                type="button"
                disabled={isSubmitting || !hasAccepted || !liveSignature || (isWitnessRequired && !witnessSignature)}
                onClick={handleSignAndLock}
                className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-xs"
              >
                <Lock className="w-4 h-4" />
                <span>Valider et Enregistrer (Dette & Contrat scellés)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
