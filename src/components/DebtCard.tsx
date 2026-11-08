import React, { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  AlertCircle,
  CheckCircle2,
  Calendar,
  MessageSquare,
  Image as ImageIcon,
  FileSignature,
  FileX,
} from 'lucide-react';
import { Debt } from '../types/debt';
import { getDebtSummary, formatCurrencyValue } from '../utils/debtCalculations';
import { WhatsAppModal } from './WhatsAppModal';

interface DebtCardProps {
  debt: Debt;
  hasContract?: boolean;
  onClick: () => void;
}

export const DebtCard: React.FC<DebtCardProps> = ({ debt, hasContract, onClick }) => {
  const summary = getDebtSummary(debt);
  const [showWhatsApp, setShowWhatsApp] = useState(false);

  const formattedDueDate = debt.dueDate
    ? new Date(debt.dueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    : null;

  return (
    <>
      <div
        onClick={onClick}
        className={`group relative p-4 rounded-2xl border transition-all cursor-pointer select-none ${
          summary.isSettled
            ? 'bg-slate-900/40 border-slate-800/60 opacity-80 hover:opacity-100 hover:border-slate-700'
            : summary.isOverdue
            ? 'bg-slate-900/90 border-rose-900/50 hover:border-rose-700/70 shadow-sm shadow-rose-950/20'
            : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 shadow-sm'
        }`}
      >
        {/* Top row: Type badge & Status */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
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

            {debt.proofPhoto && (
              <span
                className="p-1 rounded-md bg-slate-800 text-slate-400"
                title="Photo de preuve enregistrée"
              >
                <ImageIcon className="w-3 h-3" />
              </span>
            )}

            {/* Exactly as requested: badge « Contrat signé » when hasContract, or « Non signée » when unsigned */}
            {hasContract ? (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] font-bold"
                title="Contrat sous seing privé signé"
              >
                <FileSignature className="w-3 h-3" />
                <span>Contrat signé</span>
              </span>
            ) : debt.isUnsigned ? (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-semibold"
                title="Dette enregistrée sans signature de contrat"
              >
                <FileX className="w-3 h-3 text-slate-400" />
                <span>Non signée</span>
              </span>
            ) : null}
          </div>

          <div>
            {summary.isSettled ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3" /> Soldée
              </span>
            ) : summary.isOverdue ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                <AlertCircle className="w-3 h-3 animate-pulse" /> En retard
              </span>
            ) : (
              formattedDueDate && (
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                  <Calendar className="w-3 h-3 text-slate-500" />
                  <span>Échéance {formattedDueDate}</span>
                </span>
              )
            )}
          </div>
        </div>

        {/* Person Name & Reason */}
        <div className="mb-3">
          <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors truncate">
            {debt.personName}
          </h3>
          {debt.reason && (
            <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
              {debt.reason}
            </p>
          )}
        </div>

        {/* Financial Numbers & Remaining Balance */}
        <div className="flex items-end justify-between pt-2 border-t border-slate-800/80">
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">
              {summary.isSettled ? 'Montant réglé' : 'Solde restant'}
            </div>
            <div
              className={`text-lg font-black tracking-tight ${
                summary.isSettled
                  ? 'text-emerald-400 line-through opacity-80'
                  : summary.isOverdue
                  ? 'text-rose-400'
                  : 'text-white'
              }`}
            >
              {formatCurrencyValue(summary.remainingBalance, debt.currency)}
            </div>
            {summary.interest > 0 && !summary.isSettled && (
              <div className="text-[10px] text-amber-400/90 font-medium">
                dont +{formatCurrencyValue(summary.interest, debt.currency)} d'intérêts
              </div>
            )}
          </div>

          {/* Quick WhatsApp Reminder Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowWhatsApp(true);
            }}
            className="p-2.5 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 transition cursor-pointer hover:scale-105"
            title="Rappeler par WhatsApp"
            aria-label={`Rappeler ${debt.personName} par WhatsApp`}
          >
            <MessageSquare className="w-4 h-4" />
          </button>
        </div>

        {/* Repayment Progress bar (if any partial payments) */}
        {summary.totalRepaid > 0 && !summary.isSettled && (
          <div className="mt-2.5">
            <div className="flex justify-between text-[10px] text-slate-500 mb-1">
              <span>Remboursé : {formatCurrencyValue(summary.totalRepaid, debt.currency)}</span>
              <span>{summary.repaymentProgressPercent}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${summary.repaymentProgressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {showWhatsApp && (
        <WhatsAppModal
          debt={debt}
          summary={summary}
          onClose={() => setShowWhatsApp(false)}
        />
      )}
    </>
  );
};
