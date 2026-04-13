import { useEffect, useRef } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { format } from 'date-fns';

// Audio elementini global sifatida yaratamiz — brauzer autoplay policy uchun
const alarmAudio = new Audio('/alarm.mp3');
alarmAudio.loop = true;

export function AlertModal() {
  const { state, dismissAlert } = useApp();
  const { activeAlerts } = state;
  const playedRef = useRef(false);

  useEffect(() => {
    if (activeAlerts.length > 0 && !playedRef.current) {
      playedRef.current = true;
      alarmAudio.currentTime = 0;
      alarmAudio.play().catch(() => {
        // Autoplay bloklangan — modal ko'rinadi, ovoz bosilgach chiqadi
      });
    } else if (activeAlerts.length === 0) {
      playedRef.current = false;
      alarmAudio.pause();
      alarmAudio.currentTime = 0;
    }
  }, [activeAlerts.length]);

  const handleConfirm = () => {
    alarmAudio.pause();
    alarmAudio.currentTime = 0;
    playedRef.current = false;
    activeAlerts.forEach(a => dismissAlert(a.id));
  };

  if (activeAlerts.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative z-10 bg-red-950 border-2 border-red-500 rounded-2xl shadow-2xl shadow-red-900/50 p-8 max-w-md w-full mx-4"
        onClick={() => {
          // Brauzer bloklasa, click orqali ovozni yoqish
          alarmAudio.play().catch(() => {});
        }}
      >
        {/* Animatsiyali aylana */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" />
            <div className="relative w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center">
              <AlertTriangle size={36} className="text-red-400 animate-bounce" />
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-red-300 text-center mb-2">
          OGOHLANTIRISH!
        </h2>
        <p className="text-red-400/70 text-sm text-center mb-4">Tasma yechildi — darhol tekshiring</p>

        <div className="space-y-3 mb-6">
          {activeAlerts.map(alert => (
            <div key={alert.id} className="bg-red-900/40 border border-red-700/50 rounded-xl p-4">
              <p className="text-white font-semibold text-lg whitespace-pre-line">{alert.message}</p>
              <p className="text-red-400 text-xs mt-1 font-mono">
                {format(new Date(alert.timestamp), 'dd.MM.yyyy HH:mm:ss')}
              </p>
            </div>
          ))}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            handleConfirm();
          }}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-lg rounded-xl transition-colors shadow-lg"
        >
          <Check size={22} />
          Tasdiqlash — Ovozni o'chirish
        </button>
      </div>
    </div>
  );
}
