import React from 'react';
import { Calendar } from 'lucide-react';
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

  if (items.length === 0) {
    return (
      <div className="py-12 px-6 text-center rounded-[8px] bg-[#1C232D] border border-[#2A3340]">
        <Calendar className="w-10 h-10 text-[#98A2B0] mx-auto mb-3" />
        <h4 className="text-sm font-semibold text-[#ECE9E2] mb-1">Aucune échéance ni tâche</h4>
        <p className="text-xs text-[#98A2B0] max-w-xs mx-auto leading-relaxed">
          Les échéances de vos dettes actives s'afficheront ici automatiquement. Vous pouvez également ajouter vos propres tâches et rendez-vous.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 1. En retard */}
      {groups.overdue.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#E5604D]">
            <span className="w-2 h-2 rounded-full bg-[#E5604D]" />
            <span>En retard ({groups.overdue.length})</span>
          </div>
          <div className="rounded-[8px] bg-[#1C232D] border border-[#2A3340] overflow-hidden divide-y divide-[#2A3340]">
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
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#5FB48C]">
            <span className="w-2 h-2 rounded-full bg-[#5FB48C]" />
            <span>Aujourd'hui ({groups.today.length})</span>
          </div>
          <div className="rounded-[8px] bg-[#1C232D] border border-[#2A3340] overflow-hidden divide-y divide-[#2A3340]">
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
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#C8A96A]">
            <span className="w-2 h-2 rounded-full bg-[#C8A96A]" />
            <span>Demain ({groups.tomorrow.length})</span>
          </div>
          <div className="rounded-[8px] bg-[#1C232D] border border-[#2A3340] overflow-hidden divide-y divide-[#2A3340]">
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
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#ECE9E2]">
            <span className="w-2 h-2 rounded-full bg-[#98A2B0]" />
            <span>Cette semaine ({groups.thisWeek.length})</span>
          </div>
          <div className="rounded-[8px] bg-[#1C232D] border border-[#2A3340] overflow-hidden divide-y divide-[#2A3340]">
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
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#98A2B0]">
            <span className="w-2 h-2 rounded-full bg-[#98A2B0]" />
            <span>Plus tard ({groups.upcoming.length})</span>
          </div>
          <div className="rounded-[8px] bg-[#1C232D] border border-[#2A3340] overflow-hidden divide-y divide-[#2A3340]">
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

      {/* 6. Terminées */}
      {groups.completed.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-[#2A3340]">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#98A2B0]">
            <span>Terminées ou soldées ({groups.completed.length})</span>
          </div>
          <div className="rounded-[8px] bg-[#1C232D] border border-[#2A3340] overflow-hidden divide-y divide-[#2A3340] opacity-60">
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
