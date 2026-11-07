/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Coins,
  ArrowUpDown,
  Smartphone,
  ShieldCheck,
  Calendar,
  Wallet,
  Settings as SettingsIcon,
} from 'lucide-react';
import { Debt, Currency } from './types/debt';
import { PlanningTask } from './types/planning';
import {
  getAllDebts,
  saveDebt,
  deleteDebt,
  addRepaymentToDebt,
  deleteRepaymentFromDebt,
  getAllTasks,
  saveTask,
  deleteTask,
  toggleTaskCompleted,
  getNotificationSettings,
  saveNotificationSettings,
} from './services/db';
import { calculateDashboardTotals, getDebtSummary } from './utils/debtCalculations';
import {
  buildUnifiedPlanningItems,
  getItemsNeedingNotification,
  getTodayDateString,
} from './utils/planningCalculations';
import {
  isPinProtectionEnabled,
  isBackupReminderDue,
} from './utils/securityAndBackup';
import { Dashboard } from './components/Dashboard';
import { DebtCard } from './components/DebtCard';
import { DebtFormModal } from './components/DebtFormModal';
import { DebtDetailModal } from './components/DebtDetailModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PlanningTab } from './components/Planning/PlanningTab';
import { PinLockScreen } from './components/Security/PinLockScreen';
import { SettingsModal } from './components/Settings/SettingsModal';

type MainTab = 'dettes' | 'planning';
type FilterType = 'all' | 'je_dois' | 'on_me_doit' | 'overdue' | 'settled';
type SortType = 'due_date' | 'recent' | 'amount_desc';

export default function App() {
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('dettes');

  // Security Lock
  const [isLocked, setIsLocked] = useState(() => isPinProtectionEnabled());

  // Debts state
  const [debts, setDebts] = useState<Debt[]>([]);
  const [tasks, setTasks] = useState<PlanningTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');
  const [currencyFilter, setCurrencyFilter] = useState<'ALL' | Currency>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortType>('due_date');

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Backup reminder indicator
  const backupReminderActive = useMemo(() => isBackupReminderDue(), [debts, isSettingsOpen]);

  // Load from IndexedDB on startup
  const refreshDebts = async () => {
    try {
      const items = await getAllDebts();
      setDebts(items);
    } catch (err) {
      console.error('Erreur chargement dettes IndexedDB:', err);
    }
  };

  const refreshTasks = async () => {
    try {
      const taskList = await getAllTasks();
      setTasks(taskList);
    } catch (err) {
      console.error('Erreur chargement tâches IndexedDB:', err);
    }
  };

  useEffect(() => {
    const initData = async () => {
      setIsLoading(true);
      await Promise.all([refreshDebts(), refreshTasks()]);
      setIsLoading(false);
    };
    initData();
  }, []);

  // Compute dashboard totals (FC and USD strictly separated)
  const totals = useMemo(() => {
    return calculateDashboardTotals(debts);
  }, [debts]);

  // Compute planning items for badge count
  const planningItems = useMemo(() => {
    return buildUnifiedPlanningItems(debts, tasks);
  }, [debts, tasks]);

  const planningAlertCount = useMemo(() => {
    return planningItems.filter((i) => !i.isCompleted && (i.isOverdue || i.isToday)).length;
  }, [planningItems]);

  // Check and dispatch local browser notifications
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const notifSettings = getNotificationSettings();
    if (!notifSettings.enabled) return;

    const todayStr = getTodayDateString();
    // Only notify once per calendar day
    if (notifSettings.lastNotifiedDate === todayStr) return;

    const dueItems = getItemsNeedingNotification(planningItems, notifSettings.leadDays);
    if (dueItems.length > 0) {
      const title = `Mes Dettes : ${dueItems.length} échéance${dueItems.length > 1 ? 's' : ''} à venir`;
      const body = dueItems
        .slice(0, 2)
        .map((i) => i.title)
        .join(' · ') + (dueItems.length > 2 ? '...' : '');

      try {
        new Notification(title, {
          body,
          icon: '/icon-192.png',
        });
        saveNotificationSettings({
          ...notifSettings,
          lastNotifiedDate: todayStr,
        });
      } catch (e) {
        console.error('Notification error:', e);
      }
    }
  }, [planningItems]);

  // Currently opened debt in detail modal
  const selectedDebt = useMemo(() => {
    if (!selectedDebtId) return null;
    return debts.find((d) => d.id === selectedDebtId) || null;
  }, [debts, selectedDebtId]);

  // Filtered and sorted debts
  const filteredDebts = useMemo(() => {
    return debts
      .filter((debt) => {
        const summary = getDebtSummary(debt);

        // Filter by category
        if (selectedFilter === 'je_dois' && debt.type !== 'je_dois') return false;
        if (selectedFilter === 'on_me_doit' && debt.type !== 'on_me_doit') return false;
        if (selectedFilter === 'overdue' && !summary.isOverdue) return false;
        if (selectedFilter === 'settled' && !summary.isSettled) return false;

        // Currency filter
        if (currencyFilter !== 'ALL' && debt.currency !== currencyFilter) return false;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchesName = debt.personName.toLowerCase().includes(q);
          const matchesReason = debt.reason ? debt.reason.toLowerCase().includes(q) : false;
          const matchesPhone = debt.phoneNumber ? debt.phoneNumber.includes(q) : false;
          if (!matchesName && !matchesReason && !matchesPhone) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'recent') {
          return b.createdAt - a.createdAt;
        }
        if (sortBy === 'amount_desc') {
          return b.initialAmount - a.initialAmount;
        }
        // default: due_date
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
  }, [debts, selectedFilter, currencyFilter, searchQuery, sortBy]);

  // Handlers for Debt CRUD
  const handleSaveDebt = async (debtData: any) => {
    const isEdit = !!debtData.id;
    let saved: Debt;

    if (isEdit) {
      const existing = debts.find((d) => d.id === debtData.id);
      saved = {
        ...debtData,
        repayments: existing?.repayments || [],
        createdAt: existing?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };
    } else {
      saved = {
        ...debtData,
        id: 'debt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        repayments: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    await saveDebt(saved);
    await refreshDebts();
  };

  const handleDeleteDebt = async (debtId: string) => {
    await deleteDebt(debtId);
    setSelectedDebtId(null);
    await refreshDebts();
  };

  const handleAddRepayment = async (
    debtId: string,
    payment: { amount: number; date: string; note?: string }
  ) => {
    await addRepaymentToDebt(debtId, payment);
    await refreshDebts();
  };

  const handleDeleteRepayment = async (debtId: string, repaymentId: string) => {
    await deleteRepaymentFromDebt(debtId, repaymentId);
    await refreshDebts();
  };

  // Handlers for Planning Task CRUD
  const handleSaveTask = async (taskData: any) => {
    const isEdit = !!taskData.id;
    let savedTask: PlanningTask;

    if (isEdit) {
      const existing = tasks.find((t) => t.id === taskData.id);
      savedTask = {
        ...taskData,
        completed: existing?.completed || false,
        createdAt: existing?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };
    } else {
      savedTask = {
        ...taskData,
        id: 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        completed: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    await saveTask(savedTask);
    await refreshTasks();
  };

  const handleToggleTask = async (taskId: string) => {
    await toggleTaskCompleted(taskId);
    await refreshTasks();
  };

  const handleDeleteTask = async (taskId: string) => {
    await deleteTask(taskId);
    await refreshTasks();
  };

  // If PIN protection is enabled, display the lock screen on startup
  if (isLocked) {
    return <PinLockScreen onUnlock={() => setIsLocked(false)} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Non-intrusive Offline status */}
      <OfflineIndicator />

      {/* Main Container constrained to mobile max-width */}
      <div className="max-w-md mx-auto w-full px-4 pt-4 pb-28 flex-1 flex flex-col">
        {/* Top App Header */}
        <header className="flex items-center justify-between pb-3 mb-3 border-b border-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-amber-500/20 border border-slate-800 flex items-center justify-center text-emerald-400 font-black text-sm shadow-inner">
              MD
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                Mes Dettes
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  Hors ligne
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span>Stockage local IndexedDB</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <PWAInstallButton />
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="relative p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition cursor-pointer"
              title="Paramètres, Code PIN & Sauvegarde"
              aria-label="Ouvrir les paramètres"
            >
              <SettingsIcon className="w-4 h-4" />
              {backupReminderActive && (
                <span
                  className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse ring-2 ring-slate-950"
                  title="Sauvegarde mensuelle recommandée"
                />
              )}
            </button>
          </div>
        </header>

        {/* Primary Tabs Navigation: « Dettes » & « Planning » */}
        <nav className="grid grid-cols-2 p-1 rounded-2xl bg-slate-900/90 border border-slate-800 mb-4" aria-label="Navigation principale">
          <button
            type="button"
            onClick={() => setActiveMainTab('dettes')}
            className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
              activeMainTab === 'dettes'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wallet className="w-4 h-4 text-emerald-400" />
            <span>Dettes</span>
            {totals.totalCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-700 text-slate-300">
                {totals.totalCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab('planning')}
            className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition relative cursor-pointer ${
              activeMainTab === 'planning'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar className="w-4 h-4 text-indigo-400" />
            <span>Planning</span>
            {planningAlertCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-600 text-white font-bold">
                {planningAlertCount}
              </span>
            )}
          </button>
        </nav>

        {/* TAB 1: DETTES (Intact & unchanged) */}
        {activeMainTab === 'dettes' && (
          <div className="space-y-4">
            {/* Dashboard Financial Overview (FC and USD separate) */}
            <section>
              <Dashboard
                totals={totals}
                activeFilter={selectedFilter}
                onSelectFilter={(f) => setSelectedFilter(f)}
              />
            </section>

            {/* Search & Currency Filter Controls */}
            <section className="space-y-2.5">
              {/* Search bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher par nom, motif, tél..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-white"
                  >
                    Effacer
                  </button>
                )}
              </div>

              {/* Filter Chips Scrollable on small screens */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedFilter('all')}
                  className={`px-3 py-1.5 rounded-xl font-medium shrink-0 transition cursor-pointer ${
                    selectedFilter === 'all'
                      ? 'bg-slate-200 text-slate-950 font-semibold shadow-sm'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Toutes ({totals.totalCount})
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedFilter('on_me_doit')}
                  className={`px-3 py-1.5 rounded-xl font-medium shrink-0 transition cursor-pointer ${
                    selectedFilter === 'on_me_doit'
                      ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  On me doit
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedFilter('je_dois')}
                  className={`px-3 py-1.5 rounded-xl font-medium shrink-0 transition cursor-pointer ${
                    selectedFilter === 'je_dois'
                      ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Je dois
                </button>

                {totals.overdueCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedFilter('overdue')}
                    className={`px-3 py-1.5 rounded-xl font-medium shrink-0 transition flex items-center gap-1 cursor-pointer ${
                      selectedFilter === 'overdue'
                        ? 'bg-rose-500 text-white font-semibold shadow-sm'
                        : 'bg-rose-950/40 border border-rose-900/60 text-rose-400 hover:text-rose-300'
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>En retard ({totals.overdueCount})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedFilter('settled')}
                  className={`px-3 py-1.5 rounded-xl font-medium shrink-0 transition flex items-center gap-1 cursor-pointer ${
                    selectedFilter === 'settled'
                      ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Soldées ({totals.settledCount})</span>
                </button>
              </div>

              {/* Secondary bar: Currency toggle & Sort */}
              <div className="flex items-center justify-between text-xs pt-1">
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-slate-500 mr-1">Devise :</span>
                  <button
                    type="button"
                    onClick={() => setCurrencyFilter('ALL')}
                    className={`px-2 py-0.5 rounded-md text-[11px] transition cursor-pointer ${
                      currencyFilter === 'ALL'
                        ? 'bg-slate-800 text-white font-semibold'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    Toutes
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrencyFilter('USD')}
                    className={`px-2 py-0.5 rounded-md text-[11px] transition cursor-pointer ${
                      currencyFilter === 'USD'
                        ? 'bg-slate-800 text-white font-semibold'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    USD ($)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrencyFilter('FC')}
                    className={`px-2 py-0.5 rounded-md text-[11px] transition cursor-pointer ${
                      currencyFilter === 'FC'
                        ? 'bg-slate-800 text-white font-semibold'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    FC
                  </button>
                </div>

                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortType)}
                    className="bg-transparent text-slate-400 focus:outline-none cursor-pointer"
                  >
                    <option value="due_date" className="bg-slate-900 text-white">Échéance</option>
                    <option value="recent" className="bg-slate-900 text-white">Plus récentes</option>
                    <option value="amount_desc" className="bg-slate-900 text-white">Montant élevé</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Debts List or Pure Empty State */}
            <section className="space-y-2.5 flex-1">
              {isLoading ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Chargement des données locales...
                </div>
              ) : filteredDebts.length > 0 ? (
                filteredDebts.map((debt) => (
                  <DebtCard
                    key={debt.id}
                    debt={debt}
                    onClick={() => setSelectedDebtId(debt.id)}
                  />
                ))
              ) : debts.length === 0 ? (
                // Absolute empty state: application starts with no fake data
                <div className="py-12 px-6 text-center rounded-3xl bg-slate-900/40 border border-dashed border-slate-800 my-auto">
                  <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 mx-auto flex items-center justify-center text-slate-600 mb-4 shadow-inner">
                    <Coins className="w-7 h-7 text-emerald-400/80" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-1.5">Aucune dette enregistrée</h3>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed mb-5">
                    L'application démarre vide. Vos données restent exclusivement stockées sur votre appareil (IndexedDB).
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingDebt(null);
                      setIsFormOpen(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-lg shadow-emerald-950 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Ajouter ma première dette</span>
                  </button>
                </div>
              ) : (
                // No items matching current filter
                <div className="py-8 text-center text-xs text-slate-500">
                  Aucune dette ne correspond aux critères sélectionnés.
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 2: PLANNING */}
        {activeMainTab === 'planning' && (
          <section className="flex-1">
            <PlanningTab
              debts={debts}
              tasks={tasks}
              onOpenDebt={(debtId) => setSelectedDebtId(debtId)}
              onSaveTask={handleSaveTask}
              onToggleTask={handleToggleTask}
              onDeleteTask={handleDeleteTask}
            />
          </section>
        )}
      </div>

      {/* Floating Action Button (FAB) for adding Debt (only on dettes tab) */}
      {activeMainTab === 'dettes' && (
        <div className="fixed bottom-5 left-0 right-0 max-w-md mx-auto px-4 z-30 pointer-events-none">
          <button
            type="button"
            onClick={() => {
              setEditingDebt(null);
              setIsFormOpen(true);
            }}
            className="pointer-events-auto w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-2xl shadow-emerald-950 border border-emerald-400/30 transition cursor-pointer"
            aria-label="Ajouter une nouvelle dette ou créance"
          >
            <Plus className="w-5 h-5" />
            <span>Nouvelle dette ou créance</span>
          </button>
        </div>
      )}

      {/* Debt Creation / Edition Form Modal */}
      {isFormOpen && (
        <DebtFormModal
          initialDebt={editingDebt}
          onSave={handleSaveDebt}
          onClose={() => {
            setIsFormOpen(false);
            setEditingDebt(null);
          }}
        />
      )}

      {/* Debt Detail Modal */}
      {selectedDebt && (
        <DebtDetailModal
          debt={selectedDebt}
          onClose={() => setSelectedDebtId(null)}
          onEdit={() => {
            setEditingDebt(selectedDebt);
            setSelectedDebtId(null);
            setIsFormOpen(true);
          }}
          onDelete={() => handleDeleteDebt(selectedDebt.id)}
          onAddRepayment={handleAddRepayment}
          onDeleteRepayment={handleDeleteRepayment}
        />
      )}

      {/* Settings Modal (PIN & Backup/Restore) */}
      {isSettingsOpen && (
        <SettingsModal
          debts={debts}
          tasks={tasks}
          onDataRestored={async () => {
            await Promise.all([refreshDebts(), refreshTasks()]);
          }}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </div>
  );
}
