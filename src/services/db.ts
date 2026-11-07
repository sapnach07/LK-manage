import { Debt, Repayment } from '../types/debt';

const DB_NAME = 'MesDettesDB';
const DB_VERSION = 1;
const STORE_NAME = 'debts';

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
