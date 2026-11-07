import React, { useState, useEffect } from 'react';
import { Lock, Delete, ShieldAlert, KeyRound } from 'lucide-react';
import { verifyPin } from '../../utils/securityAndBackup';

interface PinLockScreenProps {
  onUnlock: () => void;
}

export const PinLockScreen: React.FC<PinLockScreenProps> = ({ onUnlock }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [shake, setShake] = useState(false);

  // Handle number click
  const handleDigit = (digit: string) => {
    if (isVerifying || pin.length >= 4) return;
    setError(null);
    const newPin = pin + digit;
    setPin(newPin);

    if (newPin.length === 4) {
      checkPin(newPin);
    }
  };

  const handleDelete = () => {
    if (isVerifying) return;
    setError(null);
    setPin((prev) => prev.slice(0, -1));
  };

  const checkPin = async (candidate: string) => {
    setIsVerifying(true);
    try {
      const isValid = await verifyPin(candidate);
      if (isValid) {
        onUnlock();
      } else {
        setShake(true);
        setError('Code PIN incorrect');
        setTimeout(() => {
          setPin('');
          setShake(false);
          setIsVerifying(false);
        }, 500);
      }
    } catch (e) {
      setError('Erreur de vérification');
      setIsVerifying(false);
    }
  };

  // Support physical keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleDelete();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, isVerifying]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-between px-6 py-12 text-slate-100 select-none">
      {/* Top Branding */}
      <div className="flex flex-col items-center text-center space-y-3 pt-6">
        <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-900/60 border border-slate-800/80 p-1 flex items-center justify-center shadow-2xl shadow-amber-500/10">
          <img
            src="/lk-logo.png"
            alt="LK manage logo"
            className="w-full h-full object-contain drop-shadow"
          />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-white tracking-tight">LK manage</h1>
          <p className="text-xs text-slate-400 mt-1">Application sécurisée · 100% Hors ligne</p>
        </div>
      </div>

      {/* PIN Dots & Status */}
      <div className="flex flex-col items-center space-y-4 my-auto">
        <div className="text-sm font-medium text-slate-300">
          Entrez votre code PIN à 4 chiffres
        </div>

        <div className={`flex items-center gap-4 py-2 ${shake ? 'animate-bounce' : ''}`}>
          {[0, 1, 2, 3].map((index) => {
            const isFilled = pin.length > index;
            return (
              <div
                key={index}
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  isFilled
                    ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50 scale-110'
                    : 'border-2 border-slate-700 bg-slate-900/50'
                }`}
              />
            );
          })}
        </div>

        {error && (
          <div className="text-xs text-rose-400 font-medium flex items-center gap-1.5 animate-pulse">
            <ShieldAlert className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Numeric Touchpad */}
      <div className="w-full max-w-xs space-y-3 pb-4">
        <div className="grid grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              type="button"
              disabled={isVerifying}
              onClick={() => handleDigit(num)}
              className="h-16 rounded-2xl bg-slate-900/90 hover:bg-slate-800/90 active:scale-95 text-xl font-bold text-white border border-slate-800/80 transition-all flex items-center justify-center shadow-md cursor-pointer"
            >
              {num}
            </button>
          ))}

          {/* Bottom row: Blank, 0, Backspace */}
          <div className="h-16 flex items-center justify-center" />

          <button
            type="button"
            disabled={isVerifying}
            onClick={() => handleDigit('0')}
            className="h-16 rounded-2xl bg-slate-900/90 hover:bg-slate-800/90 active:scale-95 text-xl font-bold text-white border border-slate-800/80 transition-all flex items-center justify-center shadow-md cursor-pointer"
          >
            0
          </button>

          <button
            type="button"
            disabled={isVerifying || pin.length === 0}
            onClick={handleDelete}
            className="h-16 rounded-2xl bg-slate-900/50 hover:bg-slate-800/70 active:scale-95 text-slate-400 hover:text-white border border-slate-800/50 transition-all flex items-center justify-center shadow-md cursor-pointer disabled:opacity-30"
            aria-label="Effacer le dernier chiffre"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
