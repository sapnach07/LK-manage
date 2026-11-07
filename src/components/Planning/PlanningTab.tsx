import React, { useState } from 'react';
import { List, Calendar as CalendarIcon, Plus } from 'lucide-react';
import { Debt } from '../../types/debt';
import { PlanningTask, NotificationLeadTime } from '../../types/planning';
import { buildUnifiedPlanningItems } from '../../utils/planningCalculations';
import { NotificationBanner } from './NotificationBanner';
import { PlanningListView } from './PlanningListView';
import { PlanningCalendarView } from './PlanningCalendarView';
import { TaskFormModal } from './TaskFormModal';

interface PlanningTabProps {
  debts: Debt[];
  tasks: PlanningTask[];
  onOpenDebt: (debtId: string) => void;
  onSaveTask: (taskData: Omit<PlanningTask, 'id' | 'createdAt' | 'updatedAt' | 'completed'> & { id?: string }) => Promise<void>;
  onToggleTask: (taskId: string) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
}

export const PlanningTab: React.FC<PlanningTabProps> = ({
  debts,
  tasks,
  onOpenDebt,
  onSaveTask,
  onToggleTask,
  onDeleteTask,
}) => {
  const [activeView, setActiveView] = useState<'list' | 'calendar'>('list');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  // Compute unified items combining active debts & custom tasks
  const unifiedItems = buildUnifiedPlanningItems(debts, tasks);

  return (
    <div className="space-y-4">
      {/* 1. Notification Permission & Lead Time Settings */}
      <NotificationBanner />

      {/* 2. Sub-Header: View Mode Switcher & Add Task Action */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setActiveView('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
              activeView === 'list'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>Liste</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView('calendar')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
              activeView === 'calendar'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Calendrier</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsTaskModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Tâche / Rdv</span>
        </button>
      </div>

      {/* 3. Main View Component */}
      {activeView === 'list' ? (
        <PlanningListView
          items={unifiedItems}
          onOpenDebt={onOpenDebt}
          onToggleTask={onToggleTask}
          onDeleteTask={onDeleteTask}
        />
      ) : (
        <PlanningCalendarView
          items={unifiedItems}
          onOpenDebt={onOpenDebt}
          onToggleTask={onToggleTask}
          onDeleteTask={onDeleteTask}
        />
      )}

      {/* Task Creation Modal */}
      {isTaskModalOpen && (
        <TaskFormModal
          onSave={onSaveTask}
          onClose={() => setIsTaskModalOpen(false)}
        />
      )}
    </div>
  );
};
