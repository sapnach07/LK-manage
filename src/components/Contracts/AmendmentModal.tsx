import React, { useState } from 'react';
import {
  X,
  FilePlus,
  Lock,
  Share2,
  CheckCircle2,
  AlertCircle,
  Copy,
  ShieldCheck,
} from 'lucide-react';
import { Contract, Amendment } from '../../types/contract';
import { Debt } from '../../types/debt';
import { buildAmendmentFullText, computeSha256Digest } from '../../utils/contractGenerator';
import { generateAmendmentPdf, shareOrDownloadContractPdf } from '../../utils/pdfGenerator';
import { addAmendmentToContract, saveDebt } from '../../services/db';
import { formatAmountInWords } from '../../utils/numberToWords';
import { SignaturePad } from './SignaturePad';

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

  const [step, setStep] = useState<'form' | 'review_and_sign' | 'success'>('form');
  const [addedAmount, setAddedAmount] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Review & Signing state
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

  const handleProceedToReview = (e: React.FormEvent) => {
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
    setStep('review_and_sign');
  };

  const handleSignAndLockAmendment = async () => {
    setError(null);

    if (!hasAccepted) {
      setError("L'emprunteur doit accepter les termes de l'avenant.");
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
    const filename = `avenant-${finalAmendment.amendmentNumber}-${contract.contractNumber}.pdf`;
    const title = `Avenant n°${finalAmendment.amendmentNumber} au contrat ${contract.contractNumber}`;

    const res = await shareOrDownloadContractPdf(doc, filename, title);
    if (res === 'shared') {
      setShareFeedback('Avenant PDF partagé avec succès.');
    } else {
      setShareFeedback('Avenant PDF téléchargé.');
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
              <FilePlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Avenant N° {nextAmendmentNumber} au Contrat {contract.contractNumber}
              </h2>
              <p className="text-xs text-slate-400">Ajout de fonds & Re-signature officielle</p>
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
          <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: FORM TO ENTER AMOUNT AND REASON */}
        {step === 'form' && (
          <form onSubmit={handleProceedToReview} className="overflow-y-auto py-4 space-y-4 flex-1 text-xs pr-1">
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

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Motif de l'ajout de fonds <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={2}
                required
                placeholder="Ex: Complément de prêt pour achat matériel de bureau"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Total calculation preview */}
            <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-300">
                <span>Nouveau total prêté :</span>
                <span className="font-bold text-amber-400 text-sm">
                  {newTotal.toLocaleString('fr-FR')} {currencySymbol}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                En lettres : {formatAmountInWords(newTotal, contract.currency)}
              </p>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition cursor-pointer shadow-lg shadow-amber-500/20"
              >
                Générer l'avenant pour signature
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: REVIEW & SIGN AMENDMENT */}
        {step === 'review_and_sign' && (
          <div className="overflow-y-auto py-3 space-y-4 flex-1 text-xs pr-1">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span>Contenu légal de l'avenant</span>
                <span className="text-[10px] text-amber-400 font-mono">Faire défiler</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 max-h-56 overflow-y-auto whitespace-pre-line font-serif text-[12px] leading-relaxed text-slate-200 select-text shadow-inner">
                {amendmentText}
              </div>
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
                <span className="font-bold text-white">J'ai lu et j'accepte</span> l'ensemble des termes du présent Avenant n°{nextAmendmentNumber}.
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

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep('form')}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition cursor-pointer"
              >
                Retour
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSignAndLockAmendment}
                className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition cursor-pointer shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                <span>{isSubmitting ? 'Validation...' : "Valider et sceller l'avenant"}</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: SUCCESS & SHARE */}
        {step === 'success' && finalAmendment && (
          <div className="py-6 space-y-5 text-center flex-1 flex flex-col justify-center">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-950/40">
              <Lock className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">Avenant scellé avec succès</h3>
              <p className="text-xs text-slate-400">
                Nouveau total du capital : {newTotal.toLocaleString('fr-FR')} {currencySymbol}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-left text-xs space-y-2">
              <div className="flex justify-between items-center text-[11px] text-slate-400 border-b border-slate-800 pb-2">
                <span>Avenant</span>
                <span className="font-bold text-amber-400 font-mono">
                  N° {finalAmendment.amendmentNumber} au contrat {contract.contractNumber}
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px] text-slate-400 border-b border-slate-800 pb-2">
                <span>Horodatage de signature</span>
                <span className="text-slate-200">{finalAmendment.signedAt}</span>
              </div>
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    Empreinte SHA-256 de l'avenant
                  </span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(finalAmendment.contentDigest)}
                    className="text-amber-400 hover:underline flex items-center gap-0.5"
                  >
                    <Copy className="w-2.5 h-2.5" />
                    <span>Copier</span>
                  </button>
                </div>
                <p className="font-mono text-[9px] text-slate-400 break-all bg-slate-900 p-2 rounded-lg border border-slate-800">
                  {finalAmendment.contentDigest}
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
                <span>Partager le PDF de l'Avenant</span>
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
