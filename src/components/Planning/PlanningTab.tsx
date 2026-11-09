import React, { useState } from 'react';
import { List, Calendar as CalendarIcon, Plus } from 'lucide-react';
import { Debt } from '../../types/debt';
import { PlanningTask } from '../../types/planning';
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

  const unifiedItems = buildUnifiedPlanningItems(debts, tasks);

  return (
    <div className="space-y-4">
      {/* 1. Notification Permission & Lead Time Settings */}
      <NotificationBanner />

      {/* 2. Sub-Header: View Mode Switcher & Add Task Action */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center p-1 rounded-[8px] bg-[#1C232D] border border-[#2A3340] text-xs">
          <button
            type="button"
            onClick={() => setActiveView('list')}
            className={`min-h-[44px] flex items-center gap-1.5 px-3.5 rounded-[8px] font-medium transition cursor-pointer ${
              activeView === 'list'
                ? 'bg-[#C8A96A] text-[#151A22] font-semibold'
                : 'text-[#98A2B0] hover:text-[#ECE9E2]'
            }`}
          >
            <List className="w-4 h-4" />
            <span>Liste</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView('calendar')}
            className={`min-h-[44px] flex items-center gap-1.5 px-3.5 rounded-[8px] font-medium transition cursor-pointer ${
              activeView === 'calendar'
                ? 'bg-[#C8A96A] text-[#151A22] font-semibold'
                : 'text-[#98A2B0] hover:text-[#ECE9E2]'
            }`}
          >
            <CalendarIcon className="w-4 h-4" />
            <span>Calendrier</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsTaskModalOpen(true)}
          className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 rounded-[8px] bg-[#1C232D] hover:bg-[#2A3340] text-[#ECE9E2] border border-[#2A3340] text-xs font-semibold transition cursor-pointer"
        >
          <Plus className="w-4 h-4 text-[#C8A96A]" />
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
