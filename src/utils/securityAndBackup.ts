import { Debt } from '../types/debt';
import { PlanningTask } from '../types/planning';

export interface BackupPayload {
  version: number;
  appName: 'LK manage' | 'Mes Dettes';
  exportedAt: string;
  debts: Debt[];
  tasks: PlanningTask[];
}

const PIN_HASH_KEY = 'mes_dettes_pin_hash';
const PIN_ENABLED_KEY = 'mes_dettes_pin_enabled';
const LAST_BACKUP_KEY = 'mes_dettes_last_backup_date';

/**
 * Computes SHA-256 hash of a 4-digit PIN using Web Crypto API.
 */
export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`mes_dettes_salt_2026_${pin}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function isPinProtectionEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(PIN_ENABLED_KEY) === 'true' && !!localStorage.getItem(PIN_HASH_KEY);
}

export async function verifyPin(enteredPin: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const storedHash = localStorage.getItem(PIN_HASH_KEY);
  if (!storedHash) return false;
  const enteredHash = await hashPin(enteredPin);
  return enteredHash === storedHash;
}

export async function setPinCode(pin: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const hash = await hashPin(pin);
  localStorage.setItem(PIN_HASH_KEY, hash);
  localStorage.setItem(PIN_ENABLED_KEY, 'true');
}

export function removePinCode(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(PIN_HASH_KEY);
  localStorage.setItem(PIN_ENABLED_KEY, 'false');
}

/* ================= Backup & Restore Utilities ================= */

export function getLastBackupDate(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(LAST_BACKUP_KEY);
}

export function recordBackupExported(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
}

/**
 * Checks whether monthly backup reminder should be shown (> 30 days without backup).
 */
export function isBackupReminderDue(asOf: Date = new Date()): boolean {
  const lastBackup = getLastBackupDate();
  if (!lastBackup) {
    // If never backed up, show reminder
    return true;
  }
  const lastDate = new Date(lastBackup);
  if (isNaN(lastDate.getTime())) return true;

  const diffMs = asOf.getTime() - lastDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 30;
}

/**
 * Generates JSON string of all debts (including compressed photos) and tasks.
 */
export function createBackupPayload(debts: Debt[], tasks: PlanningTask[]): string {
  const payload: BackupPayload = {
    version: 1,
    appName: 'LK manage',
    exportedAt: new Date().toISOString(),
    debts,
    tasks,
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Merges backup debts with current debts (avoiding duplicate IDs, keeping newer updates).
 */
export function mergeDebts(currentDebts: Debt[], importedDebts: Debt[]): Debt[] {
  const map = new Map<string, Debt>();
  for (const debt of currentDebts) {
    map.set(debt.id, debt);
  }
  for (const imported of importedDebts) {
    if (!map.has(imported.id)) {
      map.set(imported.id, imported);
    } else {
      // Keep the one with highest updatedAt
      const existing = map.get(imported.id)!;
      if ((imported.updatedAt || 0) >= (existing.updatedAt || 0)) {
        map.set(imported.id, imported);
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Merges backup tasks with current tasks.
 */
export function mergeTasks(currentTasks: PlanningTask[], importedTasks: PlanningTask[]): PlanningTask[] {
  const map = new Map<string, PlanningTask>();
  for (const task of currentTasks) {
    map.set(task.id, task);
  }
  for (const imported of importedTasks) {
    if (!map.has(imported.id)) {
      map.set(imported.id, imported);
    } else {
      const existing = map.get(imported.id)!;
      if ((imported.updatedAt || 0) >= (existing.updatedAt || 0)) {
        map.set(imported.id, imported);
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Validates whether parsed JSON is a legitimate LK manage (or legacy Mes Dettes) backup.
 */
export function parseAndValidateBackup(jsonString: string): { debts: Debt[]; tasks: PlanningTask[]; exportedAt: string } {
  const data = JSON.parse(jsonString);
  if (!data || typeof data !== 'object') {
    throw new Error('Le fichier sélectionné ne contient pas de données JSON valides.');
  }

  if (data.appName !== 'LK manage' && data.appName !== 'Mes Dettes' && !Array.isArray(data.debts)) {
    throw new Error("Ce fichier n'est pas une sauvegarde valide de l'application LK manage.");
  }

  const debts: Debt[] = Array.isArray(data.debts) ? data.debts : [];
  const tasks: PlanningTask[] = Array.isArray(data.tasks) ? data.tasks : [];

  return {
    debts,
    tasks,
    exportedAt: data.exportedAt || new Date().toISOString(),
  };
}

/**
 * Downloads the JSON backup file directly on the phone / browser.
 */
export function triggerBackupDownload(debts: Debt[], tasks: PlanningTask[]): void {
  const jsonContent = createBackupPayload(debts, tasks);
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `lk-manage-sauvegarde-${dateStr}.json`;

  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  recordBackupExported();
}
