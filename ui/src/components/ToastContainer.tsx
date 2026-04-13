import { useEffect } from 'react';
import { X, AlertTriangle, WifiOff } from 'lucide-react';
import { useApp } from '../context/AppContext';

export function ToastContainer() {
  const { state, dismissToast } = useApp();
  const { toasts } = state;

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    if (toasts.length === 0) return;
    const oldest = toasts[0];
    const timer = setTimeout(() => dismissToast(oldest.id), 8000);
    return () => clearTimeout(timer);
  }, [toasts, dismissToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium animate-in slide-in-from-right-5 ${
            toast.severity === 'danger'
              ? 'bg-red-900/90 border-red-500/50 text-red-100'
              : toast.severity === 'warning'
              ? 'bg-amber-900/90 border-amber-500/50 text-amber-100'
              : 'bg-slate-800/90 border-slate-600/50 text-slate-100'
          }`}
        >
          {toast.severity === 'danger' ? (
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-400" />
          ) : (
            <WifiOff size={16} className="mt-0.5 shrink-0 text-amber-400" />
          )}
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => dismissToast(toast.id)}
            className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
