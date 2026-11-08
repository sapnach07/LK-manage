import React, { useState } from 'react';
import {
  X,
  Phone,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  Edit2,
  MessageSquare,
  Image as ImageIcon,
  Receipt,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  CalendarPlus,
  Lock,
  FileSignature,
  FileText,
} from 'lucide-react';
import { Debt, Repayment } from '../types/debt';
import { Contract } from '../types/contract';
import { getDebtSummary, formatCurrencyValue } from '../utils/debtCalculations';
import { downloadIcsFile } from '../utils/icsGenerator';
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
  onViewContract?: (contract: Contract) => void;
  onGenerateContractForDebt?: (debt: Debt) => void;
  onOpenAmendmentForDebt?: (contract: Contract, debt: Debt) => void;
}

export const DebtDetailModal: React.FC<DebtDetailModalProps> = ({
  debt,
  contract,
  onClose,
  onEdit,
  onDelete,
  onAddRepayment,
  onDeleteRepayment,
  onViewContract,
  onGenerateContractForDebt,
  onOpenAmendmentForDebt,
}) => {
  const summary = getDebtSummary(debt);

  // States
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [confirmDeleteDebt, setConfirmDeleteDebt] = useState(false);

  const handleSettleRemaining = () => {
    setIsAddingPayment(true);
    setPaymentAmount(String(summary.remainingBalance));
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError(null);

    const amountNum = parseFloat(paymentAmount);
    if (!amountNum || amountNum <= 0) {
      setPaymentError('Veuillez entrer un montant valide supérieur à 0.');
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
    } catch (err: any) {
      setPaymentError(err?.message || "Erreur lors de l'ajout du remboursement.");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Non renseignée';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xs p-0 sm:p-4">
        <div className="w-full max-w-xl rounded-t-3xl sm:rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl text-slate-100 max-h-[92vh] flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between pb-3 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    debt.type === 'on_me_doit'
                      ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-400'
                      : 'bg-amber-950/70 border border-amber-500/40 text-amber-400'
                  }`}
                >
                  {debt.type === 'on_me_doit' ? (
                    <>
                      <ArrowDownLeft className="w-3 h-3" /> On me doit
                    </>
                  ) : (
                    <>
                      <ArrowUpRight className="w-3 h-3" /> Je dois
                    </>
                  )}
                </span>

                {summary.isSettled ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3" /> Soldée
                  </span>
                ) : summary.isOverdue ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    <AlertCircle className="w-3 h-3" /> En retard
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                    <Clock className="w-3 h-3" /> En cours
                  </span>
                )}
              </div>

              <h2 className="text-xl font-bold text-white tracking-tight">{debt.personName}</h2>
              {debt.phoneNumber && (
                <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <Phone className="w-3 h-3 text-slate-500" />
                  <span>{debt.phoneNumber}</span>
                </p>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onEdit}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                title="Modifier cette dette"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="overflow-y-auto py-4 space-y-4 flex-1 pr-1">
            {/* Primary Remaining Balance Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-950 to-slate-900 border border-slate-800 shadow-inner">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Solde restant :</span>
                <span>{summary.repaymentProgressPercent}% remboursé</span>
              </div>
              <div className="flex items-baseline justify-between mb-3">
                <span
                  className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                    summary.isSettled
                      ? 'text-emerald-400'
                      : summary.isOverdue
                      ? 'text-rose-400'
                      : 'text-white'
                  }`}
                >
                  {formatCurrencyValue(summary.remainingBalance, debt.currency)}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                  Devise : {debt.currency}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden mb-3">
                <div
                  className={`h-full transition-all duration-300 ${
                    summary.isSettled
                      ? 'bg-emerald-500'
                      : debt.type === 'on_me_doit'
                      ? 'bg-emerald-500'
                      : 'bg-amber-500'
                  }`}
                  style={{ width: `${summary.repaymentProgressPercent}%` }}
                />
              </div>

              {/* Breakdown Grid */}
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800/80 text-xs">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">Capital</div>
                  <div className="font-semibold text-slate-200">
                    {formatCurrencyValue(summary.capital, debt.currency)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">Intérêts</div>
                  <div className="font-semibold text-amber-400">
                    +{formatCurrencyValue(summary.interest, debt.currency)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">Total Dû</div>
                  <div className="font-semibold text-white">
                    {formatCurrencyValue(summary.totalDue, debt.currency)}
                  </div>
                </div>
              </div>

              {summary.interest > 0 && (
                <div className="mt-2 text-[11px] text-slate-400 bg-slate-900/90 p-2 rounded-lg border border-slate-800/80">
                  Formule appliquée : <strong className="text-slate-200">{summary.interestFormula}</strong>
                </div>
              )}
            </div>

            {/* Contrat sous seing privé lié */}
            {contract ? (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/20 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileSignature className="w-4 h-4 text-amber-400" />
                    <div>
                      <span className="font-bold text-white block">
                        Contrat {contract.contractNumber}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Signé le {contract.signedAt} • Scellé
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-semibold flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" />
                    Verrouillé
                  </span>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onViewContract?.(contract);
                    }}
                    className="flex-1 py-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 font-semibold text-xs border border-slate-700 transition cursor-pointer flex items-center justify-center gap-1"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Consulter / Partager PDF</span>
                  </button>

                  {contract.status !== 'cancelled' && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenAmendmentForDebt?.(contract, debt);
                      }}
                      className="py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1 shadow-md shadow-amber-500/10"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Avenant</span>
                    </button>
                  )}
                </div>
              </div>
            ) : debt.type === 'on_me_doit' && onGenerateContractForDebt ? (
              <div className="p-3 rounded-2xl bg-slate-950 border border-dashed border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <FileSignature className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Aucun contrat officiel lié</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onGenerateContractForDebt(debt);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold text-[11px] transition cursor-pointer"
                >
                  Générer le contrat
                </button>
              </div>
            ) : null}

            {/* Dates & Reason Information */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="text-[10px] text-slate-500 flex items-center gap-1 mb-1">
                  <Calendar className="w-3 h-3" /> Date de début
                </div>
                <div className="font-medium text-slate-200">{formatDate(debt.startDate)}</div>
              </div>

              <div
                className={`p-3 rounded-xl border ${
                  summary.isOverdue
                    ? 'bg-rose-950/20 border-rose-800/50 text-rose-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-200'
                }`}
              >
                <div className="text-[10px] flex items-center gap-1 mb-1 opacity-70">
                  <Calendar className="w-3 h-3" /> Date d'échéance
                </div>
                <div className="font-medium">{formatDate(debt.dueDate)}</div>
                {summary.isOverdue && (
                  <div className="text-[10px] font-bold text-rose-400 mt-1">Délai dépassé !</div>
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
                className="w-full py-2 px-3 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 text-xs font-medium text-slate-300 border border-slate-800 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <CalendarPlus className="w-4 h-4 text-emerald-400" />
                <span>Ajouter l'échéance à l'agenda du téléphone (.ics)</span>
              </button>
            )}

            {/* Reason / Free Note */}
            {debt.reason && (
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Motif / Note</div>
                <p className="text-slate-300 whitespace-pre-wrap">{debt.reason}</p>
              </div>
            )}

            {/* Proof Photo thumbnail */}
            {debt.proofPhoto && (
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5 font-medium">
                    <ImageIcon className="w-3.5 h-3.5 text-slate-400" /> Photo de preuve
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPhotoViewer(true)}
                    className="text-[11px] text-emerald-400 hover:underline cursor-pointer"
                  >
                    Agrandir l'image
                  </button>
                </div>
                <div
                  onClick={() => setShowPhotoViewer(true)}
                  className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950 max-h-40 cursor-pointer hover:border-slate-700 transition flex items-center justify-center"
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
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-emerald-400" />
                    Remboursements partiels ({debt.repayments?.length || 0})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Total remboursé : {formatCurrencyValue(summary.totalRepaid, debt.currency)}
                  </p>
                </div>

                {!summary.isSettled && (
                  <button
                    type="button"
                    onClick={() => setIsAddingPayment(true)}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Ajouter un paiement</span>
                  </button>
                )}
              </div>

              {/* Add Payment Inline Form */}
              {isAddingPayment && (
                <form
                  onSubmit={handleSavePayment}
                  className="p-3.5 rounded-2xl bg-slate-950 border border-emerald-500/30 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400">Nouveau versement reçu / effectué</span>
                    {summary.remainingBalance > 0 && (
                      <button
                        type="button"
                        onClick={handleSettleRemaining}
                        className="text-[10px] text-emerald-400 hover:underline"
                      >
                        Solder le reste ({formatCurrencyValue(summary.remainingBalance, debt.currency)})
                      </button>
                    )}
                  </div>

                  {paymentError && (
                    <div className="text-[11px] text-rose-400 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{paymentError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">
                        Montant ({debt.currency}) <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        required
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        placeholder="Montant"
                        className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white font-semibold focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">
                        Date <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Note / moyen de paiement</label>
                    <input
                      type="text"
                      value={paymentNote}
                      onChange={(e) => setPaymentNote(e.target.value)}
                      placeholder="Ex: Espèces, M-Pesa, Airtel Money, etc."
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAddingPayment(false)}
                      className="flex-1 py-1.5 rounded-lg bg-slate-800 text-xs font-medium text-slate-300 hover:bg-slate-700"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingPayment}
                      className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center justify-center gap-1 shadow-md shadow-emerald-950"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isSubmittingPayment ? 'Enregistrement...' : 'Valider'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Payments History List */}
              {debt.repayments && debt.repayments.length > 0 ? (
                <div className="space-y-2">
                  {debt.repayments
                    .slice()
                    .sort((a, b) => (b.date > a.date ? 1 : -1))
                    .map((payment) => (
                      <div
                        key={payment.id}
                        className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-semibold text-emerald-400">
                            +{formatCurrencyValue(payment.amount, debt.currency)}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {formatDate(payment.date)}
                            {payment.note && <span className="text-slate-300"> · {payment.note}</span>}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm('Supprimer ce remboursement ?')) {
                              onDeleteRepayment(debt.id, payment.id);
                            }
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                          title="Supprimer ce versement"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="p-3 text-center rounded-xl bg-slate-950/40 border border-dashed border-slate-800 text-xs text-slate-500">
                  Aucun remboursement enregistré pour le moment.
                </div>
              )}
            </div>

            {/* Delete Debt Confirmation Box */}
            {confirmDeleteDebt ? (
              <div className="p-3.5 rounded-2xl bg-rose-950/30 border border-rose-800/60 space-y-2">
                <p className="text-xs font-semibold text-rose-300">
                  Êtes-vous sûr de vouloir supprimer définitivement cette dette ?
                </p>
                <p className="text-[11px] text-slate-400">
                  Cette action est irréversible et supprimera également tout l'historique des paiements.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteDebt(false)}
                    className="flex-1 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300 hover:bg-slate-700"
                  >
                    Conserver
                  </button>
                  <button
                    type="button"
                    onClick={onDelete}
                    className="flex-1 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white"
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
                  className="text-xs text-rose-400/80 hover:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Supprimer cette dette</span>
                </button>
              </div>
            )}
          </div>

          {/* Footer Primary WhatsApp Button */}
          <div className="pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowWhatsApp(true)}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 transition cursor-pointer"
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
