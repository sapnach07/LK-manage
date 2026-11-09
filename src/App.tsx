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
  FileText,
  FileSignature,
} from 'lucide-react';
import { Debt, Currency } from './types/debt';
import { PlanningTask } from './types/planning';
import { Contract } from './types/contract';
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
  getAllContracts,
  saveContract,
  getNotificationSettings,
  saveNotificationSettings,
} from './services/db';
import { getLenderProfile, isLenderProfileConfigured } from './services/lenderProfile';
import { buildContractFullText, generateContractNumber } from './utils/contractGenerator';
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
import { ContractsList } from './components/Contracts/ContractsList';
import { ContractSigningModal } from './components/Contracts/ContractSigningModal';
import { ContractDetailModal } from './components/Contracts/ContractDetailModal';
import { AmendmentModal } from './components/Contracts/AmendmentModal';
import { LenderProfileModal } from './components/Contracts/LenderProfileModal';

type MainTab = 'dettes' | 'planning' | 'contrats';
type FilterType = 'all' | 'je_dois' | 'on_me_doit' | 'overdue' | 'settled';
type SortType = 'due_date' | 'recent' | 'amount_desc';

export default function App() {
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('dettes');

  // Security Lock
  const [isLocked, setIsLocked] = useState(() => isPinProtectionEnabled());

  // Debts & Planning state
  const [debts, setDebts] = useState<Debt[]>([]);
  const [tasks, setTasks] = useState<PlanningTask[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');
  const [currencyFilter, setCurrencyFilter] = useState<'ALL' | Currency>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortType>('due_date');

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [formDefaultToContract, setFormDefaultToContract] = useState(false);
  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Contract specific modals
  const [isLenderProfileOpen, setIsLenderProfileOpen] = useState(false);
  const [contractSigningDraft, setContractSigningDraft] = useState<any | null>(null);
  const [selectedContractForDetail, setSelectedContractForDetail] = useState<Contract | null>(null);
  const [contractToAmend, setContractToAmend] = useState<Contract | null>(null);

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

  const refreshContracts = async () => {
    try {
      const contractList = await getAllContracts();
      setContracts(contractList);
    } catch (err) {
      console.error('Erreur chargement contrats IndexedDB:', err);
    }
  };

  useEffect(() => {
    const initData = async () => {
      setIsLoading(true);
      await Promise.all([refreshDebts(), refreshTasks(), refreshContracts()]);
      setIsLoading(false);
    };
    initData();
  }, []);

  // Notifications check on startup & when planning items update
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const notifSettings = getNotificationSettings();
    if (!notifSettings.enabled) return;

    const todayStr = getTodayDateString();
    if (notifSettings.lastNotifiedDate === todayStr) return;

    const planningItems = buildUnifiedPlanningItems(debts, tasks);
    const dueItems = getItemsNeedingNotification(planningItems, notifSettings.leadDays);
    if (dueItems.length > 0) {
      const title = `LK manage : ${dueItems.length} échéance${dueItems.length > 1 ? 's' : ''} à venir`;
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
        // notification suppressed
      }
    }
  }, [debts, tasks]);

  // Handle Debt CRUD
  const handleSaveDebt = async (
    debtData: Omit<Debt, 'id' | 'createdAt' | 'updatedAt' | 'repayments'> & { id?: string }
  ): Promise<Debt> => {
    const now = Date.now();
    let saved: Debt;

    if (debtData.id) {
      const existing = debts.find((d) => d.id === debtData.id);
      const updated: Debt = {
        ...existing!,
        ...debtData,
        id: debtData.id,
        updatedAt: now,
      };
      saved = await saveDebt(updated);
    } else {
      const newDebt: Debt = {
        ...debtData,
        id: 'debt_' + now + '_' + Math.random().toString(36).substring(2, 7),
        repayments: [],
        createdAt: now,
        updatedAt: now,
      };
      saved = await saveDebt(newDebt);
    }

    await refreshDebts();
    return saved;
  };

  const handleDeleteDebt = async (id: string) => {
    await deleteDebt(id);
    setSelectedDebtId(null);
    await refreshDebts();
  };

  const handleAddRepayment = async (debtId: string, payment: { amount: number; date: string; note?: string }) => {
    await addRepaymentToDebt(debtId, payment);
    await refreshDebts();
  };

  const handleDeleteRepayment = async (debtId: string, repaymentId: string) => {
    await deleteRepaymentFromDebt(debtId, repaymentId);
    await refreshDebts();
  };

  // Handle Tasks CRUD for Planning
  const handleSaveTask = async (
    taskData: Omit<PlanningTask, 'id' | 'createdAt' | 'updatedAt' | 'completed'> & { id?: string }
  ) => {
    const now = Date.now();
    let saved: PlanningTask;
    if (taskData.id) {
      const existing = tasks.find((t) => t.id === taskData.id);
      saved = {
        ...existing!,
        ...taskData,
        id: taskData.id,
        completed: existing?.completed ?? false,
        updatedAt: now,
      };
    } else {
      saved = {
        ...taskData,
        id: 'task_' + now + '_' + Math.random().toString(36).substring(2, 7),
        completed: false,
        createdAt: now,
        updatedAt: now,
      };
    }
    await saveTask(saved);
    await refreshTasks();
  };

  const handleToggleTask = async (id: string) => {
    await toggleTaskCompleted(id);
    await refreshTasks();
  };

  const handleDeleteTask = async (id: string) => {
    await deleteTask(id);
    await refreshTasks();
  };

  // Contract Flow from Debt Form: NO DEBT IS SAVED AT THIS STAGE!
  const handleRequestReadAndSign = async (params: {
    debtData: Omit<Debt, 'id' | 'createdAt' | 'updatedAt' | 'repayments'>;
    contractParams: {
      otherPartyAddress: string;
      deliveryMethods: any[];
      hasDueDate: boolean;
      dueDate?: string;
      noticeDays?: number;
      latePenalty?: any;
      witness?: any;
      borrowerIdentity?: any;
    };
  }) => {
    const lender = getLenderProfile();
    if (!isLenderProfileConfigured(lender)) {
      setIsLenderProfileOpen(true);
      throw new Error('Veuillez d’abord renseigner vos coordonnées et votre signature officielle dans le profil.');
    }

    const isJeDois = params.debtData.type === 'je_dois';
    const contractNumber = generateContractNumber(contracts.length);
    const now = new Date();
    const signedAtFormatted = now.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Lender and Borrower depending on debt type:
    // If on_me_doit: Lender is user (lender profile), Borrower is other person
    // If je_dois: Lender is other person, Borrower is user (lender profile)
    const lenderData = isJeDois
      ? {
          fullName: params.debtData.personName,
          address: params.contractParams.otherPartyAddress,
          phone: params.debtData.phoneNumber,
          city: lender.city || 'Kinshasa',
          jurisdictionCity: lender.defaultJurisdiction || 'Kinshasa',
        }
      : {
          fullName: lender.fullName,
          address: lender.address,
          phone: lender.phone,
          city: lender.city || 'Kinshasa',
          jurisdictionCity: lender.defaultJurisdiction || 'Kinshasa',
        };

    const borrowerData = isJeDois
      ? {
          fullName: lender.fullName,
          address: lender.address,
          phone: lender.phone,
          identity: params.contractParams.borrowerIdentity,
        }
      : {
          fullName: params.debtData.personName,
          address: params.contractParams.otherPartyAddress,
          phone: params.debtData.phoneNumber,
          identity: params.contractParams.borrowerIdentity,
        };

    const draftBase = {
      id: 'ctr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      debtId: '', // Will be assigned atomically upon signature validation!
      contractNumber,
      createdAt: Date.now(),
      signedAt: signedAtFormatted,
      status: 'active' as const,
      isLocked: false,
      debtType: params.debtData.type,
      lender: lenderData,
      borrower: borrowerData,
      principalAmount: params.debtData.initialAmount,
      currency: params.debtData.currency,
      startDate: params.debtData.startDate,
      deliveryMethods: params.contractParams.deliveryMethods,
      interestType: params.debtData.interestType,
      interestRate: params.debtData.interestRate,
      fixedInterestAmount: params.debtData.interestFixedAmount,
      hasDueDate: params.contractParams.hasDueDate,
      dueDate: params.contractParams.hasDueDate ? params.contractParams.dueDate : undefined,
      noticeDays: !params.contractParams.hasDueDate ? (params.contractParams.noticeDays || 7) : undefined,
      latePenalty: params.contractParams.latePenalty,
      witness: params.contractParams.witness,
      // For on_me_doit: user is lender, so lenderSignature is ready, borrower will sign live
      // For je_dois: user is borrower, so borrowerSignature is ready, lender will sign live
      lenderSignature: isJeDois ? '' : lender.signature,
      borrowerSignature: isJeDois ? lender.signature : '',
      templateVersion: 'v2' as const,
      amendments: [],
      preCalculatedDebt: params.debtData,
    };

    const contractText = buildContractFullText(draftBase as any, {
      shortLegalClausesEnabled: lender.shortLegalClausesEnabled,
    });

    // Close form and open reading/signing modal directly
    setIsFormOpen(false);
    setContractSigningDraft({
      ...draftBase,
      contractText,
    });
  };

  // Calculations for Financial Dashboard
  const totals = useMemo(() => calculateDashboardTotals(debts), [debts]);

  // Planning alerts count (today or overdue)
  const planningAlertCount = useMemo(() => {
    const items = buildUnifiedPlanningItems(debts, tasks);
    const today = getTodayDateString();
    return items.filter((i) => !i.isCompleted && i.date <= today).length;
  }, [debts, tasks]);

  // Filtered & Sorted Debts
  const filteredDebts = useMemo(() => {
    return debts
      .filter((debt) => {
        const summary = getDebtSummary(debt);

        if (selectedFilter === 'je_dois' && debt.type !== 'je_dois') return false;
        if (selectedFilter === 'on_me_doit' && debt.type !== 'on_me_doit') return false;
        if (selectedFilter === 'overdue' && !summary.isOverdue) return false;
        if (selectedFilter === 'settled' && !summary.isSettled) return false;

        if (currencyFilter !== 'ALL' && debt.currency !== currencyFilter) return false;

        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim();
          const matchName = debt.personName.toLowerCase().includes(query);
          const matchReason = debt.reason.toLowerCase().includes(query);
          const matchPhone = debt.phoneNumber.includes(query);
          return matchName || matchReason || matchPhone;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'due_date') {
          return a.dueDate.localeCompare(b.dueDate);
        }
        if (sortBy === 'recent') {
          return b.createdAt - a.createdAt;
        }
        if (sortBy === 'amount_desc') {
          return b.initialAmount - a.initialAmount;
        }
        return 0;
      });
  }, [debts, selectedFilter, currencyFilter, searchQuery, sortBy]);

  const selectedDebt = useMemo(() => {
    if (!selectedDebtId) return null;
    return debts.find((d) => d.id === selectedDebtId) || null;
  }, [debts, selectedDebtId]);

  // If PIN protection is enabled, display the lock screen on startup
  if (isLocked) {
    return <PinLockScreen onUnlock={() => setIsLocked(false)} />;
  }

  return (
    <div className="min-h-screen bg-[#151A22] text-[#ECE9E2] flex flex-col justify-between">
      {/* Non-intrusive Offline status */}
      <OfflineIndicator />

      {/* Main Container constrained to mobile max-width */}
      <div className="max-w-md mx-auto w-full px-4 pt-4 pb-28 flex-1 flex flex-col">
        {/* Top App Header */}
        <header className="flex items-center justify-between pb-3 mb-3 border-b border-[#2A3340]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-[8px] bg-[#1C232D] border border-[#2A3340] p-1 flex items-center justify-center overflow-hidden shrink-0">
              <img
                src="/lk-logo.png"
                alt="Logo LK manage"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-base font-semibold text-[#ECE9E2] tracking-tight flex items-center gap-2">
                LK manage
                <span className="text-xs font-normal px-2 py-0.5 rounded-[4px] bg-[#1C232D] text-[#98A2B0] border border-[#2A3340]">
                  Hors ligne
                </span>
              </h1>
              <p className="text-xs text-[#98A2B0] flex items-center gap-1.5 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#5FB48C]" />
                <span>Stockage local chiffré</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <PWAInstallButton />
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="relative w-11 h-11 rounded-[8px] bg-[#1C232D] hover:bg-[#252F3D] text-[#ECE9E2] border border-[#2A3340] flex items-center justify-center transition cursor-pointer"
              title="Paramètres, Code PIN & Sauvegarde"
              aria-label="Ouvrir les paramètres"
            >
              <SettingsIcon className="w-5 h-5" />
              {backupReminderActive && (
                <span
                  className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#C8A96A]"
                  title="Sauvegarde mensuelle recommandée"
                />
              )}
            </button>
          </div>
        </header>

        {/* Primary Tabs Navigation: « Dettes », « Planning », « Contrats » */}
        <nav className="grid grid-cols-3 p-1 rounded-[8px] bg-[#1C232D] border border-[#2A3340] mb-4" aria-label="Navigation principale">
          <button
            type="button"
            onClick={() => setActiveMainTab('dettes')}
            className={`min-h-[44px] py-2 px-2 rounded-[6px] text-sm font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeMainTab === 'dettes'
                ? 'bg-[#C8A96A] text-[#151A22]'
                : 'text-[#98A2B0] hover:text-[#ECE9E2]'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Dettes</span>
            {totals.totalCount > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full tabular-nums ${
                activeMainTab === 'dettes' ? 'bg-[#151A22] text-[#C8A96A]' : 'bg-[#151A22] text-[#98A2B0]'
              }`}>
                {totals.totalCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab('planning')}
            className={`min-h-[44px] py-2 px-2 rounded-[6px] text-sm font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeMainTab === 'planning'
                ? 'bg-[#C8A96A] text-[#151A22]'
                : 'text-[#98A2B0] hover:text-[#ECE9E2]'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Planning</span>
            {planningAlertCount > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full tabular-nums ${
                activeMainTab === 'planning' ? 'bg-[#151A22] text-[#E5604D]' : 'bg-[#E5604D] text-[#ECE9E2]'
              }`}>
                {planningAlertCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab('contrats')}
            className={`min-h-[44px] py-2 px-2 rounded-[6px] text-sm font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeMainTab === 'contrats'
                ? 'bg-[#C8A96A] text-[#151A22]'
                : 'text-[#98A2B0] hover:text-[#ECE9E2]'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Contrats</span>
            {contracts.length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full tabular-nums ${
                activeMainTab === 'contrats' ? 'bg-[#151A22] text-[#C8A96A]' : 'bg-[#151A22] text-[#98A2B0]'
              }`}>
                {contracts.length}
              </span>
            )}
          </button>
        </nav>

        {/* TAB 1: DETTES */}
        {activeMainTab === 'dettes' && (
          <div className="space-y-3">
            {/* Dashboard Financial Overview (FC and USD separate) */}
            <section>
              <Dashboard
                totals={totals}
                activeFilter={selectedFilter}
                onSelectFilter={(filter) => setSelectedFilter(filter)}
                debts={debts}
              />
            </section>

            {/* Search and Filters Bar */}
            <section className="space-y-2 pt-1">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Rechercher par nom, motif, tél..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full min-h-[44px] pl-10 pr-3 py-2.5 rounded-[8px] bg-[#1C232D] border border-[#2A3340] text-[#ECE9E2] placeholder-[#98A2B0] text-sm focus:outline-none focus:border-[#C8A96A]"
                />
                <Search className="w-4 h-4 text-[#98A2B0] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Status Filters (min 44px touch targets) */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-sm">
                <button
                  type="button"
                  onClick={() => setSelectedFilter('all')}
                  className={`min-h-[40px] px-3.5 py-2 rounded-[8px] font-medium shrink-0 transition cursor-pointer ${
                    selectedFilter === 'all'
                      ? 'bg-[#1C232D] text-[#ECE9E2] border border-[#C8A96A]'
                      : 'bg-[#151A22] text-[#98A2B0] hover:text-[#ECE9E2] border border-[#2A3340]'
                  }`}
                >
                  Toutes ({totals.totalCount})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFilter('on_me_doit')}
                  className={`min-h-[40px] px-3.5 py-2 rounded-[8px] font-medium shrink-0 transition cursor-pointer ${
                    selectedFilter === 'on_me_doit'
                      ? 'bg-[#1C232D] text-[#5FB48C] border border-[#5FB48C]'
                      : 'bg-[#151A22] text-[#98A2B0] hover:text-[#ECE9E2] border border-[#2A3340]'
                  }`}
                >
                  On me doit
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFilter('je_dois')}
                  className={`min-h-[40px] px-3.5 py-2 rounded-[8px] font-medium shrink-0 transition cursor-pointer ${
                    selectedFilter === 'je_dois'
                      ? 'bg-[#1C232D] text-[#ECE9E2] border border-[#C8A96A]'
                      : 'bg-[#151A22] text-[#98A2B0] hover:text-[#ECE9E2] border border-[#2A3340]'
                  }`}
                >
                  Je dois
                </button>
                {totals.overdueCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedFilter('overdue')}
                    className={`min-h-[40px] px-3.5 py-2 rounded-[8px] font-medium shrink-0 transition cursor-pointer ${
                      selectedFilter === 'overdue'
                        ? 'bg-[#1C232D] text-[#E5604D] border border-[#E5604D]'
                        : 'bg-[#151A22] text-[#E5604D] border border-[#2A3340]'
                    }`}
                  >
                    En retard ({totals.overdueCount})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedFilter('settled')}
                  className={`min-h-[40px] px-3.5 py-2 rounded-[8px] font-medium shrink-0 transition cursor-pointer ${
                    selectedFilter === 'settled'
                      ? 'bg-[#1C232D] text-[#5FB48C] border border-[#5FB48C]'
                      : 'bg-[#151A22] text-[#98A2B0] hover:text-[#ECE9E2] border border-[#2A3340]'
                  }`}
                >
                  Soldées ({totals.settledCount})
                </button>
              </div>

              {/* Currency & Sort Bar */}
              <div className="flex items-center justify-between text-xs pt-1 border-t border-[#2A3340]">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-[#98A2B0]">Devise :</span>
                  {(['ALL', 'USD', 'FC'] as const).map((curr) => (
                    <button
                      key={curr}
                      type="button"
                      onClick={() => setCurrencyFilter(curr)}
                      className={`min-h-[32px] px-2.5 py-1 rounded-[6px] font-medium text-xs transition cursor-pointer ${
                        currencyFilter === curr
                          ? 'bg-[#1C232D] text-[#ECE9E2] border border-[#C8A96A]'
                          : 'text-[#98A2B0] hover:text-[#ECE9E2]'
                      }`}
                    >
                      {curr === 'ALL' ? 'Toutes' : curr === 'USD' ? 'USD' : 'FC'}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <ArrowUpDown className="w-3.5 h-3.5 text-[#98A2B0]" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortType)}
                    className="min-h-[32px] bg-[#1C232D] border border-[#2A3340] rounded-[6px] px-2 py-1 text-xs text-[#ECE9E2] focus:outline-none cursor-pointer"
                  >
                    <option value="due_date" className="bg-[#1C232D] text-[#ECE9E2]">Échéance</option>
                    <option value="recent" className="bg-[#1C232D] text-[#ECE9E2]">Plus récentes</option>
                    <option value="amount_desc" className="bg-[#1C232D] text-[#ECE9E2]">Montant élevé</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Debts List in Ledger Format (separated by fine line border) */}
            <section>
              {isLoading ? (
                <div className="py-12 text-center text-sm text-[#98A2B0]">
                  Chargement du registre...
                </div>
              ) : filteredDebts.length > 0 ? (
                <div className="rounded-[8px] bg-[#1C232D] border border-[#2A3340] overflow-hidden">
                  {filteredDebts.map((debt) => (
                    <DebtCard
                      key={debt.id}
                      debt={debt}
                      hasContract={contracts.some((c) => c.debtId === debt.id)}
                      onClick={() => setSelectedDebtId(debt.id)}
                    />
                  ))}
                </div>
              ) : debts.length === 0 ? (
                <div className="py-12 px-6 text-center rounded-[8px] bg-[#1C232D] border border-[#2A3340]">
                  <div className="w-12 h-12 rounded-[8px] bg-[#151A22] border border-[#2A3340] mx-auto flex items-center justify-center text-[#98A2B0] mb-3">
                    <Coins className="w-6 h-6 text-[#C8A96A]" />
                  </div>
                  <h3 className="text-base font-semibold text-[#ECE9E2] mb-1">Aucune dette enregistrée</h3>
                  <p className="text-sm text-[#98A2B0] max-w-xs mx-auto leading-relaxed mb-4">
                    Le registre est vide. Vos données sont conservées hors ligne sur cet appareil.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingDebt(null);
                      setFormDefaultToContract(false);
                      setIsFormOpen(true);
                    }}
                    className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-[8px] bg-[#C8A96A] hover:bg-[#bfa05f] text-[#151A22] text-sm font-semibold transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Enregistrer une dette</span>
                  </button>
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-[#98A2B0] bg-[#1C232D] rounded-[8px] border border-[#2A3340]">
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

        {/* TAB 3: CONTRATS */}
        {activeMainTab === 'contrats' && (
          <section className="flex-1">
            <ContractsList
              contracts={contracts}
              debts={debts}
              onOpenContractDetail={(c) => setSelectedContractForDetail(c)}
              onOpenAmendment={(c) => setContractToAmend(c)}
              onOpenLenderProfile={() => setIsLenderProfileOpen(true)}
              onOpenDebt={(debtId) => setSelectedDebtId(debtId)}
              onOpenNewDebtWithContract={() => {
                setEditingDebt(null);
                setFormDefaultToContract(true);
                setIsFormOpen(true);
              }}
            />
          </section>
        )}
      </div>

      {/* Primary Action Button (Fixed at bottom on Dettes tab) */}
      {activeMainTab === 'dettes' && (
        <div className="fixed bottom-4 left-0 right-0 max-w-md mx-auto px-4 z-30 pointer-events-none">
          <button
            type="button"
            onClick={() => {
              setEditingDebt(null);
              setFormDefaultToContract(true);
              setIsFormOpen(true);
            }}
            className="pointer-events-auto w-full min-h-[48px] py-3 px-4 rounded-[8px] bg-[#C8A96A] hover:bg-[#bfa05f] active:bg-[#b29454] text-[#151A22] text-base font-semibold flex items-center justify-center gap-2 border border-[#C8A96A] transition cursor-pointer"
            aria-label="Enregistrer une dette"
          >
            <Plus className="w-5 h-5" />
            <span>Enregistrer une dette</span>
          </button>
        </div>
      )}

      {/* Debt Creation / Edition Form Modal */}
      {isFormOpen && (
        <DebtFormModal
          initialDebt={editingDebt}
          existingDebts={debts}
          defaultToContractMode={formDefaultToContract}
          onSaveWithoutContract={handleSaveDebt}
          onRequestReadAndSign={handleRequestReadAndSign}
          onClose={() => {
            setIsFormOpen(false);
            setEditingDebt(null);
            setFormDefaultToContract(true);
          }}
        />
      )}

      {/* Debt Detail Modal */}
      {selectedDebt && (
        <DebtDetailModal
          debt={selectedDebt}
          contract={contracts.find((c) => c.debtId === selectedDebt.id) || null}
          onClose={() => setSelectedDebtId(null)}
          onEdit={() => {
            setEditingDebt(selectedDebt);
            setSelectedDebtId(null);
            setIsFormOpen(true);
          }}
          onDelete={() => handleDeleteDebt(selectedDebt.id)}
          onAddRepayment={handleAddRepayment}
          onDeleteRepayment={handleDeleteRepayment}
          onOpenAmendmentForDebt={(c) => setContractToAmend(c)}
          onRetryAsNewDebt={(d) => {
            // "Sur une dette « Non signée », un bouton « Ressaisir » ouvre un nouveau formulaire pré-rempli avec ses informations, pour établir un contrat sur une NOUVELLE dette. L'ancienne dette n'est pas modifiée."
            setEditingDebt(null); // New debt!
            setFormDefaultToContract(true);
            setSelectedDebtId(null);
            setIsFormOpen(true);
          }}
        />
      )}

      {/* Contract In-App Review & Signing Modal */}
      {contractSigningDraft && (
        <ContractSigningModal
          contractDraft={contractSigningDraft}
          onContractFinalized={async (signed, debtData) => {
            // Atomic save of both debt AND contract together!
            if (debtData) {
              const now = Date.now();
              const newDebt: Debt = {
                ...debtData,
                id: 'debt_' + now + '_' + Math.random().toString(36).substring(2, 7),
                repayments: [],
                isUnsigned: false,
                createdAt: now,
                updatedAt: now,
              };
              await saveDebt(newDebt);
              signed.debtId = newDebt.id;
            }

            await saveContract(signed);
            await Promise.all([refreshDebts(), refreshContracts()]);
            setSelectedContractForDetail(signed);
            setContractSigningDraft(null);
          }}
          onSignCancelled={async (action) => {
            if (action === 'save_unsigned' && contractSigningDraft.preCalculatedDebt) {
              const now = Date.now();
              const unsignedDebt: Debt = {
                ...contractSigningDraft.preCalculatedDebt,
                id: 'debt_' + now + '_' + Math.random().toString(36).substring(2, 7),
                repayments: [],
                isUnsigned: true,
                createdAt: now,
                updatedAt: now,
              };
              await saveDebt(unsignedDebt);
              await refreshDebts();
            }
            // If action === 'abandon', nothing is saved!
            setContractSigningDraft(null);
          }}
          onClose={() => setContractSigningDraft(null)}
        />
      )}

      {/* Contract Detail & Management Modal */}
      {selectedContractForDetail && (
        <ContractDetailModal
          contract={selectedContractForDetail}
          debt={debts.find((d) => d.id === selectedContractForDetail.debtId) || null}
          onClose={() => setSelectedContractForDetail(null)}
          onOpenAmendment={(c) => {
            setSelectedContractForDetail(null);
            setContractToAmend(c);
          }}
          onContractUpdated={async (updated) => {
            await refreshContracts();
            setSelectedContractForDetail(updated);
          }}
        />
      )}

      {/* Contract Amendment Modal */}
      {contractToAmend && (
        <AmendmentModal
          contract={contractToAmend}
          debt={debts.find((d) => d.id === contractToAmend.debtId) || null}
          onClose={() => setContractToAmend(null)}
          onAmendmentCreated={async (updatedContract) => {
            await Promise.all([refreshContracts(), refreshDebts()]);
            setSelectedContractForDetail(updatedContract);
            setContractToAmend(null);
          }}
        />
      )}

      {/* Lender Profile & Signature Modal */}
      <LenderProfileModal
        isOpen={isLenderProfileOpen}
        onClose={() => setIsLenderProfileOpen(false)}
        onSaved={async () => {
          // Re-render
        }}
      />

      {/* Settings Modal (PIN, Backup/Restore & Lender Profile) */}
      {isSettingsOpen && (
        <SettingsModal
          debts={debts}
          tasks={tasks}
          contracts={contracts}
          onOpenLenderProfile={() => {
            setIsSettingsOpen(false);
            setIsLenderProfileOpen(true);
          }}
          onDataRestored={async () => {
            await Promise.all([refreshDebts(), refreshTasks(), refreshContracts()]);
          }}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </div>
  );
}
