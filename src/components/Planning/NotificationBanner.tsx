import React, { useState, useEffect } from 'react';
import { Bell, BellRing, BellOff, Check, AlertCircle } from 'lucide-react';
import { NotificationLeadTime } from '../../types/planning';
import { getNotificationSettings, saveNotificationSettings } from '../../services/db';

interface NotificationBannerProps {
  onSettingsChanged?: (leadDays: NotificationLeadTime, enabled: boolean) => void;
}

export const NotificationBanner: React.FC<NotificationBannerProps> = ({ onSettingsChanged }) => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [leadDays, setLeadDays] = useState<NotificationLeadTime>(1);
  const [isSupported, setIsSupported] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setIsSupported(false);
      return;
    }
    setPermission(Notification.permission);

    const saved = getNotificationSettings();
    setLeadDays(saved.leadDays);
  }, []);

  const handleRequestPermission = async () => {
    if (!('Notification' in window)) {
      setIsSupported(false);
      return;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        saveNotificationSettings({ enabled: true, leadDays });
        onSettingsChanged?.(leadDays, true);
        setFeedback('Notifications activées avec succès !');

        // Optional quick welcome test notification
        try {
          new Notification('Mes Dettes - Rappels activés', {
            body: 'Vous recevrez vos rappels d’échéances et de tâches.',
            icon: '/icon-192.png',
          });
        } catch (e) {
          // ignore
        }
      } else {
        saveNotificationSettings({ enabled: false, leadDays });
        onSettingsChanged?.(leadDays, false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLeadDaysChange = (days: NotificationLeadTime) => {
    setLeadDays(days);
    saveNotificationSettings({ enabled: permission === 'granted', leadDays: days });
    onSettingsChanged?.(days, permission === 'granted');
    setFeedback(`Rappel réglé à : ${days === 0 ? 'Le jour même' : `${days} jour${days > 1 ? 's' : ''} avant`}`);
    setTimeout(() => setFeedback(null), 3000);
  };

  if (!isSupported) {
    return null;
  }

  return (
    <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`p-2 rounded-xl border ${
              permission === 'granted'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}
          >
            {permission === 'granted' ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          </div>
          <div>
            <h4 className="text-xs font-semibold text-white">Rappels & Notifications locales</h4>
            <p className="text-[11px] text-slate-400">
              {permission === 'granted'
                ? 'Actives sur cet appareil'
                : 'Soyez averti(e) avant les échéances'}
            </p>
          </div>
        </div>

        {permission !== 'granted' ? (
          <button
            type="button"
            onClick={handleRequestPermission}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-sm transition cursor-pointer"
          >
            Activer
          </button>
        ) : (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
            <Check className="w-3 h-3" /> Activées
          </span>
        )}
      </div>

      {feedback && (
        <div className="text-[11px] text-emerald-400 bg-emerald-950/30 px-2.5 py-1 rounded-lg border border-emerald-800/40">
          {feedback}
        </div>
      )}

      {/* Délai réglable */}
      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
        <span className="text-[11px] text-slate-400">Délai de rappel :</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleLeadDaysChange(0)}
            className={`px-2 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer ${
              leadDays === 0
                ? 'bg-slate-700 text-white font-semibold'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200'
            }`}
          >
            Le jour même
          </button>
          <button
            type="button"
            onClick={() => handleLeadDaysChange(1)}
            className={`px-2 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer ${
              leadDays === 1
                ? 'bg-slate-700 text-white font-semibold'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200'
            }`}
          >
            1 jour avant
          </button>
          <button
            type="button"
            onClick={() => handleLeadDaysChange(3)}
            className={`px-2 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer ${
              leadDays === 3
                ? 'bg-slate-700 text-white font-semibold'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200'
            }`}
          >
            3 jours avant
          </button>
        </div>
      </div>
    </div>
  );
};
