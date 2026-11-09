import React, { useState } from 'react';
import {
  X,
  FileText,
  Share2,
  Lock,
  Plus,
  AlertCircle,
  ShieldCheck,
  Copy,
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
  debt: _debt,
  onClose,
  onOpenAmendment,
  onContractUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'text' | 'amendments'>('details');
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const currencyLabel = contract.currency === 'USD' ? 'USD' : 'FC';

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full max-w-xl rounded-t-[16px] sm:rounded-[16px] bg-[#1C232D] border border-[#2A3340] p-4 sm:p-5 text-[#ECE9E2] max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2A3340]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[8px] bg-[#151A22] border border-[#2A3340] text-[#C8A96A] flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-[#ECE9E2]">N° {contract.contractNumber}</h2>
                {contract.status === 'cancelled' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-[#E5604D]">
                    <span className="w-2 h-2 rounded-full bg-[#E5604D]" />
                    Annulé
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] text-[#5FB48C]">
                    <span className="w-2 h-2 rounded-full bg-[#5FB48C]" />
                    Verrouillé
                  </span>
                )}
              </div>
              <p className="text-xs text-[#98A2B0]">
                Signé le {contract.signedAt} • {contract.borrower.fullName}
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

        {actionFeedback && (
          <div className="mt-3 p-3 rounded-[8px] bg-[#151A22] border border-[#5FB48C] text-[#5FB48C] text-xs font-medium text-center">
            {actionFeedback}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#2A3340] pt-2 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`min-h-[44px] px-3.5 border-b-2 font-medium transition cursor-pointer ${
              activeTab === 'details'
                ? 'border-[#C8A96A] text-[#ECE9E2] font-semibold'
                : 'border-transparent text-[#98A2B0] hover:text-[#ECE9E2]'
            }`}
          >
            Synthèse
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('text')}
            className={`min-h-[44px] px-3.5 border-b-2 font-medium transition cursor-pointer ${
              activeTab === 'text'
                ? 'border-[#C8A96A] text-[#ECE9E2] font-semibold'
                : 'border-transparent text-[#98A2B0] hover:text-[#ECE9E2]'
            }`}
          >
            Texte du contrat
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('amendments')}
            className={`min-h-[44px] px-3.5 border-b-2 font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'amendments'
                ? 'border-[#C8A96A] text-[#ECE9E2] font-semibold'
                : 'border-transparent text-[#98A2B0] hover:text-[#ECE9E2]'
            }`}
          >
            <span>Avenants</span>
            <span className="px-1.5 py-0.5 rounded-[4px] bg-[#151A22] border border-[#2A3340] text-[10px] text-[#98A2B0]">
              {contract.amendments?.length || 0}
            </span>
          </button>
        </div>

        {/* TAB 1: DETAILS */}
        {activeTab === 'details' && (
          <div className="overflow-y-auto py-3 space-y-3 flex-1 text-xs pr-1">
            {contract.status === 'cancelled' && (
              <div className="p-3 rounded-[8px] bg-[#151A22] border border-[#E5604D] text-[#E5604D] space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <Ban className="w-4 h-4" />
                  <span>Contrat annulé avec traçabilité</span>
                </div>
                <p className="text-xs text-[#ECE9E2]">
                  Motif : « {contract.cancellationReason} »
                </p>
                {contract.cancelledAt && (
                  <p className="text-[11px] text-[#98A2B0]">
                    Annulé le {new Date(contract.cancelledAt).toLocaleString('fr-FR')}
                  </p>
                )}
              </div>
            )}

            {/* Financial summary card */}
            <div className="p-4 rounded-[8px] bg-[#151A22] border border-[#2A3340] space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-sm text-[#98A2B0]">Capital prêté</span>
                <span className="text-20 font-semibold text-[#ECE9E2] tabular-nums">
                  {contract.principalAmount.toLocaleString('fr-FR')} {currencyLabel}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-[#98A2B0] border-t border-[#2A3340] pt-2">
                <span>Remboursement</span>
                <span className="text-[#ECE9E2]">
                  {contract.hasDueDate && contract.dueDate
                    ? `Échéance le ${new Date(contract.dueDate).toLocaleDateString('fr-FR')}`
                    : `Sur demande (préavis de ${contract.noticeDays || 7} jours)`}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-[#98A2B0] border-t border-[#2A3340] pt-2">
                <span>Régime d'intérêts</span>
                <span className="text-[#ECE9E2]">
                  {contract.interestType === 'none'
                    ? 'Aucun intérêt'
                    : contract.interestType === 'percentage_once'
                    ? `${contract.interestRate}% unique`
                    : `${contract.interestRate}% / mois`}
                </span>
              </div>
            </div>

            {/* Parties */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Lender */}
              <div className="p-3 rounded-[8px] bg-[#151A22] border border-[#2A3340] space-y-1">
                <span className="text-[11px] text-[#C8A96A] font-semibold block">
                  Prêteur
                </span>
                <p className="text-sm font-semibold text-[#ECE9E2]">{contract.lender.fullName}</p>
                <p className="text-xs text-[#98A2B0] flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" />
                  {contract.lender.phone}
                </p>
                <p className="text-xs text-[#98A2B0] flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {contract.lender.address}
                </p>
              </div>

              {/* Borrower */}
              <div className="p-3 rounded-[8px] bg-[#151A22] border border-[#2A3340] space-y-1">
                <span className="text-[11px] text-[#5FB48C] font-semibold block">
                  Emprunteur
                </span>
                <p className="text-sm font-semibold text-[#ECE9E2]">{contract.borrower.fullName}</p>
                <p className="text-xs text-[#98A2B0] flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" />
                  {contract.borrower.phone}
                </p>
                <p className="text-xs text-[#98A2B0] flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {contract.borrower.address}
                </p>
              </div>
            </div>

            {/* SHA-256 fingerprint box */}
            <div className="p-3 rounded-[8px] bg-[#151A22] border border-[#2A3340] space-y-1.5">
              <div className="flex items-center justify-between text-xs text-[#98A2B0]">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-[#5FB48C]" />
                  <span>Empreinte cryptographique SHA-256</span>
                </span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(contract.contentDigest)}
                  className="text-[#C8A96A] hover:underline flex items-center gap-1 text-xs"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copier</span>
                </button>
              </div>
              <p className="font-mono text-[11px] text-[#98A2B0] break-all bg-[#1C232D] p-2 rounded-[8px] border border-[#2A3340] select-all">
                {contract.contentDigest}
              </p>
            </div>

            {/* Signatures preview */}
            <div className="p-3 rounded-[8px] bg-[#151A22] border border-[#2A3340] space-y-2">
              <span className="text-xs font-semibold text-[#ECE9E2] block">Signatures apposées</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="bg-white rounded-[8px] p-2 flex flex-col items-center">
                  <span className="text-[11px] text-slate-600 font-semibold">Prêteur</span>
                  <img
                    src={contract.lenderSignature}
                    alt="Signature Prêteur"
                    className="h-10 object-contain"
                  />
                </div>
                <div className="bg-white rounded-[8px] p-2 flex flex-col items-center">
                  <span className="text-[11px] text-slate-600 font-semibold">Emprunteur</span>
                  <img
                    src={contract.borrowerSignature}
                    alt="Signature Emprunteur"
                    className="h-10 object-contain"
                  />
                </div>
                {contract.witnessSignature && (
                  <div className="bg-white rounded-[8px] p-2 flex flex-col items-center">
                    <span className="text-[11px] text-slate-600 font-semibold">Témoin</span>
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
                  className="flex-1 min-h-[44px] px-4 rounded-[8px] bg-[#C8A96A] hover:bg-[#d6b777] text-[#151A22] font-semibold transition cursor-pointer flex items-center justify-center gap-2 text-sm"
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
                    className="min-h-[44px] px-4 rounded-[8px] bg-[#151A22] hover:bg-[#2A3340] text-[#ECE9E2] border border-[#2A3340] font-semibold transition cursor-pointer flex items-center gap-1.5 text-xs"
                    title="Ajouter des fonds avec un avenant"
                  >
                    <Plus className="w-4 h-4 text-[#5FB48C]" />
                    <span>Avenant</span>
                  </button>
                )}
              </div>

              {contract.status !== 'cancelled' && !showCancelPrompt && (
                <button
                  type="button"
                  onClick={() => setShowCancelPrompt(true)}
                  className="w-full min-h-[44px] text-center text-xs text-[#E5604D] hover:underline transition cursor-pointer"
                >
                  Annuler ce contrat (avec trace horodatée)...
                </button>
              )}

              {showCancelPrompt && (
                <div className="p-3 rounded-[8px] bg-[#151A22] border border-[#E5604D] space-y-2">
                  <span className="text-xs font-semibold text-[#E5604D] flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    Confirmation de l'annulation
                  </span>
                  <p className="text-xs text-[#98A2B0]">
                    Le contrat restera archivé avec son empreinte SHA-256 mais sera marqué comme annulé.
                  </p>
                  <input
                    type="text"
                    required
                    placeholder="Motif de l'annulation (ex: accord amiable, erreur de saisie)"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-[8px] bg-[#1C232D] border border-[#2A3340] text-[#ECE9E2] placeholder-[#98A2B0] focus:outline-none text-xs"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowCancelPrompt(false)}
                      className="min-h-[44px] px-3.5 rounded-[8px] bg-[#1C232D] text-[#98A2B0] hover:text-[#ECE9E2] border border-[#2A3340] text-xs font-medium cursor-pointer"
                    >
                      Retour
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing || !cancelReason.trim()}
                      onClick={handleConfirmCancel}
                      className="min-h-[44px] px-4 rounded-[8px] bg-[#E5604D] hover:bg-[#eb7463] text-white font-semibold text-xs disabled:opacity-50 cursor-pointer"
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
            <div className="p-4 rounded-[8px] bg-[#151A22] border border-[#2A3340] whitespace-pre-line font-serif text-[13px] leading-relaxed text-[#ECE9E2] select-text">
              {contract.contractText}
            </div>
            <button
              type="button"
              onClick={handleShareContract}
              className="w-full min-h-[44px] rounded-[8px] bg-[#151A22] hover:bg-[#2A3340] text-[#ECE9E2] border border-[#2A3340] font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>Partager le PDF du contrat</span>
            </button>
          </div>
        )}

        {/* TAB 3: AMENDMENTS */}
        {activeTab === 'amendments' && (
          <div className="overflow-y-auto py-3 space-y-3 flex-1 text-xs pr-1">
            {(!contract.amendments || contract.amendments.length === 0) ? (
              <div className="p-8 text-center space-y-2">
                <FileText className="w-10 h-10 text-[#98A2B0] mx-auto" />
                <p className="text-[#ECE9E2] font-semibold">Aucun avenant pour ce contrat</p>
                <p className="text-xs text-[#98A2B0]">
                  Toute somme supplémentaire remise à l'emprunteur doit faire l'objet d'un avenant officiel.
                </p>
                {contract.status !== 'cancelled' && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAmendment(contract);
                    }}
                    className="mt-3 min-h-[44px] px-4 rounded-[8px] bg-[#C8A96A] hover:bg-[#d6b777] text-[#151A22] font-semibold inline-flex items-center gap-1.5 cursor-pointer text-xs"
                  >
                    <Plus className="w-4 h-4" />
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
                    className="w-full min-h-[44px] rounded-[8px] bg-[#151A22] hover:bg-[#2A3340] text-[#C8A96A] border border-[#2A3340] font-semibold flex items-center justify-center gap-2 cursor-pointer text-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Ajouter un nouvel avenant</span>
                  </button>
                )}

                {contract.amendments.map((am) => (
                  <div
                    key={am.id}
                    className="p-3.5 rounded-[8px] bg-[#151A22] border border-[#2A3340] space-y-2"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#ECE9E2] text-xs">
                            Avenant N° {am.amendmentNumber}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded-[4px] bg-[#1C232D] border border-[#2A3340] text-[#5FB48C] tabular-nums">
                            + {am.addedAmount.toLocaleString('fr-FR')} {currencyLabel}
                          </span>
                        </div>
                        <p className="text-xs text-[#98A2B0] mt-0.5">
                          Remis le {new Date(am.date).toLocaleDateString('fr-FR')} • {am.reason}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleShareAmendment(am)}
                        className="min-h-[44px] min-w-[44px] rounded-[8px] bg-[#1C232D] hover:bg-[#2A3340] text-[#ECE9E2] border border-[#2A3340] transition cursor-pointer flex items-center justify-center"
                        title="Partager cet avenant PDF"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex justify-between items-center text-xs text-[#98A2B0] border-t border-[#2A3340] pt-2">
                      <span>Nouveau total</span>
                      <span className="font-semibold text-[#ECE9E2] tabular-nums">
                        {am.newPrincipalTotal.toLocaleString('fr-FR')} {currencyLabel}
                      </span>
                    </div>

                    <div className="text-[10px] font-mono text-[#98A2B0] truncate">
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
