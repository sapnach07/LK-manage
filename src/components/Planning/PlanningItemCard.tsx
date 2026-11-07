import React from 'react';
import {
  Calendar,
  Clock,
  CalendarPlus,
  Repeat,
  AlertCircle,
  CheckCircle2,
  Trash2,
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
} from 'lucide-react';
import { UnifiedPlanningItem } from '../../types/planning';
import { downloadIcsFile } from '../../utils/icsGenerator';

interface PlanningItemCardProps {
  item: UnifiedPlanningItem;
  onOpenDebt?: (debtId: string) => void;
  onToggleTask?: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => void;
}

export const PlanningItemCard: React.FC<PlanningItemCardProps> = ({
  item,
  onOpenDebt,
  onToggleTask,
  onDeleteTask,
}) => {
  const isDebt = item.kind === 'debt_due';
  const taskId = item.originalTask?.id;

  const handleDownloadIcs = (e: React.MouseEvent) => {
    e.stopPropagation();
    downloadIcsFile(item);
  };

  const formattedDate = new Date(item.date).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <div
      onClick={() => {
        if (isDebt && item.debtId && onOpenDebt) {
          onOpenDebt(item.debtId);
        }
      }}
      className={`p-3.5 rounded-2xl border transition-all ${
        item.isCompleted
          ? 'bg-slate-900/40 border-slate-800/60 opacity-60'
          : item.isOverdue
          ? 'bg-slate-900/90 border-rose-900/60 shadow-sm shadow-rose-950/20'
          : item.isToday
          ? 'bg-slate-900 border-slate-700 ring-1 ring-emerald-500/30'
          : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
      } ${isDebt ? 'cursor-pointer hover:border-slate-700' : ''}`}
    >
      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {isDebt ? (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                item.debtType === 'on_me_doit'
                  ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-400'
                  : 'bg-amber-950/70 border border-amber-500/40 text-amber-400'
              }`}
            >
              {item.debtType === 'on_me_doit' ? (
                <>
                  <ArrowDownLeft className="w-3 h-3" /> On me doit
                </>
              ) : (
                <>
                  <ArrowUpRight className="w-3 h-3" /> Je dois
                </>
              )}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-950/70 border border-indigo-500/40 text-indigo-300">
              <Calendar className="w-3 h-3" /> Tâche / Rdv
            </span>
          )}

          {item.repetition && item.repetition !== 'none' && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-800 text-[10px] text-slate-400">
              <Repeat className="w-2.5 h-2.5" />
              {item.repetition === 'weekly' ? 'Hebdo' : 'Mensuel'}
            </span>
          )}
        </div>

        {/* Date and Overdue indicator */}
        <div className="flex items-center gap-1.5 text-xs">
          {item.isOverdue ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
              <AlertCircle className="w-3 h-3 animate-pulse" /> En retard ({formattedDate})
            </span>
          ) : item.isToday ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Aujourd'hui
            </span>
          ) : item.isTomorrow ? (
            <span className="text-[11px] font-medium text-amber-300">Demain</span>
          ) : (
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-500" />
              {formattedDate}
            </span>
          )}

          {item.time && (
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-500" />
              {item.time}
            </span>
          )}
        </div>
      </div>

      {/* Main Body */}
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          {!isDebt && onToggleTask && taskId && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleTask(taskId);
              }}
              className="mt-0.5 text-slate-500 hover:text-emerald-400 transition cursor-pointer shrink-0"
              title={item.isCompleted ? 'Marquer comme non terminée' : 'Marquer comme terminée'}
            >
              {item.isCompleted ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <div className="w-4 h-4 rounded-md border border-slate-600 hover:border-emerald-400" />
              )}
            </button>
          )}

          <div className="flex-1 min-w-0">
            <h4
              className={`text-sm font-bold text-white truncate ${
                item.isCompleted ? 'line-through text-slate-400' : ''
              }`}
            >
              {item.title}
            </h4>

            {item.note && (
              <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">{item.note}</p>
            )}

            {isDebt && (
              <div className="mt-1 flex items-center gap-2 text-xs">
                <span className="font-bold text-white tracking-tight">{item.amountFormatted}</span>
                <span className="text-[11px] text-emerald-400/80 flex items-center gap-0.5">
                  Voir détails <ExternalLink className="w-2.5 h-2.5" />
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer action buttons: Export to Calendar (.ics) & Delete for task */}
      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
        <button
          type="button"
          onClick={handleDownloadIcs}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer"
          title="Télécharger l'événement au format iCalendar (.ics)"
        >
          <CalendarPlus className="w-3.5 h-3.5 text-emerald-400" />
          <span>Ajouter à l'agenda du téléphone</span>
        </button>

        {!isDebt && onDeleteTask && taskId && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteTask(taskId);
            }}
            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
            title="Supprimer cette tâche"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
