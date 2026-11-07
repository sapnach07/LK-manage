import { Debt, Repayment } from '../types/debt';
import { PlanningTask } from '../types/planning';

const DB_NAME = 'MesDettesDB';
const DB_VERSION = 2;
const STORE_NAME = 'debts';
const TASKS_STORE_NAME = 'tasks';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error("IndexedDB n'est pas supporté par ce navigateur."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error(`Erreur lors de l'ouverture d'IndexedDB: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('currency', 'currency', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(TASKS_STORE_NAME)) {
        const taskStore = db.createObjectStore(TASKS_STORE_NAME, { keyPath: 'id' });
        taskStore.createIndex('date', 'date', { unique: false });
        taskStore.createIndex('completed', 'completed', { unique: false });
        taskStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

export async function getAllDebts(): Promise<Debt[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      // Sort newest created first
      const debts: Debt[] = request.result || [];
      debts.sort((a, b) => b.createdAt - a.createdAt);
      resolve(debts);
    };

    request.onerror = () => {
      reject(new Error(`Erreur de lecture: ${request.error?.message}`));
    };
  });
}

export async function getDebtById(id: string): Promise<Debt | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result || null);
    };

    request.onerror = () => {
      reject(new Error(`Erreur de lecture de la dette: ${request.error?.message}`));
    };
  });
}

export async function saveDebt(debt: Debt): Promise<Debt> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const updatedDebt = {
      ...debt,
      updatedAt: Date.now(),
    };
    const request = store.put(updatedDebt);

    request.onsuccess = () => {
      resolve(updatedDebt);
    };

    request.onerror = () => {
      reject(new Error(`Erreur de sauvegarde: ${request.error?.message}`));
    };
  });
}

export async function deleteDebt(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error(`Erreur de suppression: ${request.error?.message}`));
    };
  });
}

export async function addRepaymentToDebt(
  debtId: string,
  repaymentData: { amount: number; date: string; note?: string }
): Promise<Debt> {
  const debt = await getDebtById(debtId);
  if (!debt) {
    throw new Error('Dette introuvable');
  }

  const newRepayment: Repayment = {
    id: 'rep_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    amount: repaymentData.amount,
    date: repaymentData.date,
    note: repaymentData.note?.trim() || undefined,
    createdAt: Date.now(),
  };

  const updatedDebt: Debt = {
    ...debt,
    repayments: [...(debt.repayments || []), newRepayment],
    updatedAt: Date.now(),
  };

  return await saveDebt(updatedDebt);
}

export async function deleteRepaymentFromDebt(debtId: string, repaymentId: string): Promise<Debt> {
  const debt = await getDebtById(debtId);
  if (!debt) {
    throw new Error('Dette introuvable');
  }

  const updatedDebt: Debt = {
    ...debt,
    repayments: (debt.repayments || []).filter((r) => r.id !== repaymentId),
    updatedAt: Date.now(),
  };

  return await saveDebt(updatedDebt);
}

/* ================= Tasks CRUD ================= */

export async function getAllTasks(): Promise<PlanningTask[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TASKS_STORE_NAME, 'readonly');
    const store = tx.objectStore(TASKS_STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const tasks: PlanningTask[] = request.result || [];
      tasks.sort((a, b) => a.date.localeCompare(b.date));
      resolve(tasks);
    };

    request.onerror = () => {
      reject(new Error(`Erreur de lecture des tâches: ${request.error?.message}`));
    };
  });
}

export async function saveTask(task: PlanningTask): Promise<PlanningTask> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TASKS_STORE_NAME, 'readwrite');
    const store = tx.objectStore(TASKS_STORE_NAME);
    const updated = {
      ...task,
      updatedAt: Date.now(),
    };
    const request = store.put(updated);

    request.onsuccess = () => {
      resolve(updated);
    };

    request.onerror = () => {
      reject(new Error(`Erreur d'enregistrement de la tâche: ${request.error?.message}`));
    };
  });
}

export async function deleteTask(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TASKS_STORE_NAME, 'readwrite');
    const store = tx.objectStore(TASKS_STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error(`Erreur de suppression de la tâche: ${request.error?.message}`));
    };
  });
}

export async function toggleTaskCompleted(id: string): Promise<PlanningTask> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TASKS_STORE_NAME, 'readwrite');
    const store = tx.objectStore(TASKS_STORE_NAME);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const task: PlanningTask = getReq.result;
      if (!task) {
        reject(new Error('Tâche introuvable'));
        return;
      }
      task.completed = !task.completed;
      task.updatedAt = Date.now();
      const putReq = store.put(task);
      putReq.onsuccess = () => resolve(task);
      putReq.onerror = () => reject(putReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

/* ================= Notification Settings ================= */

const NOTIF_SETTINGS_KEY = 'mes_dettes_notification_settings';

export function getNotificationSettings(): { enabled: boolean; leadDays: 0 | 1 | 3; lastNotifiedDate?: string } {
  try {
    const raw = localStorage.getItem(NOTIF_SETTINGS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    // fallback
  }
  return { enabled: false, leadDays: 1 };
}

export function saveNotificationSettings(settings: { enabled: boolean; leadDays: 0 | 1 | 3; lastNotifiedDate?: string }): void {
  try {
    localStorage.setItem(NOTIF_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    // fallback
  }
}

/* ================= Backup & Restore Database Operations ================= */

export async function replaceEntireDatabase(newDebts: Debt[], newTasks: PlanningTask[]): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME, TASKS_STORE_NAME], 'readwrite');
    const debtsStore = tx.objectStore(STORE_NAME);
    const tasksStore = tx.objectStore(TASKS_STORE_NAME);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error(`Erreur lors du remplacement de la base: ${tx.error?.message}`));

    // Clear existing
    debtsStore.clear();
    tasksStore.clear();

    // Insert new
    for (const debt of newDebts) {
      debtsStore.put(debt);
    }
    for (const task of newTasks) {
      tasksStore.put(task);
    }
  });
}

export async function mergeDatabase(mergedDebts: Debt[], mergedTasks: PlanningTask[]): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME, TASKS_STORE_NAME], 'readwrite');
    const debtsStore = tx.objectStore(STORE_NAME);
    const tasksStore = tx.objectStore(TASKS_STORE_NAME);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error(`Erreur lors de la fusion de la base: ${tx.error?.message}`));

    for (const debt of mergedDebts) {
      debtsStore.put(debt);
    }
    for (const task of mergedTasks) {
      tasksStore.put(task);
    }
  });
}


