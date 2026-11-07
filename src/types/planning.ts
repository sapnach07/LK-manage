import { DebtType } from './debt';

export type TaskRepetition = 'none' | 'weekly' | 'monthly';

export interface PlanningTask {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  note?: string;
  repetition: TaskRepetition;
  completed: boolean;
  createdAt: number;
  updatedAt: number;
}

export type PlanningItemKind = 'debt_due' | 'custom_task';

export interface UnifiedPlanningItem {
  id: string;
  kind: PlanningItemKind;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  note?: string;
  repetition?: TaskRepetition;
  // Specific to debt_due
  debtId?: string;
  debtType?: DebtType;
  personName?: string;
  amountFormatted?: string;
  // Status
  isOverdue: boolean;
  isToday: boolean;
  isTomorrow: boolean;
  isThisWeek: boolean;
  isCompleted: boolean;
  originalDebt?: any;
  originalTask?: PlanningTask;
}

export type NotificationLeadTime = 0 | 1 | 3; // 0 = le jour même, 1 = 1 jour avant, 3 = 3 jours avant

export interface NotificationSettings {
  enabled: boolean;
  leadDays: NotificationLeadTime;
  lastNotifiedDate?: string;
}
