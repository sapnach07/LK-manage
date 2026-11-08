import React, { useState } from 'react';
import {
  X,
  FileText,
  ShieldCheck,
  Share2,
  Download,
  CheckCircle2,
  Lock,
  AlertCircle,
  Copy,
} from 'lucide-react';
import { Contract } from '../../types/contract';
import { SignaturePad } from './SignaturePad';
import { computeSha256Digest } from '../../utils/contractGenerator';
import { generateContractPdf, shareOrDownloadContractPdf } from '../../utils/pdfGenerator';
import { saveContract } from '../../services/db';

interface ContractSigningModalProps {
  contractDraft: Omit<Contract, 'contractText' | 'contentDigest' | 'isLocked' | 'borrowerSignature' | 'witnessSignature' | 'signedAt'> & {
    contractText: string;
  };
  onContractFinalized: (contract: Contract) => void;
  onClose: () => void;
}

export const ContractSigningModal: React.FC<ContractSigningModalProps> = ({
  contractDraft,
  onContractFinalized,
  onClose,
}) => {
  const [hasAccepted, setHasAccepted] = useState(false);
  const [borrowerSignature, setBorrowerSignature] = useState<string | null>(null);
  const [witnessSignature, setWitnessSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signedContract, setSignedContract] = useState<Contract | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const isWitnessRequired = !!(contractDraft.witness?.enabled && contractDraft.witness.fullName.trim());

  const handleSignAndLock = async () => {
    setError(null);

    if (!hasAccepted) {
      setError("L'emprunteur doit cocher la case confirmant la lecture et l'acceptation du contrat.");
      return;
    }

    if (!borrowerSignature) {
      setError("L'emprunteur doit obligatoirement apposer sa signature électronique au doigt.");
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

      const finalContract: Contract = {
        ...contractDraft,
        signedAt: signedAtFormatted,
        isLocked: true,
        status: 'active',
        contentDigest: digest,
        borrowerSignature,
        witnessSignature: witnessSignature || undefined,
        amendments: [],
      };

      await saveContract(finalContract);
      setSignedContract(finalContract);
      onContractFinalized(finalContract);
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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full max-w-xl rounded-t-3xl sm:rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl text-slate-100 max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {signedContract ? 'Contrat certifié & verrouillé' : `Contrat N° ${contractDraft.contractNumber}`}
              </h2>
              <p className="text-xs text-slate-400">
                {signedContract ? 'Horodaté et certifié conforme' : 'Lecture et signature sous seing privé'}
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

        {signedContract ? (
          /* ================= SUCCESS & SHARE VIEW ================= */
          <div className="py-6 space-y-5 text-center flex-1 flex flex-col justify-center">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-950/40">
              <Lock className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">Contrat signé et verrouillé</h3>
              <p className="text-xs text-slate-400">
                L’acte sous seing privé a été scellé selon l’ordonnance-loi n° 23/010 du 13 mars 2023.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-left text-xs space-y-2">
              <div className="flex justify-between items-center text-[11px] text-slate-400 border-b border-slate-800/80 pb-2">
                <span>Numéro officiel</span>
                <span className="font-mono text-amber-400 font-bold">{signedContract.contractNumber}</span>
              </div>
              <div className="flex justify-between items-center text-[11px] text-slate-400 border-b border-slate-800/80 pb-2">
                <span>Date & heure de signature</span>
                <span className="text-slate-200">{signedContract.signedAt}</span>
              </div>
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    Empreinte numérique SHA-256
                  </span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(signedContract.contentDigest)}
                    className="text-amber-400 hover:underline flex items-center gap-0.5"
                    title="Copier le hash"
                  >
                    <Copy className="w-2.5 h-2.5" />
                    <span>Copier</span>
                  </button>
                </div>
                <p className="font-mono text-[9px] text-slate-400 break-all bg-slate-900 p-2 rounded-lg border border-slate-800">
                  {signedContract.contentDigest}
                </p>
              </div>
            </div>

            {shareFeedback && (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium">
                {shareFeedback}
              </div>
            )}

            <div className="space-y-2 pt-2">
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
        ) : (
          /* ================= IN-APP CONTRACT REVIEW & SIGNING ================= */
          <div className="overflow-y-auto py-3 space-y-4 flex-1 text-xs pr-1">
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Scrollable contract text as required: "L'emprunteur voit le CONTENU du contrat dans l'app (texte défilant, pas le PDF)" */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span>Contenu légal du contrat</span>
                <span className="text-[10px] text-amber-400 font-mono">Faire défiler pour tout lire</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 max-h-64 overflow-y-auto whitespace-pre-line font-serif text-[12px] leading-relaxed text-slate-200 select-text shadow-inner">
                {contractDraft.contractText}
              </div>
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
                <span className="font-bold text-white">J'ai lu et j'accepte</span> l'intégralité des termes et articles du présent contrat de prêt sous seing privé.
              </label>
            </div>

            {/* Signatures Section */}
            <div className="space-y-4 pt-1">
              {/* 1. Borrower Signature */}
              <SignaturePad
                label={`Signature de l'Emprunteur (${contractDraft.borrower.fullName})`}
                subtitle="Signez au doigt ou au stylet pour valider votre engagement de remboursement."
                required
                onSignatureChange={(url) => setBorrowerSignature(url)}
              />

              {/* 2. Witness Signature (if enabled) */}
              {isWitnessRequired && (
                <SignaturePad
                  label={`Signature du Témoin (${contractDraft.witness?.fullName})`}
                  subtitle="Le témoin confirme avoir assisté à la conclusion du présent prêt."
                  required
                  onSignatureChange={(url) => setWitnessSignature(url)}
                />
              )}

              {/* 3. Lender Signature Preview */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">
                    Signature du Prêteur ({contractDraft.lender.fullName})
                  </span>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3 h-3" />
                    Enregistrée automatiquement
                  </span>
                </div>
                <div className="h-16 rounded-lg bg-white border border-slate-700 p-1 flex items-center justify-center">
                  <img
                    src={contractDraft.lenderSignature}
                    alt="Signature du Prêteur"
                    className="max-h-full object-contain"
                  />
                </div>
              </div>
            </div>

            {/* Submit button */}
            <div className="pt-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSignAndLock}
                className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition cursor-pointer shadow-lg shadow-amber-500/20 text-xs flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Lock className="w-4 h-4" />
                <span>{isSubmitting ? 'Scellement du contrat...' : 'Valider et verrouiller le contrat'}</span>
              </button>
              <p className="text-[10px] text-slate-500 text-center mt-2">
                Le contrat sera immédiatement verrouillé. Aucune modification ultérieure n'est autorisée (seul un avenant sera possible).
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
