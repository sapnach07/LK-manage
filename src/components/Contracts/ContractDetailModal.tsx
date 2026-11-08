import React, { useState } from 'react';
import {
  X,
  FileText,
  Share2,
  Lock,
  PlusCircle,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Calendar,
  User,
  Phone,
  MapPin,
  Ban,
} from 'lucide-react';
import { Contract, Amendment } from '../../types/contract';
import { Debt } from '../../types/debt';
import { generateContractPdf, generateAmendmentPdf, shareOrDownloadContractPdf } from '../../utils/pdfGenerator';
import { cancelContract } from '../../services/db';

interface ContractDetailModalProps {
  contract: Contract;
  debt?: Debt | null;
  onClose: () => void;
  onOpenAmendment: (contract: Contract) => void;
  onContractUpdated: (updated: Contract) => void;
}

export const ContractDetailModal: React.FC<ContractDetailModalProps> = ({
  contract,
  debt,
  onClose,
  onOpenAmendment,
  onContractUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'text' | 'amendments'>('details');
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const currencySymbol = contract.currency === 'USD' ? '$' : 'FC';

  const handleShareContract = async () => {
    const doc = generateContractPdf(contract);
    const filename = `contrat-${contract.contractNumber}.pdf`;
    const title = `Contrat de prêt ${contract.contractNumber} - ${contract.borrower.fullName}`;
    const res = await shareOrDownloadContractPdf(doc, filename, title);
    setActionFeedback(res === 'shared' ? 'Contrat partagé avec succès.' : 'Contrat PDF téléchargé.');
    setTimeout(() => setActionFeedback(null), 3000);
  };

  const handleShareAmendment = async (amendment: Amendment) => {
    const doc = generateAmendmentPdf(contract, amendment);
    const filename = `avenant-${amendment.amendmentNumber}-${contract.contractNumber}.pdf`;
    const title = `Avenant n°${amendment.amendmentNumber} au contrat ${contract.contractNumber}`;
    const res = await shareOrDownloadContractPdf(doc, filename, title);
    setActionFeedback(res === 'shared' ? 'Avenant partagé avec succès.' : 'Avenant PDF téléchargé.');
    setTimeout(() => setActionFeedback(null), 3000);
  };

  const handleConfirmCancel = async () => {
    if (!cancelReason.trim()) return;
    setIsProcessing(true);
    try {
      const updated = await cancelContract(contract.id, cancelReason.trim());
      onContractUpdated(updated);
      setShowCancelPrompt(false);
      setActionFeedback('Contrat marqué comme annulé avec motif consigné.');
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (e: unknown) {
      setActionFeedback((e as Error)?.message || 'Erreur lors de l’annulation.');
    } finally {
      setIsProcessing(false);
    }
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
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">{contract.contractNumber}</h2>
                {contract.status === 'cancelled' ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 font-semibold">
                    Annulé
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" />
                    Verrouillé
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Signé le {contract.signedAt} • {contract.borrower.fullName}
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

        {actionFeedback && (
          <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium">
            {actionFeedback}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 pt-2 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`py-2 px-3 border-b-2 font-medium transition cursor-pointer ${
              activeTab === 'details'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Synthèse
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('text')}
            className={`py-2 px-3 border-b-2 font-medium transition cursor-pointer ${
              activeTab === 'text'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Texte du contrat
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('amendments')}
            className={`py-2 px-3 border-b-2 font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'amendments'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Avenants</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-300">
              {contract.amendments?.length || 0}
            </span>
          </button>
        </div>

        {/* TAB 1: DETAILS */}
        {activeTab === 'details' && (
          <div className="overflow-y-auto py-3 space-y-3.5 flex-1 text-xs pr-1">
            {/* Cancellation alert if cancelled */}
            {contract.status === 'cancelled' && (
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-rose-400">
                  <Ban className="w-4 h-4" />
                  <span>Contrat annulé avec traçabilité</span>
                </div>
                <p className="text-[11px] text-rose-200">
                  Motif : « {contract.cancellationReason} »
                </p>
                {contract.cancelledAt && (
                  <p className="text-[10px] text-rose-400">
                    Annulé le {new Date(contract.cancelledAt).toLocaleString('fr-FR')}
                  </p>
                )}
              </div>
            )}

            {/* Financial summary card */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Capital prêté</span>
                <span className="text-base font-bold text-amber-400">
                  {contract.principalAmount.toLocaleString('fr-FR')} {currencySymbol}
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px] text-slate-400 border-t border-slate-900 pt-2">
                <span>Modalités de remboursement</span>
                <span className="text-slate-200">
                  {contract.hasDueDate && contract.dueDate
                    ? `Échéance le ${new Date(contract.dueDate).toLocaleDateString('fr-FR')}`
                    : `Sur demande (préavis de ${contract.noticeDays || 7} jours)`}
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px] text-slate-400 border-t border-slate-900 pt-2">
                <span>Régime d'intérêts</span>
                <span className="text-slate-200">
                  {contract.interestType === 'none'
                    ? 'Aucun intérêt'
                    : contract.interestType === 'percentage_once'
                    ? `${contract.interestRate}% unique`
                    : `${contract.interestRate}% / mois simple`}
                </span>
              </div>
            </div>

            {/* Parties */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Lender */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">
                  Prêteur
                </span>
                <p className="font-bold text-white">{contract.lender.fullName}</p>
                <p className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-500" />
                  {contract.lender.phone}
                </p>
                <p className="text-[11px] text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-500" />
                  {contract.lender.address}
                </p>
              </div>

              {/* Borrower */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
                  Emprunteur
                </span>
                <p className="font-bold text-white">{contract.borrower.fullName}</p>
                <p className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-500" />
                  {contract.borrower.phone}
                </p>
                <p className="text-[11px] text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-500" />
                  {contract.borrower.address}
                </p>
              </div>
            </div>

            {/* SHA-256 fingerprint box */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Empreinte cryptographique SHA-256</span>
                </span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(contract.contentDigest)}
                  className="text-amber-400 hover:underline flex items-center gap-0.5 text-[10px]"
                >
                  <Copy className="w-2.5 h-2.5" />
                  <span>Copier</span>
                </button>
              </div>
              <p className="font-mono text-[9px] text-slate-400 break-all bg-slate-900 p-2 rounded-lg border border-slate-800 select-all">
                {contract.contentDigest}
              </p>
            </div>

            {/* Signatures preview */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-xs font-semibold text-slate-300 block">Signatures apposées</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="bg-white rounded-lg p-1.5 flex flex-col items-center">
                  <span className="text-[9px] text-slate-500 font-bold">Prêteur</span>
                  <img
                    src={contract.lenderSignature}
                    alt="Signature Prêteur"
                    className="h-10 object-contain"
                  />
                </div>
                <div className="bg-white rounded-lg p-1.5 flex flex-col items-center">
                  <span className="text-[9px] text-slate-500 font-bold">Emprunteur</span>
                  <img
                    src={contract.borrowerSignature}
                    alt="Signature Emprunteur"
                    className="h-10 object-contain"
                  />
                </div>
                {contract.witnessSignature && (
                  <div className="bg-white rounded-lg p-1.5 flex flex-col items-center">
                    <span className="text-[9px] text-slate-500 font-bold">Témoin</span>
                    <img
                      src={contract.witnessSignature}
                      alt="Signature Témoin"
                      className="h-10 object-contain"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Actions Bar */}
            <div className="pt-2 space-y-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleShareContract}
                  className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 text-xs"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Partager le PDF officiel</span>
                </button>

                {contract.status !== 'cancelled' && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAmendment(contract);
                    }}
                    className="py-3 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition cursor-pointer flex items-center gap-1.5 text-xs"
                    title="Ajouter des fonds avec un avenant"
                  >
                    <PlusCircle className="w-4 h-4 text-emerald-400" />
                    <span>Avenant</span>
                  </button>
                )}
              </div>

              {contract.status !== 'cancelled' && !showCancelPrompt && (
                <button
                  type="button"
                  onClick={() => setShowCancelPrompt(true)}
                  className="w-full text-center text-[11px] text-rose-400/80 hover:text-rose-300 transition py-1 cursor-pointer"
                >
                  Annuler ce contrat (avec trace horodatée)...
                </button>
              )}

              {showCancelPrompt && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-2">
                  <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    Confirmation de l'annulation
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Le contrat restera archivé avec son empreinte SHA-256 mais sera marqué comme annulé.
                  </p>
                  <input
                    type="text"
                    required
                    placeholder="Motif de l'annulation (ex: accord amiable, erreur de saisie)"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-600 focus:outline-none text-xs"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowCancelPrompt(false)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs"
                    >
                      Retour
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing || !cancelReason.trim()}
                      onClick={handleConfirmCancel}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs disabled:opacity-50"
                    >
                      Confirmer l'annulation
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: FULL TEXT */}
        {activeTab === 'text' && (
          <div className="overflow-y-auto py-3 space-y-3 flex-1 text-xs pr-1">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 whitespace-pre-line font-serif text-[12px] leading-relaxed text-slate-200 select-text">
              {contract.contractText}
            </div>
            <button
              type="button"
              onClick={handleShareContract}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Partager le PDF du contrat</span>
            </button>
          </div>
        )}

        {/* TAB 3: AMENDMENTS */}
        {activeTab === 'amendments' && (
          <div className="overflow-y-auto py-3 space-y-3 flex-1 text-xs pr-1">
            {(!contract.amendments || contract.amendments.length === 0) ? (
              <div className="p-8 text-center space-y-2">
                <FileText className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-slate-400 font-medium">Aucun avenant pour ce contrat</p>
                <p className="text-[11px] text-slate-500">
                  Toute somme supplémentaire remise à l'emprunteur doit faire l'objet d'un avenant officiel.
                </p>
                {contract.status !== 'cancelled' && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAmendment(contract);
                    }}
                    className="mt-3 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold inline-flex items-center gap-1.5 cursor-pointer text-xs"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Créer un avenant</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {contract.status !== 'cancelled' && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAmendment(contract);
                    }}
                    className="w-full py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 font-bold flex items-center justify-center gap-2 cursor-pointer text-xs"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Ajouter un nouvel avenant</span>
                  </button>
                )}

                {contract.amendments.map((am) => (
                  <div
                    key={am.id}
                    className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs">
                            Avenant N° {am.amendmentNumber}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                            + {am.addedAmount.toLocaleString('fr-FR')} {currencySymbol}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Remis le {new Date(am.date).toLocaleDateString('fr-FR')} • {am.reason}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleShareAmendment(am)}
                        className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-800 transition cursor-pointer"
                        title="Partager cet avenant PDF"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-slate-400 border-t border-slate-900 pt-2">
                      <span>Nouveau total</span>
                      <span className="font-bold text-amber-400">
                        {am.newPrincipalTotal.toLocaleString('fr-FR')} {currencySymbol}
                      </span>
                    </div>

                    <div className="text-[9px] font-mono text-slate-500 truncate">
                      SHA-256 : {am.contentDigest}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
