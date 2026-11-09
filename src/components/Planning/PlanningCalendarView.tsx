import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { UnifiedPlanningItem } from '../../types/planning';
import { getTodayDateString } from '../../utils/planningCalculations';
import { PlanningItemCard } from './PlanningItemCard';

interface PlanningCalendarViewProps {
  items: UnifiedPlanningItem[];
  onOpenDebt: (debtId: string) => void;
  onToggleTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
}

const WEEKDAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export const PlanningCalendarView: React.FC<PlanningCalendarViewProps> = ({
  items,
  onOpenDebt,
  onToggleTask,
  onDeleteTask,
}) => {
  const todayStr = getTodayDateString();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayStr);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleTodayMonth = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDateStr(todayStr);
  };

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();

  let firstDayIndex = firstDayOfMonth.getDay() - 1;
  if (firstDayIndex === -1) firstDayIndex = 6;

  const itemsByDate = new Map<string, UnifiedPlanningItem[]>();
  for (const item of items) {
    const list = itemsByDate.get(item.date) || [];
    list.push(item);
    itemsByDate.set(item.date, list);
  }

  const selectedDayItems = itemsByDate.get(selectedDateStr) || [];

  const monthLabel = currentDate.toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-4">
      {/* Calendar Header with Navigation */}
      <div className="p-3.5 rounded-[8px] bg-[#1C232D] border border-[#2A3340] flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#ECE9E2] capitalize">{monthLabel}</h3>
          <button
            type="button"
            onClick={handleTodayMonth}
            className="text-xs text-[#C8A96A] hover:underline cursor-pointer"
          >
            Aujourd'hui
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="min-h-[44px] min-w-[44px] rounded-[8px] bg-[#151A22] hover:bg-[#2A3340] text-[#ECE9E2] border border-[#2A3340] transition cursor-pointer flex items-center justify-center"
            aria-label="Mois précédent"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="min-h-[44px] min-w-[44px] rounded-[8px] bg-[#151A22] hover:bg-[#2A3340] text-[#ECE9E2] border border-[#2A3340] transition cursor-pointer flex items-center justify-center"
            aria-label="Mois suivant"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Calendar Month Grid */}
      <div className="p-3 rounded-[8px] bg-[#1C232D] border border-[#2A3340]">
        {/* Weekday labels */}
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {WEEKDAY_NAMES.map((name) => (
            <div key={name} className="text-xs font-medium text-[#98A2B0] py-1">
              {name}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDayIndex }).map((_, idx) => (
            <div key={`empty-${idx}`} className="h-11 rounded-[8px] bg-transparent" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const dayNum = idx + 1;
            const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const isToday = dayStr === todayStr;
            const isSelected = dayStr === selectedDateStr;
            const dayItems = itemsByDate.get(dayStr) || [];
            const hasOverdue = dayItems.some((i) => i.isOverdue);
            const hasReceivable = dayItems.some((i) => i.debtType === 'on_me_doit');
            const hasDebt = dayItems.some((i) => i.debtType === 'je_dois');
            const hasTask = dayItems.some((i) => i.kind === 'custom_task');

            return (
              <button
                key={dayStr}
                type="button"
                onClick={() => setSelectedDateStr(dayStr)}
                className={`h-11 rounded-[8px] flex flex-col items-center justify-center p-1 transition cursor-pointer border ${
                  isSelected
                    ? 'bg-[#C8A96A] text-[#151A22] font-semibold border-[#C8A96A]'
                    : isToday
                    ? 'bg-[#151A22] text-[#ECE9E2] font-semibold border-[#C8A96A]'
                    : 'bg-[#151A22] text-[#ECE9E2] hover:bg-[#2A3340] border-[#2A3340]'
                }`}
              >
                <span className="text-xs tabular-nums">{dayNum}</span>

                {dayItems.length > 0 && (
                  <div className="flex items-center gap-0.5 mt-0.5">
                    {hasOverdue && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#E5604D]" />
                    )}
                    {hasReceivable && !hasOverdue && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#5FB48C]" />
                    )}
                    {hasDebt && !hasOverdue && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#C8A96A]" />
                    )}
                    {hasTask && !hasOverdue && !hasReceivable && !hasDebt && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#98A2B0]" />
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Agenda Header & List */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-[#ECE9E2] capitalize flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#C8A96A]" />
            {new Date(selectedDateStr).toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </h4>
          <span className="text-xs text-[#98A2B0]">
            {selectedDayItems.length} événement{selectedDayItems.length > 1 ? 's' : ''}
          </span>
        </div>

        {selectedDayItems.length > 0 ? (
          <div className="rounded-[8px] bg-[#1C232D] border border-[#2A3340] overflow-hidden divide-y divide-[#2A3340]">
            {selectedDayItems.map((item) => (
              <PlanningItemCard
                key={item.id}
                item={item}
                onOpenDebt={onOpenDebt}
                onToggleTask={onToggleTask}
                onDeleteTask={onDeleteTask}
              />
            ))}
          </div>
        ) : (
          <div className="p-4 text-center rounded-[8px] bg-[#1C232D] border border-[#2A3340] text-xs text-[#98A2B0]">
            Aucune échéance ni tâche programmée ce jour.
          </div>
        )}
      </div>
    </div>
  );
};
