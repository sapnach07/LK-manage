import React from 'react';
import {
  Calendar,
  Clock,
  CalendarPlus,
  Repeat,
  CheckCircle2,
  Trash2,
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
      className={`p-3.5 hover:bg-[#151A22]/50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
        isDebt ? 'cursor-pointer' : ''
      } ${item.isCompleted ? 'opacity-50' : ''}`}
    >
      {/* Left side */}
      <div className="flex items-start gap-2.5 flex-1 min-w-0">
        {!isDebt && onToggleTask && taskId && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleTask(taskId);
            }}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#98A2B0] hover:text-[#5FB48C] transition cursor-pointer shrink-0 -ml-2 -mt-2"
            title={item.isCompleted ? 'Marquer comme non terminée' : 'Marquer comme terminée'}
          >
            {item.isCompleted ? (
              <CheckCircle2 className="w-5 h-5 text-[#5FB48C]" />
            ) : (
              <div className="w-5 h-5 rounded-[4px] border border-[#2A3340] hover:border-[#5FB48C]" />
            )}
          </button>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-base font-semibold text-[#ECE9E2] truncate ${
                item.isCompleted ? 'line-through text-[#98A2B0]' : ''
              }`}
            >
              {item.title}
            </span>

            {/* Status dot + word */}
            {item.isOverdue ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-[#E5604D]">
                <span className="w-2 h-2 rounded-full bg-[#E5604D]" />
                En retard
              </span>
            ) : item.isToday ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-[#5FB48C]">
                <span className="w-2 h-2 rounded-full bg-[#5FB48C]" />
                Aujourd'hui
              </span>
            ) : item.isTomorrow ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-[#C8A96A]">
                <span className="w-2 h-2 rounded-full bg-[#C8A96A]" />
                Demain
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] text-[#98A2B0]">
                <span className="w-2 h-2 rounded-full bg-[#98A2B0]" />
                {formattedDate}
              </span>
            )}

            {isDebt && (
              <span className="text-[11px] text-[#98A2B0]">
                ({item.debtType === 'on_me_doit' ? 'On me doit' : 'Je dois'})
              </span>
            )}

            {item.repetition && item.repetition !== 'none' && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-[#151A22] border border-[#2A3340] text-[10px] text-[#98A2B0]">
                <Repeat className="w-2.5 h-2.5" />
                {item.repetition === 'weekly' ? 'Hebdo' : 'Mensuel'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-[#98A2B0] mt-1 flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {formattedDate}
            </span>
            {item.time && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {item.time}
              </span>
            )}
            {item.note && (
              <span className="truncate max-w-xs">{item.note}</span>
            )}
          </div>
        </div>
      </div>

      {/* Right side: Amount & action buttons */}
      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
        {isDebt && item.amountFormatted && (
          <span className="text-base font-semibold text-[#ECE9E2] tabular-nums">
            {item.amountFormatted}
          </span>
        )}

        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={handleDownloadIcs}
            className="min-h-[44px] min-w-[44px] rounded-[8px] bg-[#151A22] hover:bg-[#2A3340] text-[#ECE9E2] border border-[#2A3340] transition cursor-pointer flex items-center justify-center"
            title="Ajouter à l'agenda (.ics)"
          >
            <CalendarPlus className="w-4 h-4 text-[#5FB48C]" />
          </button>

          {!isDebt && onDeleteTask && taskId && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteTask(taskId);
              }}
              className="min-h-[44px] min-w-[44px] rounded-[8px] bg-[#151A22] hover:bg-[#2A3340] text-[#E5604D] border border-[#2A3340] transition cursor-pointer flex items-center justify-center"
              title="Supprimer cette tâche"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
