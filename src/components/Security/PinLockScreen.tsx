import React, { useState, useEffect } from 'react';
import { Delete, AlertCircle } from 'lucide-react';
import { verifyPin } from '../../utils/securityAndBackup';

interface PinLockScreenProps {
  onUnlock: () => void;
}

export const PinLockScreen: React.FC<PinLockScreenProps> = ({ onUnlock }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [shake, setShake] = useState(false);

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
    } catch {
      setError('Erreur de vérification');
      setIsVerifying(false);
    }
  };

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
    <div className="fixed inset-0 z-50 bg-[#151A22] flex flex-col items-center justify-between px-6 py-12 text-[#ECE9E2] select-none">
      {/* Top Branding */}
      <div className="flex flex-col items-center text-center space-y-3 pt-6">
        <div className="w-20 h-20 rounded-[8px] bg-[#1C232D] border border-[#2A3340] p-1.5 flex items-center justify-center overflow-hidden">
          <img
            src="/lk-logo.png"
            alt="LK manage logo"
            className="w-full h-full object-contain"
          />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#ECE9E2] tracking-tight">LK manage</h1>
          <p className="text-xs text-[#98A2B0] mt-1">Application sécurisée · 100% hors ligne</p>
        </div>
      </div>

      {/* PIN Dots & Status */}
      <div className="flex flex-col items-center space-y-4 my-auto">
        <div className="text-sm font-medium text-[#98A2B0]">
          Entrez votre code PIN à 4 chiffres
        </div>

        <div className={`flex items-center gap-4 py-2 ${shake ? 'animate-bounce' : ''}`}>
          {[0, 1, 2, 3].map((index) => {
            const isFilled = pin.length > index;
            return (
              <div
                key={index}
                className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                  isFilled
                    ? 'bg-[#C8A96A]'
                    : 'border border-[#2A3340] bg-[#1C232D]'
                }`}
              />
            );
          })}
        </div>

        {error && (
          <div className="text-xs text-[#E5604D] font-medium flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" />
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
              className="h-14 rounded-[8px] bg-[#1C232D] hover:bg-[#2A3340] text-xl font-semibold text-[#ECE9E2] border border-[#2A3340] transition-colors flex items-center justify-center cursor-pointer tabular-nums"
            >
              {num}
            </button>
          ))}

          {/* Bottom row: Blank, 0, Backspace */}
          <div className="h-14 flex items-center justify-center" />

          <button
            type="button"
            disabled={isVerifying}
            onClick={() => handleDigit('0')}
            className="h-14 rounded-[8px] bg-[#1C232D] hover:bg-[#2A3340] text-xl font-semibold text-[#ECE9E2] border border-[#2A3340] transition-colors flex items-center justify-center cursor-pointer tabular-nums"
          >
            0
          </button>

          <button
            type="button"
            disabled={isVerifying || pin.length === 0}
            onClick={handleDelete}
            className="h-14 rounded-[8px] bg-[#1C232D] hover:bg-[#2A3340] text-[#98A2B0] hover:text-[#ECE9E2] border border-[#2A3340] transition-colors flex items-center justify-center cursor-pointer disabled:opacity-30"
            aria-label="Effacer le dernier chiffre"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
