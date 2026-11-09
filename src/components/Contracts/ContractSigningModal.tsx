import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  FileText,
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
  const [currentStep, setCurrentStep] = useState<'reading' | 'signing' | 'success'>('reading');
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);

  const lenderProfile = useMemo(() => getLenderProfile(), []);
  const minSeconds = lenderProfile.minReadingTimeSeconds !== undefined ? lenderProfile.minReadingTimeSeconds : 20;

  const [secondsRemaining, setSecondsRemaining] = useState<number>(minSeconds);
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState<boolean>(false);
  const [readCompletedAt, setReadCompletedAt] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const isJeDois = contractDraft.debtType === 'je_dois';
  const [hasAccepted, setHasAccepted] = useState(false);
  const [liveSignature, setLiveSignature] = useState<string | null>(null);
  const [witnessSignature, setWitnessSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signedContract, setSignedContract] = useState<Contract | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const isWitnessRequired = !!(contractDraft.witness?.enabled && contractDraft.witness.fullName.trim());

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

  const handleReviewContract = () => {
    setLiveSignature(null);
    setWitnessSignature(null);
    setHasAccepted(false);
    setError(null);
    setCurrentStep('reading');
  };

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

      const digest = await computeSha256Digest(contractDraft.contractText);

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

  const liveSignerName = isJeDois ? contractDraft.lender.fullName : contractDraft.borrower.fullName;
  const liveSignerRole = isJeDois ? 'Prêteur' : 'Emprunteur';
  const autoSignerName = isJeDois ? contractDraft.borrower.fullName : contractDraft.lender.fullName;
  const autoSignerRole = isJeDois ? 'Emprunteur (vous)' : 'Prêteur (vous)';
  const autoSignatureData = isJeDois ? contractDraft.borrowerSignature : contractDraft.lenderSignature;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xs p-0 sm:p-3">
      <div className="w-full h-full sm:h-[94vh] max-w-2xl rounded-t-[16px] sm:rounded-[16px] bg-[#1C232D] border border-[#2A3340] p-4 sm:p-5 text-[#ECE9E2] flex flex-col overflow-hidden relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2A3340] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[8px] bg-[#151A22] border border-[#2A3340] text-[#C8A96A] flex items-center justify-center">
              {currentStep === 'reading' ? <BookOpen className="w-4 h-4" /> : <PenTool className="w-4 h-4" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-[#ECE9E2]">
                  {currentStep === 'success'
                    ? 'Contrat scellé et enregistré'
                    : `Contrat N° ${contractDraft.contractNumber}`}
                </h2>
                {currentStep !== 'success' && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-[4px] bg-[#151A22] text-[#C8A96A] border border-[#2A3340]">
                    {currentStep === 'reading' ? 'Étape 1 : Lecture' : 'Étape 2 : Signature'}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#98A2B0]">
                {currentStep === 'reading'
                  ? `Lecture préalable obligatoire par ${liveSignerName}`
                  : currentStep === 'signing'
                  ? 'Approbation et signatures'
                  : 'Horodaté et certifié conforme'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAttemptClose}
            className="min-h-[44px] min-w-[44px] rounded-[8px] text-[#98A2B0] hover:text-[#ECE9E2] hover:bg-[#151A22] transition flex items-center justify-center cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* DIALOG "LA PERSONNE N'A PAS SIGNÉ" */}
        {showCancelPrompt && (
          <div className="absolute inset-0 z-50 bg-[#151A22]/95 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-[16px] bg-[#1C232D] border border-[#2A3340] p-5 text-center space-y-4">
              <div className="w-12 h-12 rounded-[8px] bg-[#151A22] border border-[#2A3340] text-[#C8A96A] flex items-center justify-center mx-auto">
                <HelpCircle className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-semibold text-[#ECE9E2]">La personne n'a pas signé</h3>
                <p className="text-xs text-[#98A2B0] leading-relaxed">
                  Le contrat n'a pas été validé par signature. Que souhaitez-vous faire ?
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowCancelPrompt(false);
                    onSignCancelled('save_unsigned');
                  }}
                  className="w-full min-h-[44px] px-3 rounded-[8px] bg-[#C8A96A] hover:bg-[#d6b777] text-[#151A22] font-semibold text-xs transition cursor-pointer"
                >
                  Enregistrer la dette comme non signée
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowCancelPrompt(false);
                    onSignCancelled('abandon');
                  }}
                  className="w-full min-h-[44px] px-3 rounded-[8px] bg-[#151A22] hover:bg-[#2A3340] text-[#E5604D] font-medium text-xs border border-[#2A3340] transition cursor-pointer"
                >
                  Abandonner (ne rien enregistrer)
                </button>

                <button
                  type="button"
                  onClick={() => setShowCancelPrompt(false)}
                  className="w-full min-h-[44px] text-xs text-[#98A2B0] hover:text-[#ECE9E2] transition cursor-pointer"
                >
                  Reprendre la signature
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= SUCCESS & SHARE VIEW ================= */}
        {currentStep === 'success' && signedContract ? (
          <div className="py-6 space-y-4 text-center flex-1 flex flex-col justify-center overflow-y-auto">
            <div className="w-14 h-14 rounded-full bg-[#151A22] border border-[#5FB48C] text-[#5FB48C] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[4px] bg-[#151A22] text-[#5FB48C] text-xs font-semibold border border-[#2A3340] mb-2">
                <Lock className="w-3.5 h-3.5" /> Contrat n°{signedContract.contractNumber} scellé
              </span>
              <h3 className="text-lg font-semibold text-[#ECE9E2]">Dette et contrat enregistrés</h3>
              <p className="text-xs text-[#98A2B0] mt-1 max-w-md mx-auto">
                Signé par {signedContract.borrower.fullName} et {signedContract.lender.fullName}
                {signedContract.witnessSignature && ` en présence de ${signedContract.witness?.fullName}`}.
              </p>
              {signedContract.readCompletedAt && (
                <p className="text-xs text-[#C8A96A] font-mono mt-1">
                  Lecture intégrale terminée le {signedContract.readCompletedAt}
                </p>
              )}
            </div>

            {/* SHA-256 Digest Box */}
            <div className="p-3 rounded-[8px] bg-[#151A22] border border-[#2A3340] max-w-md mx-auto text-left space-y-1 w-full">
              <div className="flex items-center justify-between text-xs text-[#98A2B0]">
                <span className="font-semibold text-[#ECE9E2]">Empreinte numérique SHA-256 :</span>
                <span className="text-[#5FB48C] font-mono text-[10px]">Certifié conforme</span>
              </div>
              <p className="font-mono text-[11px] text-[#C8A96A] break-all select-all bg-[#1C232D] p-2 rounded-[8px] border border-[#2A3340]">
                {signedContract.contentDigest}
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
                <span>Partager le contrat PDF</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full min-h-[44px] rounded-[8px] bg-[#151A22] hover:bg-[#2A3340] text-xs font-medium text-[#ECE9E2] border border-[#2A3340] transition cursor-pointer"
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
                <div className="flex items-center gap-1.5 text-[#ECE9E2] font-medium">
                  <BookOpen className="w-3.5 h-3.5 text-[#C8A96A]" />
                  <span>Progression de la lecture</span>
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
                    : 'Bas du contrat atteint'}
                </span>
                {secondsRemaining > 0 && (
                  <span className="text-[#C8A96A]">
                    Délai minimal : {minSeconds}s
                  </span>
                )}
              </div>
            </div>

            {/* Scrollable Contract Text */}
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 p-4 sm:p-5 rounded-[8px] bg-[#151A22] border border-[#2A3340] overflow-y-auto whitespace-pre-line font-serif text-[13px] sm:text-[14px] leading-relaxed text-[#ECE9E2] select-text"
            >
              {contractDraft.contractText}
            </div>

            {/* Step 1 Footer Action */}
            <div className="pt-1 shrink-0 space-y-2">
              <button
                type="button"
                disabled={!isReadingComplete}
                onClick={handleFinishReading}
                className={`w-full min-h-[44px] px-4 rounded-[8px] font-semibold transition flex items-center justify-center gap-2 text-sm ${
                  isReadingComplete
                    ? 'bg-[#C8A96A] hover:bg-[#d6b777] text-[#151A22] cursor-pointer'
                    : 'bg-[#151A22] text-[#98A2B0] border border-[#2A3340] cursor-not-allowed opacity-60'
                }`}
              >
                <span>J'ai terminé la lecture</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {!isReadingComplete && (
                <p className="text-xs text-center text-[#98A2B0]">
                  {!hasScrolledToEnd && secondsRemaining > 0
                    ? `Veuillez défiler jusqu'à la fin du contrat et patienter ${secondsRemaining} s.`
                    : !hasScrolledToEnd
                    ? "Veuillez défiler jusqu'à la toute fin du contrat pour activer le bouton."
                    : `Veuillez patienter encore ${secondsRemaining} s.`}
                </p>
              )}
            </div>
          </div>
        ) : (
          /* ================= ÉTAPE 2 : SIGNATURE ================= */
          <div className="flex-1 flex flex-col overflow-y-auto py-3 space-y-4 text-xs pr-1">
            {error && (
              <div className="p-3 rounded-[8px] bg-[#151A22] border border-[#E5604D] text-[#E5604D] font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-[#E5604D]" />
                <span>{error}</span>
              </div>
            )}

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
                onClick={handleReviewContract}
                className="min-h-[44px] flex items-center gap-1.5 px-3 rounded-[8px] bg-[#1C232D] hover:bg-[#2A3340] text-[#ECE9E2] text-xs font-semibold transition cursor-pointer border border-[#2A3340]"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Revoir le contrat</span>
              </button>
            </div>

            {/* Required Mentions */}
            <div className="p-3 rounded-[8px] bg-[#151A22] border border-[#2A3340] text-[#ECE9E2] text-center font-serif text-sm font-semibold">
              « Lu et approuvé, bon pour accord »
            </div>

            {/* Acceptance Checkbox */}
            <div className="p-3.5 rounded-[8px] bg-[#151A22] border border-[#2A3340] flex items-start gap-3">
              <input
                type="checkbox"
                id="accept-contract"
                checked={hasAccepted}
                onChange={(e) => setHasAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-[#C8A96A] bg-[#1C232D] border-[#2A3340] focus:ring-[#C8A96A] cursor-pointer"
              />
              <label htmlFor="accept-contract" className="text-xs text-[#ECE9E2] cursor-pointer select-none">
                <span className="font-semibold text-white">J'ai lu et j'accepte l'intégralité du contrat</span> de prêt sous seing privé et m'engage à en respecter toutes les clauses.
              </label>
            </div>

            {/* Signatures Section */}
            <div className="space-y-4 pt-1">
              {/* 1. Live Signature */}
              <SignaturePad
                label={`Signature du ${liveSignerRole} (${liveSignerName})`}
                subtitle={`Signez au doigt ou au stylet pour valider votre engagement en tant que ${liveSignerRole.toLowerCase()}.`}
                required
                onSignatureChange={(url) => setLiveSignature(url)}
              />

              {/* 2. Witness Signature */}
              {isWitnessRequired && (
                <SignaturePad
                  label={`Signature du témoin (${contractDraft.witness?.fullName})`}
                  subtitle="Le témoin confirme avoir assisté à la conclusion du présent contrat."
                  required
                  onSignatureChange={(url) => setWitnessSignature(url)}
                />
              )}

              {/* 3. Automatic Signature */}
              <div className="p-3 rounded-[8px] bg-[#151A22] border border-[#2A3340] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#ECE9E2]">
                    Signature du {autoSignerRole} ({autoSignerName})
                  </span>
                  <span className="text-xs text-[#5FB48C] flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Apposée automatiquement
                  </span>
                </div>
                <div className="h-16 rounded-[8px] bg-white border border-[#2A3340] p-1 flex items-center justify-center">
                  {autoSignatureData ? (
                    <img
                      src={autoSignatureData}
                      alt={`Signature ${autoSignerRole}`}
                      className="max-h-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-slate-500 italic">Signature officielle préenregistrée</span>
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
                className="w-full min-h-[44px] rounded-[8px] bg-[#C8A96A] hover:bg-[#d6b777] text-[#151A22] font-semibold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
              >
                <Lock className="w-4 h-4" />
                <span>Valider et enregistrer la dette et le contrat</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
