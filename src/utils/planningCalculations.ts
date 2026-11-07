import { Debt } from '../types/debt';
import { PlanningTask, UnifiedPlanningItem, NotificationLeadTime } from '../types/planning';
import { getDebtSummary, formatCurrencyValue } from './debtCalculations';

export function getTodayDateString(asOf: Date = new Date()): string {
  const y = asOf.getFullYear();
  const m = String(asOf.getMonth() + 1).padStart(2, '0');
  const d = String(asOf.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getDateOffsetString(daysOffset: number, asOf: Date = new Date()): string {
  const target = new Date(asOf);
  target.setDate(target.getDate() + daysOffset);
  return getTodayDateString(target);
}

/**
 * Calculates the end of the current week (Sunday).
 */
export function getEndOfWeekDateString(asOf: Date = new Date()): string {
  const current = new Date(asOf);
  const day = current.getDay(); // 0 is Sunday, 1 is Monday
  const distanceToSunday = day === 0 ? 0 : 7 - day;
  current.setDate(current.getDate() + distanceToSunday);
  return getTodayDateString(current);
}

/**
 * Builds unified planning list from active debts and user tasks.
 */
export function buildUnifiedPlanningItems(
  debts: Debt[],
  tasks: PlanningTask[],
  asOfDate: Date = new Date()
): UnifiedPlanningItem[] {
  const todayStr = getTodayDateString(asOfDate);
  const tomorrowStr = getDateOffsetString(1, asOfDate);
  const endOfWeekStr = getEndOfWeekDateString(asOfDate);

  const items: UnifiedPlanningItem[] = [];

  // 1. Debt due dates (automatic)
  for (const debt of debts) {
    if (!debt.dueDate) continue;
    const summary = getDebtSummary(debt, asOfDate);

    // Only non-settled debts appear as active planning deadlines (or settled ones marked as completed)
    const isCompleted = summary.isSettled;
    const isOverdue = !isCompleted && debt.dueDate < todayStr;
    const isToday = debt.dueDate === todayStr;
    const isTomorrow = debt.dueDate === tomorrowStr;
    const isThisWeek = !isOverdue && !isToday && !isTomorrow && debt.dueDate <= endOfWeekStr;

    const actionLabel = debt.type === 'on_me_doit' ? 'À percevoir de' : 'À rembourser à';
    const amountStr = formatCurrencyValue(summary.remainingBalance, debt.currency);

    items.push({
      id: `debt_plan_${debt.id}`,
      kind: 'debt_due',
      title: `${actionLabel} ${debt.personName} (${amountStr})`,
      date: debt.dueDate,
      note: debt.reason || undefined,
      debtId: debt.id,
      debtType: debt.type,
      personName: debt.personName,
      amountFormatted: amountStr,
      isOverdue,
      isToday,
      isTomorrow,
      isThisWeek,
      isCompleted,
      originalDebt: debt,
    });
  }

  // 2. Custom user tasks / appointments
  for (const task of tasks) {
    const isCompleted = task.completed;
    const isOverdue = !isCompleted && task.date < todayStr;
    const isToday = task.date === todayStr;
    const isTomorrow = task.date === tomorrowStr;
    const isThisWeek = !isOverdue && !isToday && !isTomorrow && task.date <= endOfWeekStr;

    items.push({
      id: `task_${task.id}`,
      kind: 'custom_task',
      title: task.title,
      date: task.date,
      time: task.time,
      note: task.note,
      repetition: task.repetition,
      isOverdue,
      isToday,
      isTomorrow,
      isThisWeek,
      isCompleted,
      originalTask: task,
    });
  }

  // Sort chronological by date then time
  return items.sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    const timeA = a.time || '23:59';
    const timeB = b.time || '23:59';
    return timeA.localeCompare(timeB);
  });
}

export interface GroupedPlanningSections {
  overdue: UnifiedPlanningItem[];
  today: UnifiedPlanningItem[];
  tomorrow: UnifiedPlanningItem[];
  thisWeek: UnifiedPlanningItem[];
  upcoming: UnifiedPlanningItem[];
  completed: UnifiedPlanningItem[];
}

/**
 * Groups items into list view categories: en retard, aujourd'hui, demain, cette semaine, à venir, terminées.
 */
export function groupPlanningItems(items: UnifiedPlanningItem[]): GroupedPlanningSections {
  const groups: GroupedPlanningSections = {
    overdue: [],
    today: [],
    tomorrow: [],
    thisWeek: [],
    upcoming: [],
    completed: [],
  };

  for (const item of items) {
    if (item.isCompleted) {
      groups.completed.push(item);
      continue;
    }

    if (item.isOverdue) {
      groups.overdue.push(item);
    } else if (item.isToday) {
      groups.today.push(item);
    } else if (item.isTomorrow) {
      groups.tomorrow.push(item);
    } else if (item.isThisWeek) {
      groups.thisWeek.push(item);
    } else {
      groups.upcoming.push(item);
    }
  }

  return groups;
}

/**
 * Finds items that qualify for reminder notifications today based on configured leadDays.
 * (e.g. if leadDays = 1, reminds items where date is tomorrow).
 */
export function getItemsNeedingNotification(
  items: UnifiedPlanningItem[],
  leadDays: NotificationLeadTime,
  asOfDate: Date = new Date()
): UnifiedPlanningItem[] {
  const targetDateStr = getDateOffsetString(leadDays, asOfDate);

  return items.filter((item) => {
    if (item.isCompleted) return false;
    // Notify on target date
    return item.date === targetDateStr;
  });
}
