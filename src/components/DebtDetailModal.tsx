import React, { useState } from 'react';
import {
  X,
  Phone,
  Calendar,
  AlertCircle,
  Plus,
  Trash2,
  Edit2,
  MessageSquare,
  Image as ImageIcon,
  Receipt,
  Check,
  CalendarPlus,
  FileCheck2,
  Download,
  RotateCcw,
  FileX,
  Coins,
} from 'lucide-react';
import { Debt } from '../types/debt';
import { Contract } from '../types/contract';
import { getDebtSummary, formatCurrencyValue } from '../utils/debtCalculations';
import { downloadIcsFile } from '../utils/icsGenerator';
import { generateContractPdf, shareOrDownloadContractPdf } from '../utils/pdfGenerator';
import { WhatsAppModal } from './WhatsAppModal';
import { ProofPhotoViewer } from './ProofPhotoViewer';

interface DebtDetailModalProps {
  debt: Debt;
  contract?: Contract | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddRepayment: (debtId: string, payment: { amount: number; date: string; note?: string }) => Promise<void>;
  onDeleteRepayment: (debtId: string, repaymentId: string) => Promise<void>;
  onAddMoney?: (debtId: string, addition: { amount: number; date: string; reason: string }) => Promise<void>;
  onDeleteAddition?: (debtId: string, additionId: string) => Promise<void>;
  onOpenAmendmentForDebt?: (contract: Contract, debt: Debt) => void;
  onRetryAsNewDebt?: (debt: Debt) => void;
}

export const DebtDetailModal: React.FC<DebtDetailModalProps> = ({
  debt,
  contract,
  onClose,
  onEdit,
  onDelete,
  onAddRepayment,
  onDeleteRepayment,
  onAddMoney,
  onDeleteAddition,
  onOpenAmendmentForDebt,
  onRetryAsNewDebt,
}) => {
  const summary = getDebtSummary(debt);

  // States
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);

  // Repayment form state
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Add money form state
  const [isAddingMoney, setIsAddingMoney] = useState(false);
  const [additionAmount, setAdditionAmount] = useState('');
  const [additionDate, setAdditionDate] = useState(new Date().toISOString().split('T')[0]);
  const [additionReason, setAdditionReason] = useState('');
  const [additionError, setAdditionError] = useState<string | null>(null);
  const [isSubmittingAddition, setIsSubmittingAddition] = useState(false);

  const [confirmDeleteDebt, setConfirmDeleteDebt] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Calculations for additions
  const totalAdditions = (debt.additions || []).reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  const initialCapital = Math.max(0, summary.capital - totalAdditions);

  const handleSettleRemaining = () => {
    setIsAddingPayment(true);
    setIsAddingMoney(false);
    setPaymentAmount(String(summary.remainingBalance));
  };

  const handleDownloadPdf = async () => {
    if (!contract) return;
    const doc = generateContractPdf(contract);
    const filename = `contrat-${contract.contractNumber}.pdf`;
    const title = `Contrat de prêt ${contract.contractNumber} - ${contract.borrower.fullName}`;
    const res = await shareOrDownloadContractPdf(doc, filename, title);
    setActionFeedback(res === 'shared' ? 'Contrat partagé avec succès.' : 'Contrat PDF téléchargé.');
    setTimeout(() => setActionFeedback(null), 3000);
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError(null);

    const amountNum = parseFloat(paymentAmount);
    if (!amountNum || amountNum <= 0) {
      setPaymentError('Veuillez entrer un montant supérieur à 0.');
      return;
    }

    setIsSubmittingPayment(true);
    try {
      await onAddRepayment(debt.id, {
        amount: amountNum,
        date: paymentDate,
        note: paymentNote.trim() || undefined,
      });
      setIsAddingPayment(false);
      setPaymentAmount('');
      setPaymentNote('');
      setActionFeedback(`Remboursement de ${formatCurrencyValue(amountNum, debt.currency)} enregistré.`);
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (err: unknown) {
      setPaymentError((err as Error)?.message || "Erreur lors de l'enregistrement du remboursement.");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleSaveAddition = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdditionError(null);

    const amountNum = parseFloat(additionAmount);
    if (!amountNum || amountNum <= 0) {
      setAdditionError('Veuillez entrer un montant supérieur à 0.');
      return;
    }

    if (!additionReason.trim()) {
      setAdditionError('Veuillez préciser la note associée (raison de cet ajout d’argent).');
      return;
    }

    setIsSubmittingAddition(true);
    try {
      if (onAddMoney) {
        await onAddMoney(debt.id, {
          amount: amountNum,
          date: additionDate,
          reason: additionReason.trim(),
        });
      }
      setIsAddingMoney(false);
      setAdditionAmount('');
      setAdditionReason('');
      setActionFeedback(`Ajout de ${formatCurrencyValue(amountNum, debt.currency)} enregistré avec succès.`);
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (err: unknown) {
      setAdditionError((err as Error)?.message || "Erreur lors de l'ajout d'argent.");
    } finally {
      setIsSubmittingAddition(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Non renseignée';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4">
        <div className="w-full max-w-xl rounded-t-[16px] sm:rounded-[16px] bg-[#1C232D] border border-[#2A3340] p-5 text-[#ECE9E2] max-h-[92vh] flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between pb-3 border-b border-[#2A3340]">
            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-xs px-2 py-0.5 rounded-[4px] bg-[#151A22] text-[#ECE9E2] border border-[#2A3340]">
                  {debt.type === 'on_me_doit' ? 'On me doit' : 'Je dois'}
                </span>

                {contract ? (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-[4px] bg-[#151A22] text-[#C8A96A] border border-[#2A3340]">
                    <FileCheck2 className="w-3.5 h-3.5" />
                    <span>Contrat signé</span>
                  </span>
                ) : debt.isUnsigned ? (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-[4px] bg-[#151A22] text-[#98A2B0] border border-[#2A3340]">
                    <FileX className="w-3.5 h-3.5" />
                    <span>Non signée</span>
                  </span>
                ) : null}

                {/* Status Dot + Word */}
                {summary.isSettled ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-[#5FB48C]">
                    <span className="w-2 h-2 rounded-full bg-[#5FB48C]" />
                    Soldée
                  </span>
                ) : summary.isOverdue ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-[#E5604D]">
                    <span className="w-2 h-2 rounded-full bg-[#E5604D]" />
                    En retard
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs text-[#98A2B0]">
                    <span className="w-2 h-2 rounded-full bg-[#98A2B0]" />
                    En cours
                  </span>
                )}
              </div>

              <h2 className="text-xl font-semibold text-[#ECE9E2] tracking-tight">{debt.personName}</h2>
              {debt.phoneNumber && (
                <p className="text-sm text-[#98A2B0] flex items-center gap-1.5 mt-0.5">
                  <Phone className="w-3.5 h-3.5 text-[#98A2B0]" />
                  <span>{debt.phoneNumber}</span>
                </p>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onEdit}
                className="w-11 h-11 rounded-[8px] bg-[#151A22] hover:bg-[#252F3D] text-[#ECE9E2] border border-[#2A3340] flex items-center justify-center transition cursor-pointer"
                title="Modifier la dette"
                aria-label="Modifier"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-11 h-11 rounded-[8px] bg-[#151A22] hover:bg-[#252F3D] text-[#ECE9E2] border border-[#2A3340] flex items-center justify-center transition cursor-pointer"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Feedback banner */}
          {actionFeedback && (
            <div className="mt-2 p-2.5 rounded-[8px] bg-[#151A22] border border-[#5FB48C] text-[#5FB48C] text-sm font-medium text-center">
              {actionFeedback}
            </div>
          )}

          {/* Scrollable Content */}
          <div className="overflow-y-auto py-4 space-y-4 flex-1 pr-1">
            {/* Primary Remaining Balance Card (no gradient, clean dark register) */}
            <div className="p-4 rounded-[8px] bg-[#151A22] border border-[#2A3340]">
              <div className="flex items-center justify-between text-xs text-[#98A2B0] mb-1">
                <span>Solde restant :</span>
                <span className="tabular-nums">{summary.repaymentProgressPercent}% réglé</span>
              </div>
              <div className="flex items-baseline justify-between mb-3">
                <span
                  className={`text-[28px] leading-tight font-semibold tabular-nums ${
                    summary.isSettled
                      ? 'text-[#5FB48C] line-through opacity-75'
                      : summary.isOverdue
                      ? 'text-[#E5604D]'
                      : 'text-[#ECE9E2]'
                  }`}
                >
                  {formatCurrencyValue(summary.remainingBalance, debt.currency)}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-[4px] bg-[#1C232D] text-[#98A2B0] border border-[#2A3340]">
                  Devise : {debt.currency}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-1.5 rounded-full bg-[#1C232D] overflow-hidden mb-3">
                <div
                  className="h-full bg-[#5FB48C] rounded-full transition-all"
                  style={{ width: `${summary.repaymentProgressPercent}%` }}
                />
              </div>

              {/* Breakdown Grid */}
              <div className={`grid ${totalAdditions > 0 ? 'grid-cols-4' : 'grid-cols-3'} gap-2 pt-3 border-t border-[#2A3340] text-xs`}>
                <div>
                  <div className="text-xs text-[#98A2B0]">
                    {totalAdditions > 0 ? 'Cap. initial' : 'Capital'}
                  </div>
                  <div className="text-sm font-semibold text-[#ECE9E2] tabular-nums mt-0.5">
                    {formatCurrencyValue(totalAdditions > 0 ? initialCapital : summary.capital, debt.currency)}
                  </div>
                </div>

                {totalAdditions > 0 && (
                  <div>
                    <div className="text-xs text-[#C8A96A]">Ajouts</div>
                    <div className="text-sm font-semibold text-[#C8A96A] tabular-nums mt-0.5">
                      +{formatCurrencyValue(totalAdditions, debt.currency)}
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-xs text-[#98A2B0]">Intérêts</div>
                  <div className="text-sm font-semibold text-[#C8A96A] tabular-nums mt-0.5">
                    +{formatCurrencyValue(summary.interest, debt.currency)}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-[#98A2B0]">Total dû</div>
                  <div className="text-sm font-semibold text-[#ECE9E2] tabular-nums mt-0.5">
                    {formatCurrencyValue(summary.totalDue, debt.currency)}
                  </div>
                </div>
              </div>

              {summary.interest > 0 && (
                <div className="mt-2.5 text-xs text-[#98A2B0] bg-[#1C232D] p-2 rounded-[6px] border border-[#2A3340]">
                  Formule appliquée : <strong className="text-[#ECE9E2] font-medium">{summary.interestFormula}</strong>
                </div>
              )}

              {/* Quick Action Buttons: Ajouter de l'argent & Remboursement */}
              <div className="grid grid-cols-2 gap-2 mt-3.5 pt-3 border-t border-[#2A3340]">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingMoney(true);
                    setIsAddingPayment(false);
                    setAdditionError(null);
                  }}
                  className={`min-h-[44px] py-2 px-3 rounded-[8px] border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    isAddingMoney
                      ? 'bg-[#C8A96A] text-[#151A22] border-[#C8A96A]'
                      : 'bg-[#1C232D] hover:bg-[#252F3D] text-[#C8A96A] border-[#2A3340]'
                  }`}
                >
                  <Coins className="w-4 h-4" />
                  <span>Ajouter de l'argent</span>
                </button>

                {!summary.isSettled ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingPayment(true);
                      setIsAddingMoney(false);
                      setPaymentError(null);
                    }}
                    className={`min-h-[44px] py-2 px-3 rounded-[8px] border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      isAddingPayment
                        ? 'bg-[#5FB48C] text-[#151A22] border-[#5FB48C]'
                        : 'bg-[#1C232D] hover:bg-[#252F3D] text-[#5FB48C] border-[#2A3340]'
                    }`}
                  >
                    <Receipt className="w-4 h-4" />
                    <span>Remboursement</span>
                  </button>
                ) : (
                  <div className="flex items-center justify-center text-xs text-[#5FB48C] font-medium border border-[#2A3340] rounded-[8px] bg-[#1C232D]">
                    Dette soldée
                  </div>
                )}
              </div>
            </div>

            {/* FORMULAIRE : AJOUTER DE L'ARGENT AVEC NOTE ASSOCIÉE */}
            {isAddingMoney && (
              <form
                onSubmit={handleSaveAddition}
                className="p-3.5 rounded-[8px] bg-[#151A22] border border-[#C8A96A] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-[#C8A96A]" />
                    <span className="text-sm font-semibold text-[#ECE9E2]">
                      Ajouter de l'argent à cette dette
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddingMoney(false)}
                    className="text-xs text-[#98A2B0] hover:text-[#ECE9E2] cursor-pointer"
                  >
                    Fermer
                  </button>
                </div>

                <p className="text-xs text-[#98A2B0]">
                  La somme ajoutée augmentera le capital dû et sera consignée avec sa note explicative (raison).
                </p>

                {contract && contract.status !== 'cancelled' && (
                  <div className="p-2.5 rounded-[6px] bg-[#1C232D] border border-[#2A3340] text-xs text-[#98A2B0] flex items-center justify-between gap-2">
                    <span>Liée au Contrat N° {contract.contractNumber}</span>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenAmendmentForDebt?.(contract, debt);
                      }}
                      className="text-xs text-[#C8A96A] font-semibold hover:underline cursor-pointer shrink-0"
                    >
                      Établir un avenant officiel &rarr;
                    </button>
                  </div>
                )}

                {additionError && (
                  <div className="text-xs text-[#E5604D] flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{additionError}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-[#ECE9E2] font-semibold mb-1">
                      Montant ({debt.currency}) <span className="text-[#E5604D]">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      autoFocus
                      value={additionAmount}
                      onChange={(e) => setAdditionAmount(e.target.value)}
                      placeholder="0"
                      className="w-full min-h-[44px] px-3 py-2 text-sm bg-[#1C232D] border border-[#2A3340] rounded-[8px] text-[#ECE9E2] font-semibold tabular-nums focus:outline-none focus:border-[#C8A96A]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#ECE9E2] font-semibold mb-1">
                      Date de remise <span className="text-[#E5604D]">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={additionDate}
                      onChange={(e) => setAdditionDate(e.target.value)}
                      className="w-full min-h-[44px] px-3 py-2 text-sm bg-[#1C232D] border border-[#2A3340] rounded-[8px] text-[#ECE9E2] focus:outline-none focus:border-[#C8A96A]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-[#ECE9E2] font-semibold mb-1">
                    Note associée (raison) <span className="text-[#E5604D]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={additionReason}
                    onChange={(e) => setAdditionReason(e.target.value)}
                    placeholder="Ex : Avance pour réapprovisionnement, frais médicaux, etc."
                    className="w-full min-h-[44px] px-3 py-2 text-sm bg-[#1C232D] border border-[#2A3340] rounded-[8px] text-[#ECE9E2] placeholder-[#98A2B0] focus:outline-none focus:border-[#C8A96A]"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingMoney(false)}
                    className="flex-1 min-h-[44px] py-2 rounded-[8px] bg-[#1C232D] text-sm font-medium text-[#98A2B0] hover:text-[#ECE9E2] border border-[#2A3340] cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingAddition}
                    className="flex-1 min-h-[44px] py-2 rounded-[8px] bg-[#C8A96A] hover:bg-[#bfa05f] text-sm font-semibold text-[#151A22] flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isSubmittingAddition ? 'Enregistrement...' : "Valider l'ajout d'argent"}</span>
                  </button>
                </div>
              </form>
            )}

            {/* FORMULAIRE : ENREGISTRER UN REMBOURSEMENT */}
            {isAddingPayment && (
              <form
                onSubmit={handleSavePayment}
                className="p-3.5 rounded-[8px] bg-[#151A22] border border-[#5FB48C] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-[#5FB48C]" />
                    <span className="text-sm font-semibold text-[#ECE9E2]">Enregistrer un remboursement</span>
                  </div>
                  {summary.remainingBalance > 0 && (
                    <button
                      type="button"
                      onClick={handleSettleRemaining}
                      className="text-xs text-[#5FB48C] hover:underline cursor-pointer"
                    >
                      Solder le reste ({formatCurrencyValue(summary.remainingBalance, debt.currency)})
                    </button>
                  )}
                </div>

                {paymentError && (
                  <div className="text-xs text-[#E5604D] flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{paymentError}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-[#ECE9E2] font-semibold mb-1">
                      Montant ({debt.currency}) <span className="text-[#E5604D]">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      autoFocus
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder="0"
                      className="w-full min-h-[44px] px-3 py-2 text-sm bg-[#1C232D] border border-[#2A3340] rounded-[8px] text-[#ECE9E2] font-semibold tabular-nums focus:outline-none focus:border-[#5FB48C]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#ECE9E2] font-semibold mb-1">
                      Date <span className="text-[#E5604D]">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full min-h-[44px] px-3 py-2 text-sm bg-[#1C232D] border border-[#2A3340] rounded-[8px] text-[#ECE9E2] focus:outline-none focus:border-[#5FB48C]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-[#ECE9E2] font-semibold mb-1">Note / moyen de paiement</label>
                  <input
                    type="text"
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    placeholder="Ex: Espèces, M-Pesa, Airtel Money, virement"
                    className="w-full min-h-[44px] px-3 py-2 text-sm bg-[#1C232D] border border-[#2A3340] rounded-[8px] text-[#ECE9E2] placeholder-[#98A2B0] focus:outline-none focus:border-[#5FB48C]"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingPayment(false)}
                    className="flex-1 min-h-[44px] py-2 rounded-[8px] bg-[#1C232D] text-sm font-medium text-[#98A2B0] hover:text-[#ECE9E2] border border-[#2A3340] cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingPayment}
                    className="flex-1 min-h-[44px] py-2 rounded-[8px] bg-[#5FB48C] hover:bg-[#4ea27a] text-sm font-semibold text-[#151A22] flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isSubmittingPayment ? 'Enregistrement...' : 'Valider'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* SECTION: AJOUTS D'ARGENT / HISTORIQUE DU CAPITAL */}
            {debt.additions && debt.additions.length > 0 && (
              <div className="space-y-2.5 pt-2 border-t border-[#2A3340]">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#ECE9E2] flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-[#C8A96A]" />
                    Ajouts d'argent ({debt.additions.length})
                  </h3>
                  <span className="text-xs text-[#C8A96A] font-semibold tabular-nums">
                    Total ajouté : +{formatCurrencyValue(totalAdditions, debt.currency)}
                  </span>
                </div>

                <div className="rounded-[8px] bg-[#151A22] border border-[#2A3340] divide-y divide-[#2A3340] overflow-hidden">
                  {debt.additions
                    .slice()
                    .sort((a, b) => (b.date > a.date ? 1 : -1))
                    .map((addition) => (
                      <div
                        key={addition.id}
                        className="px-3.5 py-2.5 flex items-start justify-between text-xs gap-2"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-[#C8A96A] tabular-nums">
                              +{formatCurrencyValue(addition.amount, debt.currency)}
                            </span>
                            <span className="text-xs text-[#98A2B0]">
                              remis le {formatDate(addition.date)}
                            </span>
                          </div>
                          <div className="text-xs text-[#ECE9E2] mt-0.5 break-words">
                            <span className="text-[#98A2B0]">Raison :</span> {addition.reason}
                          </div>
                        </div>

                        {onDeleteAddition && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm("Supprimer cet ajout d'argent et déduire la somme du capital ?")) {
                                onDeleteAddition(debt.id, addition.id);
                              }
                            }}
                            className="w-10 h-10 rounded-[8px] text-[#98A2B0] hover:text-[#E5604D] flex items-center justify-center transition cursor-pointer shrink-0"
                            title="Supprimer cet ajout"
                            aria-label="Supprimer ajout"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* CONTRACT ACTIONS SECTION */}
            {contract ? (
              <div className="p-3.5 rounded-[8px] bg-[#151A22] border border-[#2A3340] text-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-[#C8A96A]" />
                    <div>
                      <span className="font-semibold text-[#ECE9E2] block text-sm">
                        Contrat {contract.contractNumber}
                      </span>
                      <span className="text-xs text-[#98A2B0]">
                        Signé le {contract.signedAt} · Verrouillé
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-[#5FB48C] px-2 py-0.5 rounded-[4px] bg-[#1C232D] border border-[#2A3340]">
                    Conforme
                  </span>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    className="flex-1 min-h-[44px] py-2 px-3 rounded-[8px] bg-[#C8A96A] hover:bg-[#bfa05f] text-[#151A22] font-semibold text-sm transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Télécharger le contrat (PDF)</span>
                  </button>

                  {contract.status !== 'cancelled' && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenAmendmentForDebt?.(contract, debt);
                      }}
                      className="min-h-[44px] py-2 px-3 rounded-[8px] bg-[#1C232D] hover:bg-[#252F3D] text-[#ECE9E2] font-medium text-sm border border-[#2A3340] transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Avenant</span>
                    </button>
                  )}
                </div>
              </div>
            ) : debt.isUnsigned ? (
              <div className="p-3.5 rounded-[8px] bg-[#151A22] border border-[#2A3340] space-y-2 text-xs">
                <div className="flex items-center gap-2 text-[#ECE9E2]">
                  <FileX className="w-4 h-4 text-[#C8A96A] shrink-0" />
                  <span className="font-semibold text-sm">Dette enregistrée sans signature</span>
                </div>
                <p className="text-xs text-[#98A2B0] leading-relaxed">
                  Cette dette a été créée sans signature. Vous pouvez ressaisir un nouveau contrat pré-rempli.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onRetryAsNewDebt?.(debt);
                  }}
                  className="w-full min-h-[44px] py-2 px-3 rounded-[8px] bg-[#1C232D] hover:bg-[#252F3D] text-[#ECE9E2] font-semibold text-sm border border-[#2A3340] transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Ressaisir avec contrat</span>
                </button>
              </div>
            ) : null}

            {/* Dates & Due Information */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-[8px] bg-[#151A22] border border-[#2A3340]">
                <div className="text-xs text-[#98A2B0] flex items-center gap-1.5 mb-1">
                  <Calendar className="w-3.5 h-3.5 text-[#98A2B0]" />
                  <span>Date de début</span>
                </div>
                <div className="text-sm font-medium text-[#ECE9E2]">{formatDate(debt.startDate)}</div>
              </div>

              <div
                className={`p-3 rounded-[8px] border ${
                  summary.isOverdue
                    ? 'bg-[#151A22] border-[#E5604D]'
                    : 'bg-[#151A22] border-[#2A3340]'
                }`}
              >
                <div className="text-xs text-[#98A2B0] flex items-center gap-1.5 mb-1">
                  <Calendar className="w-3.5 h-3.5 text-[#98A2B0]" />
                  <span>Date d'échéance</span>
                </div>
                <div className={`text-sm font-medium ${summary.isOverdue ? 'text-[#E5604D]' : 'text-[#ECE9E2]'}`}>
                  {formatDate(debt.dueDate)}
                </div>
                {summary.isOverdue && (
                  <div className="text-xs text-[#E5604D] mt-1">Délai dépassé</div>
                )}
              </div>
            </div>

            {debt.dueDate && (
              <button
                type="button"
                onClick={() => {
                  downloadIcsFile({
                    id: debt.id,
                    kind: 'debt_due',
                    title: `${debt.type === 'on_me_doit' ? 'À percevoir de' : 'À rembourser à'} ${debt.personName}`,
                    date: debt.dueDate,
                    debtId: debt.id,
                    debtType: debt.type,
                    personName: debt.personName,
                    amountFormatted: formatCurrencyValue(summary.remainingBalance, debt.currency),
                    note: debt.reason,
                    isOverdue: summary.isOverdue,
                    isToday: false,
                    isTomorrow: false,
                    isThisWeek: false,
                    isCompleted: summary.isSettled,
                  });
                }}
                className="w-full min-h-[44px] py-2 px-3 rounded-[8px] bg-[#151A22] hover:bg-[#1C232D] text-xs font-medium text-[#ECE9E2] border border-[#2A3340] flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <CalendarPlus className="w-4 h-4 text-[#C8A96A]" />
                <span>Ajouter à l'agenda du téléphone (.ics)</span>
              </button>
            )}

            {/* Reason / Free Note */}
            {debt.reason && (
              <div className="p-3 rounded-[8px] bg-[#151A22] border border-[#2A3340] text-xs">
                <div className="text-xs text-[#98A2B0] mb-1">Motif / Note d'origine</div>
                <p className="text-sm text-[#ECE9E2] whitespace-pre-wrap">{debt.reason}</p>
              </div>
            )}

            {/* Proof Photo thumbnail */}
            {debt.proofPhoto && (
              <div className="p-3 rounded-[8px] bg-[#151A22] border border-[#2A3340] space-y-2">
                <div className="flex items-center justify-between text-xs text-[#98A2B0]">
                  <span className="flex items-center gap-1.5 font-medium text-[#ECE9E2]">
                    <ImageIcon className="w-4 h-4 text-[#98A2B0]" /> Photo de preuve
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPhotoViewer(true)}
                    className="text-xs text-[#C8A96A] hover:underline cursor-pointer"
                  >
                    Agrandir l'image
                  </button>
                </div>
                <div
                  onClick={() => setShowPhotoViewer(true)}
                  className="rounded-[8px] overflow-hidden border border-[#2A3340] bg-[#151A22] max-h-40 cursor-pointer hover:border-[#98A2B0] transition flex items-center justify-center"
                >
                  <img
                    src={debt.proofPhoto}
                    alt="Preuve"
                    className="max-h-40 w-full object-contain"
                  />
                </div>
              </div>
            )}

            {/* Partial Repayments Section */}
            <div className="space-y-3 pt-2 border-t border-[#2A3340]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[#ECE9E2] flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-[#98A2B0]" />
                    Remboursements partiels ({debt.repayments?.length || 0})
                  </h3>
                  <p className="text-xs text-[#98A2B0] tabular-nums">
                    Total remboursé : {formatCurrencyValue(summary.totalRepaid, debt.currency)}
                  </p>
                </div>

                {!summary.isSettled && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingPayment(true);
                      setIsAddingMoney(false);
                      setPaymentError(null);
                    }}
                    className="min-h-[44px] px-3 py-2 rounded-[8px] bg-[#151A22] hover:bg-[#252F3D] text-[#5FB48C] border border-[#2A3340] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Ajouter un paiement</span>
                  </button>
                )}
              </div>

              {/* Payments History List */}
              {debt.repayments && debt.repayments.length > 0 ? (
                <div className="rounded-[8px] bg-[#151A22] border border-[#2A3340] divide-y divide-[#2A3340] overflow-hidden">
                  {debt.repayments
                    .slice()
                    .sort((a, b) => (b.date > a.date ? 1 : -1))
                    .map((payment) => (
                      <div
                        key={payment.id}
                        className="px-3.5 py-2.5 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="text-sm font-semibold text-[#5FB48C] tabular-nums">
                            -{formatCurrencyValue(payment.amount, debt.currency)}
                          </div>
                          <div className="text-xs text-[#98A2B0] mt-0.5">
                            {formatDate(payment.date)}
                            {payment.note && <span className="text-[#ECE9E2]"> · {payment.note}</span>}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm('Supprimer ce remboursement ?')) {
                              onDeleteRepayment(debt.id, payment.id);
                            }
                          }}
                          className="w-11 h-11 rounded-[8px] text-[#98A2B0] hover:text-[#E5604D] flex items-center justify-center transition cursor-pointer"
                          title="Supprimer ce versement"
                          aria-label="Supprimer versement"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="p-3 text-center rounded-[8px] bg-[#151A22] border border-[#2A3340] text-xs text-[#98A2B0]">
                  Aucun remboursement enregistré pour le moment.
                </div>
              )}
            </div>

            {/* Delete Debt Confirmation Box */}
            {confirmDeleteDebt ? (
              <div className="p-3.5 rounded-[8px] bg-[#151A22] border border-[#E5604D] space-y-2">
                <p className="text-sm font-semibold text-[#E5604D]">
                  Confirmer la suppression de cette dette ?
                </p>
                <p className="text-xs text-[#98A2B0]">
                  Cette action est définitive et effacera l'ensemble des remboursements et ajouts associés.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteDebt(false)}
                    className="flex-1 min-h-[44px] py-2 rounded-[8px] bg-[#1C232D] text-xs text-[#98A2B0] hover:text-[#ECE9E2] border border-[#2A3340]"
                  >
                    Conserver
                  </button>
                  <button
                    type="button"
                    onClick={onDelete}
                    className="flex-1 min-h-[44px] py-2 rounded-[8px] bg-[#E5604D] hover:bg-rose-600 text-xs font-semibold text-white"
                  >
                    Confirmer la suppression
                  </button>
                </div>
              </div>
            ) : (
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteDebt(true)}
                  className="min-h-[44px] px-3 py-2 text-xs text-[#E5604D] hover:underline flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Supprimer cette dette</span>
                </button>
              </div>
            )}
          </div>

          {/* Footer Primary WhatsApp Button */}
          <div className="pt-3 border-t border-[#2A3340]">
            <button
              type="button"
              onClick={() => setShowWhatsApp(true)}
              className="w-full min-h-[48px] py-3 rounded-[8px] bg-[#C8A96A] hover:bg-[#bfa05f] text-base font-semibold text-[#151A22] flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Rappeler par WhatsApp</span>
            </button>
          </div>
        </div>
      </div>

      {/* WhatsApp Modal */}
      {showWhatsApp && (
        <WhatsAppModal
          debt={debt}
          summary={summary}
          onClose={() => setShowWhatsApp(false)}
        />
      )}

      {/* Proof Photo Lightbox */}
      {showPhotoViewer && debt.proofPhoto && (
        <ProofPhotoViewer
          photoDataUrl={debt.proofPhoto}
          title={`Preuve - ${debt.personName}`}
          onClose={() => setShowPhotoViewer(false)}
        />
      )}
    </>
  );
};
