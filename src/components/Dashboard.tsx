import React, { useMemo } from 'react';
import { DashboardTotals, Debt } from '../types/debt';
import { formatCurrencyValue, getDebtSummary } from '../utils/debtCalculations';

interface DashboardProps {
  totals: DashboardTotals;
  activeFilter: string;
  onSelectFilter: (filter: 'all' | 'je_dois' | 'on_me_doit' | 'overdue' | 'settled') => void;
  debts?: Debt[];
}

export const Dashboard: React.FC<DashboardProps> = ({
  totals,
  activeFilter,
  onSelectFilter,
  debts = [],
}) => {
  // Calculate "À encaisser cette semaine" (receivables due within next 7 days, not settled)
  const dueThisWeek = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

    let count = 0;
    let sumUSD = 0;
    let sumFC = 0;

    for (const d of debts) {
      if (d.type === 'on_me_doit' && d.dueDate && d.dueDate >= todayStr && d.dueDate <= nextWeekStr) {
        const s = getDebtSummary(d);
        if (!s.isSettled) {
          count++;
          if (d.currency === 'USD') sumUSD += s.remainingBalance;
          else sumFC += s.remainingBalance;
        }
      }
    }

    return { count, sumUSD: Math.round(sumUSD * 100) / 100, sumFC: Math.round(sumFC * 100) / 100 };
  }, [debts]);

  return (
    <div className="space-y-2">
      {/* 1. Totaux FC et USD strictement séparés : Registre des créances et dettes */}
      <div className="grid grid-cols-2 gap-2">
        {/* On me doit (À recevoir) */}
        <button
          type="button"
          onClick={() => onSelectFilter(activeFilter === 'on_me_doit' ? 'all' : 'on_me_doit')}
          className={`p-3.5 rounded-[8px] text-left transition-colors border cursor-pointer ${
            activeFilter === 'on_me_doit'
              ? 'bg-[#1C232D] border-[#C8A96A]'
              : 'bg-[#1C232D] border-[#2A3340] hover:border-[#98A2B0]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[#5FB48C] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#5FB48C]" />
              On me doit
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between text-xs text-[#98A2B0]">
              <span>USD</span>
              <span className="text-base font-semibold text-[#ECE9E2] tabular-nums">
                {formatCurrencyValue(totals.onMeDoit.USD, 'USD')}
              </span>
            </div>
            <div className="flex items-baseline justify-between text-xs text-[#98A2B0] pt-1.5 border-t border-[#2A3340]">
              <span>FC</span>
              <span className="text-sm font-semibold text-[#ECE9E2] tabular-nums">
                {formatCurrencyValue(totals.onMeDoit.FC, 'FC')}
              </span>
            </div>
          </div>
        </button>

        {/* Je dois (À rembourser) */}
        <button
          type="button"
          onClick={() => onSelectFilter(activeFilter === 'je_dois' ? 'all' : 'je_dois')}
          className={`p-3.5 rounded-[8px] text-left transition-colors border cursor-pointer ${
            activeFilter === 'je_dois'
              ? 'bg-[#1C232D] border-[#C8A96A]'
              : 'bg-[#1C232D] border-[#2A3340] hover:border-[#98A2B0]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[#98A2B0] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#98A2B0]" />
              Je dois
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between text-xs text-[#98A2B0]">
              <span>USD</span>
              <span className="text-base font-semibold text-[#ECE9E2] tabular-nums">
                {formatCurrencyValue(totals.jeDois.USD, 'USD')}
              </span>
            </div>
            <div className="flex items-baseline justify-between text-xs text-[#98A2B0] pt-1.5 border-t border-[#2A3340]">
              <span>FC</span>
              <span className="text-sm font-semibold text-[#ECE9E2] tabular-nums">
                {formatCurrencyValue(totals.jeDois.FC, 'FC')}
              </span>
            </div>
          </div>
        </button>
      </div>

      {/* 2. « À encaisser cette semaine » et « En retard » en rangées sobres sans chiffre décoratif */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {/* À encaisser cette semaine */}
        <div className="p-3 rounded-[8px] bg-[#1C232D] border border-[#2A3340] flex flex-col justify-between min-h-[64px]">
          <div className="flex items-center gap-1.5 text-[#98A2B0] font-medium">
            <span className="w-2 h-2 rounded-full bg-[#5FB48C]" />
            <span>À encaisser cette semaine</span>
          </div>
          <div className="mt-1 text-sm font-semibold text-[#ECE9E2] tabular-nums">
            {dueThisWeek.count > 0 ? (
              <span className="space-x-1">
                {dueThisWeek.sumUSD > 0 && <span>{formatCurrencyValue(dueThisWeek.sumUSD, 'USD')}</span>}
                {dueThisWeek.sumUSD > 0 && dueThisWeek.sumFC > 0 && <span className="text-[#98A2B0]">·</span>}
                {dueThisWeek.sumFC > 0 && <span>{formatCurrencyValue(dueThisWeek.sumFC, 'FC')}</span>}
                <span className="text-xs text-[#98A2B0] font-normal">({dueThisWeek.count})</span>
              </span>
            ) : (
              <span className="text-xs text-[#98A2B0] font-normal">Aucune échéance</span>
            )}
          </div>
        </div>

        {/* En retard */}
        <button
          type="button"
          onClick={() => onSelectFilter(activeFilter === 'overdue' ? 'all' : 'overdue')}
          className={`p-3 rounded-[8px] text-left transition-colors border cursor-pointer flex flex-col justify-between min-h-[64px] ${
            activeFilter === 'overdue'
              ? 'bg-[#1C232D] border-[#E5604D]'
              : 'bg-[#1C232D] border-[#2A3340] hover:border-[#E5604D]'
          }`}
        >
          <div className="flex items-center gap-1.5 text-[#E5604D] font-medium">
            <span className="w-2 h-2 rounded-full bg-[#E5604D]" />
            <span>En retard</span>
          </div>
          <div className="mt-1 text-sm font-semibold text-[#E5604D] tabular-nums">
            {totals.overdueCount > 0 ? (
              <span>{totals.overdueCount} dette{totals.overdueCount > 1 ? 's' : ''} à relancer</span>
            ) : (
              <span className="text-xs text-[#98A2B0] font-normal">Aucun retard</span>
            )}
          </div>
        </button>
      </div>
    </div>
  );
};
