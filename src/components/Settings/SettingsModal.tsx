import React, { useState, useRef } from 'react';
import {
  X,
  Lock,
  Unlock,
  KeyRound,
  Download,
  Upload,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Calendar,
  Clock,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { Debt } from '../../types/debt';
import { PlanningTask } from '../../types/planning';
import {
  isPinProtectionEnabled,
  setPinCode,
  removePinCode,
  verifyPin,
  triggerBackupDownload,
  getLastBackupDate,
  isBackupReminderDue,
  parseAndValidateBackup,
  mergeDebts,
  mergeTasks,
} from '../../utils/securityAndBackup';
import { replaceEntireDatabase, mergeDatabase } from '../../services/db';

interface SettingsModalProps {
  debts: Debt[];
  tasks: PlanningTask[];
  onDataRestored: () => Promise<void>;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  debts,
  tasks,
  onDataRestored,
  onClose,
}) => {
  const [pinEnabled, setPinEnabled] = useState(isPinProtectionEnabled());
  const [pinStep, setPinStep] = useState<'idle' | 'enter_new' | 'confirm_new' | 'verify_to_disable'>('idle');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [verifyCurrentPin, setVerifyCurrentPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  // Backup & Restore states
  const [lastBackup, setLastBackup] = useState<string | null>(getLastBackupDate());
  const [backupDue, setBackupDue] = useState(isBackupReminderDue());
  const [restorePayload, setRestorePayload] = useState<{ debts: Debt[]; tasks: PlanningTask[]; exportedAt: string } | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ================= PIN Setup Handlers ================= */

  const handleStartSetPin = () => {
    setPinStep('enter_new');
    setNewPin('');
    setConfirmPin('');
    setPinError(null);
  };

  const handleStartDisablePin = () => {
    setPinStep('verify_to_disable');
    setVerifyCurrentPin('');
    setPinError(null);
  };

  const handleSaveNewPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);

    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setPinError('Le code PIN doit comporter exactement 4 chiffres.');
      return;
    }

    if (pinStep === 'enter_new') {
      setPinStep('confirm_new');
      return;
    }

    if (pinStep === 'confirm_new') {
      if (newPin !== confirmPin) {
        setPinError('Les deux codes saisis ne correspondent pas.');
        return;
      }

      await setPinCode(newPin);
      setPinEnabled(true);
      setPinStep('idle');
      setNewPin('');
      setConfirmPin('');
      setSuccessMessage('Code PIN activé avec succès.');
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  const handleConfirmDisablePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);

    const isValid = await verifyPin(verifyCurrentPin);
    if (!isValid) {
      setPinError('Code PIN actuel incorrect.');
      return;
    }

    removePinCode();
    setPinEnabled(false);
    setPinStep('idle');
    setVerifyCurrentPin('');
    setSuccessMessage('Protection par code PIN désactivée.');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  /* ================= Backup Export & Import Handlers ================= */

  const handleExportBackup = () => {
    try {
      triggerBackupDownload(debts, tasks);
      setLastBackup(new Date().toISOString());
      setBackupDue(false);
      setSuccessMessage('Sauvegarde JSON téléchargée avec succès.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e: any) {
      setRestoreError(e?.message || 'Erreur lors de la sauvegarde.');
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseAndValidateBackup(text);
        setRestorePayload(parsed);
      } catch (err: any) {
        setRestoreError(err?.message || 'Fichier JSON invalide.');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => setRestoreError('Erreur de lecture du fichier.');
    reader.readAsText(file);
  };

  const handleApplyRestore = async (mode: 'replace' | 'merge') => {
    if (!restorePayload) return;
    setIsProcessing(true);
    setRestoreError(null);

    try {
      if (mode === 'replace') {
        await replaceEntireDatabase(restorePayload.debts, restorePayload.tasks);
      } else {
        const mergedDebtsList = mergeDebts(debts, restorePayload.debts);
        const mergedTasksList = mergeTasks(tasks, restorePayload.tasks);
        await mergeDatabase(mergedDebtsList, mergedTasksList);
      }

      await onDataRestored();
      setRestorePayload(null);
      setSuccessMessage(
        mode === 'replace'
          ? 'Données remplacées avec succès depuis la sauvegarde.'
          : 'Données fusionnées avec succès.'
      );
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setRestoreError(err?.message || 'Erreur lors de la restauration.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formattedLastBackup = lastBackup
    ? new Date(lastBackup).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Aucune sauvegarde effectuée';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl text-slate-100 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-white">Paramètres & Sécurité</h2>
            <p className="text-xs text-slate-400">Code PIN et sauvegardes locales</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto py-4 space-y-5 flex-1 pr-1 text-xs">
          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {restoreError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{restoreError}</span>
            </div>
          )}

          {/* SECTION 1: CODE PIN OPTIONNEL (Haché SHA-256) */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`p-2 rounded-xl border ${
                    pinEnabled
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">Verrouillage par code PIN</h3>
                  <p className="text-[11px] text-slate-400">
                    {pinEnabled ? 'Code PIN actif à l’ouverture' : 'Désactivé (accès direct)'}
                  </p>
                </div>
              </div>

              <div>
                {pinEnabled ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-[11px]">
                    <Lock className="w-3 h-3" /> Actif
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 font-medium text-[11px]">
                    <Unlock className="w-3 h-3" /> Désactivé
                  </span>
                )}
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Le code PIN à 4 chiffres est stocké sous forme hachée sécurisée (SHA-256) sur votre appareil et sera demandé à chaque ouverture de l'application.
            </p>

            {/* PIN Actions / Sub-Forms */}
            {pinStep === 'idle' && (
              <div className="pt-1 flex items-center gap-2">
                {pinEnabled ? (
                  <>
                    <button
                      type="button"
                      onClick={handleStartSetPin}
                      className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 font-medium transition cursor-pointer"
                    >
                      Modifier le PIN
                    </button>
                    <button
                      type="button"
                      onClick={handleStartDisablePin}
                      className="flex-1 py-2 px-3 rounded-xl bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 border border-rose-800/50 font-medium transition cursor-pointer"
                    >
                      Désactiver
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartSetPin}
                    className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Activer un code PIN</span>
                  </button>
                )}
              </div>
            )}

            {/* Step: Enter new PIN or Confirm */}
            {(pinStep === 'enter_new' || pinStep === 'confirm_new') && (
              <form onSubmit={handleSaveNewPin} className="pt-2 space-y-2 border-t border-slate-800">
                <div className="text-[11px] font-semibold text-slate-300">
                  {pinStep === 'enter_new'
                    ? 'Choisissez un code PIN à 4 chiffres'
                    : 'Confirmez votre code PIN'}
                </div>

                {pinError && (
                  <div className="text-[11px] text-rose-400 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{pinError}</span>
                  </div>
                )}

                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  autoFocus
                  value={pinStep === 'enter_new' ? newPin : confirmPin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                    if (pinStep === 'enter_new') setNewPin(val);
                    else setConfirmPin(val);
                  }}
                  placeholder="••••"
                  className="w-full tracking-widest text-center text-lg font-bold py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                />

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPinStep('idle');
                      setPinError(null);
                    }}
                    className="flex-1 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md"
                  >
                    {pinStep === 'enter_new' ? 'Continuer' : 'Enregistrer le PIN'}
                  </button>
                </div>
              </form>
            )}

            {/* Step: Verify current PIN to disable */}
            {pinStep === 'verify_to_disable' && (
              <form onSubmit={handleConfirmDisablePin} className="pt-2 space-y-2 border-t border-slate-800">
                <div className="text-[11px] font-semibold text-slate-300">
                  Entrez votre code PIN actuel pour désactiver la protection
                </div>

                {pinError && (
                  <div className="text-[11px] text-rose-400 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{pinError}</span>
                  </div>
                )}

                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  autoFocus
                  value={verifyCurrentPin}
                  onChange={(e) => setVerifyCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                  className="w-full tracking-widest text-center text-lg font-bold py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-rose-500"
                />

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPinStep('idle');
                      setPinError(null);
                    }}
                    className="flex-1 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold shadow-md"
                  >
                    Confirmer la désactivation
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* SECTION 2: SAUVEGARDE & RESTAURATION JSON + RAPPEL MENSUEL */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">Sauvegarde & Restauration</h3>
                  <p className="text-[11px] text-slate-400">Fichier JSON (photos incluses)</p>
                </div>
              </div>
            </div>

            {/* Rappel mensuel de sauvegarde */}
            {backupDue ? (
              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/60 text-amber-200 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-amber-300">
                  <Clock className="w-3.5 h-3.5 animate-pulse" />
                  <span>Rappel mensuel de sauvegarde</span>
                </div>
                <p className="text-[11px] text-amber-300/80 leading-relaxed">
                  Vous n'avez pas exporté de sauvegarde depuis plus de 30 jours. Vos données étant stockées uniquement sur cet appareil, exportez un fichier JSON pour éviter toute perte en cas de changement de téléphone.
                </p>
              </div>
            ) : (
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Dernière sauvegarde : {formattedLastBackup}</span>
              </div>
            )}

            {/* Export & Import Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleExportBackup}
                className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Sauvegarder (.json)</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Restaurer (.json)</span>
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileSelected}
              className="hidden"
            />

            {/* Restore Confirmation Dialog: Fusionner ou Remplacer */}
            {restorePayload && (
              <div className="mt-3 p-3.5 rounded-2xl bg-slate-900 border border-emerald-500/40 space-y-2.5 shadow-xl">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    Fichier de sauvegarde prêt
                  </span>
                  <button
                    type="button"
                    onClick={() => setRestorePayload(null)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-1 text-slate-300 text-[11px]">
                  <div>Dettes à importer : <strong>{restorePayload.debts.length}</strong></div>
                  <div>Tâches à importer : <strong>{restorePayload.tasks.length}</strong></div>
                  <div className="text-slate-400">
                    Exporté le : {new Date(restorePayload.exportedAt).toLocaleDateString('fr-FR')}
                  </div>
                </div>

                <div className="pt-1 text-[11px] font-semibold text-white">
                  Comment souhaitez-vous restaurer ces données ?
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleApplyRestore('merge')}
                    className="py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold transition cursor-pointer flex flex-col items-center text-center"
                  >
                    <span>Fusionner</span>
                    <span className="text-[9px] font-normal text-slate-400">Conserver l'existant</span>
                  </button>

                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleApplyRestore('replace')}
                    className="py-2 px-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold transition cursor-pointer flex flex-col items-center text-center shadow-md shadow-amber-950"
                  >
                    <span>Remplacer</span>
                    <span className="text-[9px] font-normal text-amber-200">Écraser la base</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
