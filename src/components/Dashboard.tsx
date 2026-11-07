import React from 'react';
import { ArrowDownLeft, ArrowUpRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { DashboardTotals } from '../types/debt';
import { formatCurrencyValue } from '../utils/debtCalculations';

interface DashboardProps {
  totals: DashboardTotals;
  activeFilter: string;
  onSelectFilter: (filter: 'all' | 'je_dois' | 'on_me_doit' | 'overdue' | 'settled') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ totals, activeFilter, onSelectFilter }) => {
  return (
    <div className="space-y-3">
      {/* Primary Financial Overview Cards (FC & USD Strictly Separated) */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* On me doit (Receivables) */}
        <button
          type="button"
          onClick={() => onSelectFilter(activeFilter === 'on_me_doit' ? 'all' : 'on_me_doit')}
          className={`relative p-3.5 rounded-2xl text-left transition-all border cursor-pointer ${
            activeFilter === 'on_me_doit'
              ? 'bg-emerald-950/40 border-emerald-500/50 shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-500/30'
              : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-emerald-400/90 flex items-center gap-1">
              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
              On me doit
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-medium text-slate-400">USD :</span>
              <span className="text-base font-bold tracking-tight text-white">
                {formatCurrencyValue(totals.onMeDoit.USD, 'USD')}
              </span>
            </div>
            <div className="flex items-baseline justify-between pt-1 border-t border-slate-800/80">
              <span className="text-[11px] font-medium text-slate-400">FC :</span>
              <span className="text-sm font-semibold tracking-tight text-slate-200">
                {formatCurrencyValue(totals.onMeDoit.FC, 'FC')}
              </span>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-emerald-400/70">À percevoir</div>
        </button>

        {/* Je dois (Debts) */}
        <button
          type="button"
          onClick={() => onSelectFilter(activeFilter === 'je_dois' ? 'all' : 'je_dois')}
          className={`relative p-3.5 rounded-2xl text-left transition-all border cursor-pointer ${
            activeFilter === 'je_dois'
              ? 'bg-amber-950/40 border-amber-500/50 shadow-lg shadow-amber-950/50 ring-1 ring-amber-500/30'
              : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-amber-400/90 flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
              Je dois
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-medium text-slate-400">USD :</span>
              <span className="text-base font-bold tracking-tight text-white">
                {formatCurrencyValue(totals.jeDois.USD, 'USD')}
              </span>
            </div>
            <div className="flex items-baseline justify-between pt-1 border-t border-slate-800/80">
              <span className="text-[11px] font-medium text-slate-400">FC :</span>
              <span className="text-sm font-semibold tracking-tight text-slate-200">
                {formatCurrencyValue(totals.jeDois.FC, 'FC')}
              </span>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-amber-400/70">À rembourser</div>
        </button>
      </div>

      {/* Overdue alert banner & quick statistics */}
      {totals.overdueCount > 0 && (
        <button
          type="button"
          onClick={() => onSelectFilter('overdue')}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${
            activeFilter === 'overdue'
              ? 'bg-rose-950/60 border-rose-500 text-rose-200 ring-1 ring-rose-500/40'
              : 'bg-rose-950/30 border-rose-900/60 text-rose-300 hover:bg-rose-950/40'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-full bg-rose-500/20 text-rose-400">
              <AlertCircle className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <span className="text-xs font-semibold text-rose-400">
                {totals.overdueCount} dette{totals.overdueCount > 1 ? 's' : ''} en retard
              </span>
              <p className="text-[11px] text-rose-300/80">Date d'échéance dépassée non soldée</p>
            </div>
          </div>
          <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-rose-900/50 border border-rose-700/50 text-rose-200">
            Filtrer
          </span>
        </button>
      )}
    </div>
  );
};
