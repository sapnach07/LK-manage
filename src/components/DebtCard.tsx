import React, { useState } from 'react';
import {
  MessageSquare,
  FileCheck2,
  FileX,
  Image as ImageIcon,
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
        className="group relative flex items-center justify-between gap-3 px-4 py-3.5 bg-[#1C232D] hover:bg-[#222B37] active:bg-[#252F3D] transition-colors cursor-pointer border-b border-[#2A3340] last:border-b-0 min-h-[60px]"
      >
        {/* Left: Person name, type & meta */}
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-[#ECE9E2] truncate">
              {debt.personName}
            </h3>
            {debt.type === 'je_dois' && (
              <span className="text-xs px-1.5 py-0.5 rounded-[4px] bg-[#151A22] text-[#98A2B0] border border-[#2A3340]">
                Je dois
              </span>
            )}
            {debt.proofPhoto && (
              <span className="text-[#98A2B0]" title="Photo enregistrée">
                <ImageIcon className="w-3.5 h-3.5" />
              </span>
            )}
            {hasContract ? (
              <span
                className="inline-flex items-center gap-1 text-xs text-[#C8A96A]"
                title="Contrat signé"
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Contrat</span>
              </span>
            ) : debt.isUnsigned ? (
              <span
                className="inline-flex items-center gap-1 text-xs text-[#98A2B0]"
                title="Non signée"
              >
                <FileX className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Non signée</span>
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2 mt-1 text-sm text-[#98A2B0]">
            {/* Status dot + word */}
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
            ) : formattedDueDate ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-[#98A2B0]">
                <span className="w-2 h-2 rounded-full bg-[#98A2B0]" />
                Échéance {formattedDueDate}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-[#98A2B0]">
                <span className="w-2 h-2 rounded-full bg-[#2A3340]" />
                Sans échéance
              </span>
            )}

            {debt.reason && (
              <>
                <span className="text-[#2A3340]">·</span>
                <span className="truncate text-xs text-[#98A2B0] max-w-[140px] sm:max-w-xs">
                  {debt.reason}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right: Tabular amount & Action */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="text-right">
            <div
              className={`text-base font-semibold tabular-nums ${
                summary.isSettled
                  ? 'text-[#5FB48C] line-through opacity-75'
                  : summary.isOverdue
                  ? 'text-[#E5604D]'
                  : 'text-[#ECE9E2]'
              }`}
            >
              {formatCurrencyValue(summary.remainingBalance, debt.currency)}
            </div>
            {summary.interest > 0 && !summary.isSettled && (
              <div className="text-xs text-[#C8A96A] tabular-nums">
                +{formatCurrencyValue(summary.interest, debt.currency)} intérêts
              </div>
            )}
            {summary.totalRepaid > 0 && !summary.isSettled && (
              <div className="text-xs text-[#98A2B0] tabular-nums">
                {summary.repaymentProgressPercent}% réglé
              </div>
            )}
          </div>

          {/* Quick WhatsApp Reminder button (44px touch area) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowWhatsApp(true);
            }}
            className="w-11 h-11 rounded-[8px] flex items-center justify-center text-[#98A2B0] hover:text-[#5FB48C] hover:bg-[#151A22] active:bg-[#151A22] border border-[#2A3340] transition cursor-pointer"
            title="Rappeler par WhatsApp"
            aria-label={`Rappeler ${debt.personName} par WhatsApp`}
          >
            <MessageSquare className="w-4 h-4" />
          </button>
        </div>
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
