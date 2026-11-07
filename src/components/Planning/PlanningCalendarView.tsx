import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, AlertCircle } from 'lucide-react';
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

  // Navigation handlers
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

  // Month metadata
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();

  // Day of week for first day (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  // Convert so Monday = 0, Sunday = 6
  let firstDayIndex = firstDayOfMonth.getDay() - 1;
  if (firstDayIndex === -1) firstDayIndex = 6;

  // Group items by date string (YYYY-MM-DD)
  const itemsByDate = new Map<string, UnifiedPlanningItem[]>();
  for (const item of items) {
    const list = itemsByDate.get(item.date) || [];
    list.push(item);
    itemsByDate.set(item.date, list);
  }

  // Selected date items
  const selectedDayItems = itemsByDate.get(selectedDateStr) || [];

  const monthLabel = currentDate.toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-4">
      {/* Calendar Header with Navigation */}
      <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white capitalize">{monthLabel}</h3>
          <button
            type="button"
            onClick={handleTodayMonth}
            className="text-[11px] text-emerald-400 hover:underline cursor-pointer"
          >
            Aujourd'hui
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            aria-label="Mois précédent"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            aria-label="Mois suivant"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Calendar Month Grid */}
      <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800">
        {/* Weekday labels */}
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {WEEKDAY_NAMES.map((name) => (
            <div key={name} className="text-[11px] font-semibold text-slate-500 py-1">
              {name}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells before first day */}
          {Array.from({ length: firstDayIndex }).map((_, idx) => (
            <div key={`empty-${idx}`} className="h-10 rounded-xl bg-transparent" />
          ))}

          {/* Month days */}
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
                className={`h-11 rounded-xl flex flex-col items-center justify-center p-1 transition relative cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-950 ring-2 ring-emerald-400/40'
                    : isToday
                    ? 'bg-slate-800 text-emerald-400 font-bold border border-emerald-500/40'
                    : 'bg-slate-950/60 hover:bg-slate-800/80 text-slate-300'
                }`}
              >
                <span className="text-xs">{dayNum}</span>

                {/* Event dots */}
                {dayItems.length > 0 && (
                  <div className="flex items-center gap-0.5 mt-0.5">
                    {hasOverdue && (
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                    )}
                    {hasReceivable && !hasOverdue && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    )}
                    {hasDebt && !hasOverdue && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    )}
                    {hasTask && !hasOverdue && !hasReceivable && !hasDebt && (
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
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
          <h4 className="text-xs font-bold text-white capitalize flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            {new Date(selectedDateStr).toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </h4>
          <span className="text-[11px] text-slate-400">
            {selectedDayItems.length} événement{selectedDayItems.length > 1 ? 's' : ''}
          </span>
        </div>

        {selectedDayItems.length > 0 ? (
          <div className="space-y-2">
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
          <div className="p-4 text-center rounded-xl bg-slate-900/40 border border-slate-800 text-xs text-slate-500">
            Aucune échéance ni tâche programmée ce jour.
          </div>
        )}
      </div>
    </div>
  );
};
