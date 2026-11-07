import React, { useEffect, useState } from 'react';
import { ShieldCheck, WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOnline) {
    return (
      <div className="fixed top-2 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs shadow-md">
        <WifiOff className="w-3.5 h-3.5 text-amber-400" />
        <span>Mode déconnecté (données locales intactes)</span>
      </div>
    );
  }

  return null;
};
