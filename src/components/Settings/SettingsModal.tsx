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
  Clock,
  FileText,
  UserCheck,
} from 'lucide-react';
import { Debt } from '../../types/debt';
import { PlanningTask } from '../../types/planning';
import { Contract } from '../../types/contract';
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
  mergeContracts,
} from '../../utils/securityAndBackup';
import { replaceEntireDatabase, mergeDatabase } from '../../services/db';
import { isLenderProfileConfigured } from '../../services/lenderProfile';

interface SettingsModalProps {
  debts: Debt[];
  tasks: PlanningTask[];
  contracts?: Contract[];
  onOpenLenderProfile?: () => void;
  onDataRestored: () => Promise<void>;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  debts,
  tasks,
  contracts = [],
  onOpenLenderProfile,
  onDataRestored,
  onClose,
}) => {
  const [pinEnabled, setPinEnabled] = useState(isPinProtectionEnabled());
  const [pinStep, setPinStep] = useState<'idle' | 'enter_new' | 'confirm_new' | 'verify_to_disable'>('idle');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [verifyCurrentPin, setVerifyCurrentPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const [lastBackup, setLastBackup] = useState<string | null>(getLastBackupDate());
  const [backupDue, setBackupDue] = useState(isBackupReminderDue());
  const [restorePayload, setRestorePayload] = useState<{
    debts: Debt[];
    tasks: PlanningTask[];
    contracts: Contract[];
    exportedAt: string;
  } | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleExportBackup = () => {
    try {
      triggerBackupDownload(debts, tasks, contracts);
      setLastBackup(new Date().toISOString());
      setBackupDue(false);
      setSuccessMessage('Sauvegarde JSON téléchargée avec succès.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e: unknown) {
      setRestoreError((e as Error)?.message || 'Erreur lors de la sauvegarde.');
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
      } catch (err: unknown) {
        setRestoreError((err as Error)?.message || 'Fichier JSON invalide.');
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
        await replaceEntireDatabase(
          restorePayload.debts,
          restorePayload.tasks,
          restorePayload.contracts || []
        );
      } else {
        const mergedDebtsList = mergeDebts(debts, restorePayload.debts);
        const mergedTasksList = mergeTasks(tasks, restorePayload.tasks);
        const mergedContractsList = mergeContracts(contracts, restorePayload.contracts || []);
        await mergeDatabase(mergedDebtsList, mergedTasksList, mergedContractsList);
      }

      await onDataRestored();
      setRestorePayload(null);
      setSuccessMessage(
        mode === 'replace'
          ? 'Données remplacées avec succès depuis la sauvegarde.'
          : 'Données fusionnées avec succès.'
      );
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      setRestoreError((err as Error)?.message || 'Erreur lors de la restauration.');
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
      <div className="w-full max-w-lg rounded-t-[16px] sm:rounded-[16px] bg-[#1C232D] border border-[#2A3340] p-4 sm:p-5 text-[#ECE9E2] max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2A3340]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[8px] bg-[#151A22] border border-[#2A3340] p-1 flex items-center justify-center overflow-hidden">
              <img src="/lk-logo.png" alt="LK manage" className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#ECE9E2]">LK manage</h2>
              <p className="text-xs text-[#98A2B0]">Paramètres, sécurité et sauvegardes</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-[8px] text-[#98A2B0] hover:text-[#ECE9E2] hover:bg-[#151A22] transition flex items-center justify-center cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto py-4 space-y-4 flex-1 pr-1 text-xs">
          {successMessage && (
            <div className="p-3 rounded-[8px] bg-[#151A22] border border-[#5FB48C] text-[#5FB48C] font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#5FB48C]" />
              <span>{successMessage}</span>
            </div>
          )}

          {restoreError && (
            <div className="p-3 rounded-[8px] bg-[#151A22] border border-[#E5604D] text-[#E5604D] font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#E5604D]" />
              <span>{restoreError}</span>
            </div>
          )}

          {/* SECTION 1: CODE PIN */}
          <div className="p-4 rounded-[8px] bg-[#151A22] border border-[#2A3340] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-[8px] bg-[#1C232D] border border-[#2A3340] flex items-center justify-center text-[#C8A96A]">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-[#ECE9E2]">Verrouillage par code PIN</h3>
                  <p className="text-xs text-[#98A2B0]">
                    {pinEnabled ? 'Code PIN actif à l’ouverture' : 'Désactivé (accès direct)'}
                  </p>
                </div>
              </div>

              <div>
                {pinEnabled ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-[#1C232D] border border-[#5FB48C] text-[#5FB48C] text-xs font-semibold">
                    <Lock className="w-3 h-3" /> Actif
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-[#1C232D] text-[#98A2B0] border border-[#2A3340] text-xs font-medium">
                    <Unlock className="w-3 h-3" /> Désactivé
                  </span>
                )}
              </div>
            </div>

            <p className="text-xs text-[#98A2B0] leading-relaxed">
              Le code PIN à 4 chiffres est stocké sous forme hachée (SHA-256) sur cet appareil et sera demandé à chaque ouverture de l'application.
            </p>

            {pinStep === 'idle' && (
              <div className="pt-1 flex items-center gap-2">
                {pinEnabled ? (
                  <>
                    <button
                      type="button"
                      onClick={handleStartSetPin}
                      className="flex-1 min-h-[44px] rounded-[8px] bg-[#1C232D] hover:bg-[#2A3340] text-[#ECE9E2] border border-[#2A3340] font-medium transition cursor-pointer"
                    >
                      Modifier le PIN
                    </button>
                    <button
                      type="button"
                      onClick={handleStartDisablePin}
                      className="flex-1 min-h-[44px] rounded-[8px] bg-[#1C232D] hover:bg-[#2A3340] text-[#E5604D] border border-[#2A3340] font-medium transition cursor-pointer"
                    >
                      Désactiver
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartSetPin}
                    className="w-full min-h-[44px] rounded-[8px] bg-[#C8A96A] hover:bg-[#d6b777] text-[#151A22] font-semibold transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Activer un code PIN</span>
                  </button>
                )}
              </div>
            )}

            {(pinStep === 'enter_new' || pinStep === 'confirm_new') && (
              <form onSubmit={handleSaveNewPin} className="pt-2 space-y-2 border-t border-[#2A3340]">
                <div className="text-xs font-medium text-[#ECE9E2]">
                  {pinStep === 'enter_new'
                    ? 'Choisissez un code PIN à 4 chiffres'
                    : 'Confirmez votre code PIN'}
                </div>

                {pinError && (
                  <div className="text-xs text-[#E5604D] flex items-center gap-1">
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
                  className="w-full tracking-widest text-center text-lg font-bold min-h-[44px] bg-[#1C232D] border border-[#2A3340] rounded-[8px] text-[#ECE9E2] focus:outline-none focus:border-[#C8A96A]"
                />

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPinStep('idle');
                      setPinError(null);
                    }}
                    className="flex-1 min-h-[44px] rounded-[8px] bg-[#1C232D] text-[#98A2B0] hover:text-[#ECE9E2] border border-[#2A3340]"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 min-h-[44px] rounded-[8px] bg-[#C8A96A] hover:bg-[#d6b777] text-[#151A22] font-semibold"
                  >
                    {pinStep === 'enter_new' ? 'Continuer' : 'Enregistrer le PIN'}
                  </button>
                </div>
              </form>
            )}

            {pinStep === 'verify_to_disable' && (
              <form onSubmit={handleConfirmDisablePin} className="pt-2 space-y-2 border-t border-[#2A3340]">
                <div className="text-xs font-medium text-[#ECE9E2]">
                  Entrez votre code PIN actuel pour désactiver la protection
                </div>

                {pinError && (
                  <div className="text-xs text-[#E5604D] flex items-center gap-1">
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
                  className="w-full tracking-widest text-center text-lg font-bold min-h-[44px] bg-[#1C232D] border border-[#2A3340] rounded-[8px] text-[#ECE9E2] focus:outline-none focus:border-[#E5604D]"
                />

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPinStep('idle');
                      setPinError(null);
                    }}
                    className="flex-1 min-h-[44px] rounded-[8px] bg-[#1C232D] text-[#98A2B0] hover:text-[#ECE9E2] border border-[#2A3340]"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 min-h-[44px] rounded-[8px] bg-[#E5604D] hover:bg-[#eb7463] text-white font-semibold"
                  >
                    Confirmer la désactivation
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* SECTION 2: PROFIL DU PRÊTEUR */}
          <div className="p-4 rounded-[8px] bg-[#151A22] border border-[#2A3340] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-[8px] bg-[#1C232D] border border-[#2A3340] flex items-center justify-center text-[#C8A96A]">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-[#ECE9E2]">Profil du prêteur</h3>
                  <p className="text-xs text-[#98A2B0]">
                    Coordonnées, préavis et signature officielle
                  </p>
                </div>
              </div>

              {isLenderProfileConfigured() ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-[#1C232D] border border-[#5FB48C] text-[#5FB48C] text-xs font-semibold">
                  <CheckCircle2 className="w-3 h-3" /> Configuré
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-[#1C232D] border border-[#C8A96A] text-[#C8A96A] text-xs font-semibold">
                  À définir
                </span>
              )}
            </div>

            <p className="text-xs text-[#98A2B0] leading-relaxed">
              Enregistrez vos coordonnées complètes et votre signature dessinée au doigt (Kinshasa, préavis 7 jours par défaut) pour générer automatiquement vos contrats de prêt.
            </p>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenLenderProfile?.();
              }}
              className="w-full min-h-[44px] rounded-[8px] bg-[#1C232D] hover:bg-[#2A3340] text-[#C8A96A] border border-[#2A3340] font-semibold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <UserCheck className="w-4 h-4" />
              <span>{isLenderProfileConfigured() ? 'Modifier mon profil et ma signature' : 'Configurer mon profil de prêteur'}</span>
            </button>
          </div>

          {/* SECTION 3: SAUVEGARDE & RESTAURATION JSON */}
          <div className="p-4 rounded-[8px] bg-[#151A22] border border-[#2A3340] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-[8px] bg-[#1C232D] border border-[#2A3340] flex items-center justify-center text-[#5FB48C]">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-[#ECE9E2]">Sauvegarde et restauration</h3>
                  <p className="text-xs text-[#98A2B0]">Fichier JSON local (photos incluses)</p>
                </div>
              </div>
            </div>

            {backupDue ? (
              <div className="p-3 rounded-[8px] bg-[#1C232D] border border-[#C8A96A] text-[#ECE9E2] space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-[#C8A96A]">
                  <Clock className="w-4 h-4" />
                  <span>Rappel mensuel de sauvegarde</span>
                </div>
                <p className="text-xs text-[#98A2B0] leading-relaxed">
                  Vous n'avez pas exporté de sauvegarde depuis plus de 30 jours. Exportez un fichier JSON pour éviter toute perte en cas de changement de téléphone.
                </p>
              </div>
            ) : (
              <div className="text-xs text-[#98A2B0] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#5FB48C] shrink-0" />
                <span>Dernière sauvegarde : {formattedLastBackup}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleExportBackup}
                className="min-h-[44px] px-3 rounded-[8px] bg-[#C8A96A] hover:bg-[#d6b777] text-[#151A22] font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 text-xs"
              >
                <Download className="w-4 h-4" />
                <span>Sauvegarder (.json)</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[44px] px-3 rounded-[8px] bg-[#1C232D] hover:bg-[#2A3340] text-[#ECE9E2] border border-[#2A3340] font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 text-xs"
              >
                <Upload className="w-4 h-4" />
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

            {restorePayload && (
              <div className="mt-3 p-3.5 rounded-[8px] bg-[#1C232D] border border-[#5FB48C] space-y-2.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-[#2A3340]">
                  <span className="font-semibold text-[#ECE9E2] flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-[#5FB48C]" />
                    Fichier de sauvegarde prêt
                  </span>
                  <button
                    type="button"
                    onClick={() => setRestorePayload(null)}
                    className="text-[#98A2B0] hover:text-[#ECE9E2]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-1 text-[#98A2B0] text-xs">
                  <div>Dettes à importer : <strong className="text-[#ECE9E2]">{restorePayload.debts.length}</strong></div>
                  <div>Tâches à importer : <strong className="text-[#ECE9E2]">{restorePayload.tasks.length}</strong></div>
                  <div>
                    Exporté le : {new Date(restorePayload.exportedAt).toLocaleDateString('fr-FR')}
                  </div>
                </div>

                <div className="pt-1 text-xs font-semibold text-[#ECE9E2]">
                  Comment souhaitez-vous restaurer ces données ?
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleApplyRestore('merge')}
                    className="min-h-[44px] px-2.5 rounded-[8px] bg-[#151A22] hover:bg-[#2A3340] border border-[#2A3340] text-[#ECE9E2] font-semibold transition cursor-pointer flex flex-col items-center justify-center text-center"
                  >
                    <span>Fusionner</span>
                    <span className="text-[10px] text-[#98A2B0]">Conserver l'existant</span>
                  </button>

                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleApplyRestore('replace')}
                    className="min-h-[44px] px-2.5 rounded-[8px] bg-[#C8A96A] hover:bg-[#d6b777] text-[#151A22] font-semibold transition cursor-pointer flex flex-col items-center justify-center text-center"
                  >
                    <span>Remplacer</span>
                    <span className="text-[10px] text-[#151A22]/80">Écraser la base</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-[#2A3340]">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] rounded-[8px] bg-[#151A22] hover:bg-[#2A3340] text-xs font-medium text-[#ECE9E2] border border-[#2A3340] transition cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
