import React from 'react';
import { AlertCircle, Calendar, Clock, CheckCircle2 } from 'lucide-react';
import { UnifiedPlanningItem } from '../../types/planning';
import { groupPlanningItems } from '../../utils/planningCalculations';
import { PlanningItemCard } from './PlanningItemCard';

interface PlanningListViewProps {
  items: UnifiedPlanningItem[];
  onOpenDebt: (debtId: string) => void;
  onToggleTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
}

export const PlanningListView: React.FC<PlanningListViewProps> = ({
  items,
  onOpenDebt,
  onToggleTask,
  onDeleteTask,
}) => {
  const groups = groupPlanningItems(items);
  const totalActive =
    groups.overdue.length +
    groups.today.length +
    groups.tomorrow.length +
    groups.thisWeek.length +
    groups.upcoming.length;

  if (items.length === 0) {
    return (
      <div className="py-12 px-6 text-center rounded-3xl bg-slate-900/40 border border-dashed border-slate-800">
        <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <h4 className="text-sm font-bold text-white mb-1">Aucune échéance ni tâche</h4>
        <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
          Les échéances de vos dettes actives s'afficheront ici automatiquement. Vous pouvez également ajouter vos propres tâches et rendez-vous.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 1. En retard (en rouge) */}
      {groups.overdue.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
            <AlertCircle className="w-4 h-4 animate-pulse" />
            <span>En retard ({groups.overdue.length})</span>
          </div>
          <div className="space-y-2">
            {groups.overdue.map((item) => (
              <PlanningItemCard
                key={item.id}
                item={item}
                onOpenDebt={onOpenDebt}
                onToggleTask={onToggleTask}
                onDeleteTask={onDeleteTask}
              />
            ))}
          </div>
        </div>
      )}

      {/* 2. Aujourd'hui */}
      {groups.today.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
            <Clock className="w-4 h-4" />
            <span>Aujourd'hui ({groups.today.length})</span>
          </div>
          <div className="space-y-2">
            {groups.today.map((item) => (
              <PlanningItemCard
                key={item.id}
                item={item}
                onOpenDebt={onOpenDebt}
                onToggleTask={onToggleTask}
                onDeleteTask={onDeleteTask}
              />
            ))}
          </div>
        </div>
      )}

      {/* 3. Demain */}
      {groups.tomorrow.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
            <Calendar className="w-4 h-4" />
            <span>Demain ({groups.tomorrow.length})</span>
          </div>
          <div className="space-y-2">
            {groups.tomorrow.map((item) => (
              <PlanningItemCard
                key={item.id}
                item={item}
                onOpenDebt={onOpenDebt}
                onToggleTask={onToggleTask}
                onDeleteTask={onDeleteTask}
              />
            ))}
          </div>
        </div>
      )}

      {/* 4. Cette semaine */}
      {groups.thisWeek.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>Cette semaine ({groups.thisWeek.length})</span>
          </div>
          <div className="space-y-2">
            {groups.thisWeek.map((item) => (
              <PlanningItemCard
                key={item.id}
                item={item}
                onOpenDebt={onOpenDebt}
                onToggleTask={onToggleTask}
                onDeleteTask={onDeleteTask}
              />
            ))}
          </div>
        </div>
      )}

      {/* 5. À venir */}
      {groups.upcoming.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span>Plus tard ({groups.upcoming.length})</span>
          </div>
          <div className="space-y-2">
            {groups.upcoming.map((item) => (
              <PlanningItemCard
                key={item.id}
                item={item}
                onOpenDebt={onOpenDebt}
                onToggleTask={onToggleTask}
                onDeleteTask={onDeleteTask}
              />
            ))}
          </div>
        </div>
      )}

      {/* 6. Terminées (Soldées / Tâches cochées) */}
      {groups.completed.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-slate-900">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <CheckCircle2 className="w-4 h-4" />
            <span>Terminées / Soldées ({groups.completed.length})</span>
          </div>
          <div className="space-y-2 opacity-75">
            {groups.completed.map((item) => (
              <PlanningItemCard
                key={item.id}
                item={item}
                onOpenDebt={onOpenDebt}
                onToggleTask={onToggleTask}
                onDeleteTask={onDeleteTask}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
