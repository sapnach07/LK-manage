import React, { useState, useEffect } from 'react';
import { Bell, BellRing, Check } from 'lucide-react';
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
        setFeedback('Notifications activées avec succès.');

        try {
          new Notification('LK manage - Rappels activés', {
            body: 'Vous recevrez vos rappels d’échéances et de tâches.',
            icon: '/icon-192.png',
          });
        } catch {
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
    <div className="p-3.5 rounded-[8px] bg-[#1C232D] border border-[#2A3340] space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[8px] bg-[#151A22] border border-[#2A3340] flex items-center justify-center text-[#C8A96A]">
            {permission === 'granted' ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-[#ECE9E2]">Rappels et notifications locales</h4>
            <p className="text-xs text-[#98A2B0]">
              {permission === 'granted'
                ? 'Actives sur cet appareil'
                : 'Alerte avant les échéances'}
            </p>
          </div>
        </div>

        {permission !== 'granted' ? (
          <button
            type="button"
            onClick={handleRequestPermission}
            className="min-h-[44px] px-3.5 rounded-[8px] bg-[#C8A96A] hover:bg-[#d6b777] text-xs font-semibold text-[#151A22] transition cursor-pointer"
          >
            Activer
          </button>
        ) : (
          <span className="text-xs font-medium px-2 py-1 rounded-[4px] bg-[#151A22] text-[#5FB48C] border border-[#2A3340] flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> Activées
          </span>
        )}
      </div>

      {feedback && (
        <div className="text-xs text-[#5FB48C] bg-[#151A22] p-2 rounded-[8px] border border-[#2A3340]">
          {feedback}
        </div>
      )}

      {/* Délai réglable */}
      <div className="pt-2 border-t border-[#2A3340] flex items-center justify-between text-xs">
        <span className="text-[#98A2B0]">Délai de rappel :</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleLeadDaysChange(0)}
            className={`min-h-[44px] px-3 rounded-[8px] text-xs font-medium transition cursor-pointer border ${
              leadDays === 0
                ? 'bg-[#C8A96A] text-[#151A22] border-[#C8A96A] font-semibold'
                : 'bg-[#151A22] text-[#98A2B0] hover:text-[#ECE9E2] border-[#2A3340]'
            }`}
          >
            Le jour même
          </button>
          <button
            type="button"
            onClick={() => handleLeadDaysChange(1)}
            className={`min-h-[44px] px-3 rounded-[8px] text-xs font-medium transition cursor-pointer border ${
              leadDays === 1
                ? 'bg-[#C8A96A] text-[#151A22] border-[#C8A96A] font-semibold'
                : 'bg-[#151A22] text-[#98A2B0] hover:text-[#ECE9E2] border-[#2A3340]'
            }`}
          >
            1 jour avant
          </button>
          <button
            type="button"
            onClick={() => handleLeadDaysChange(3)}
            className={`min-h-[44px] px-3 rounded-[8px] text-xs font-medium transition cursor-pointer border ${
              leadDays === 3
                ? 'bg-[#C8A96A] text-[#151A22] border-[#C8A96A] font-semibold'
                : 'bg-[#151A22] text-[#98A2B0] hover:text-[#ECE9E2] border-[#2A3340]'
            }`}
          >
            3 jours avant
          </button>
        </div>
      </div>
    </div>
  );
};
