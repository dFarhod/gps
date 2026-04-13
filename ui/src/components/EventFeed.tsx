import { formatDistanceToNow } from 'date-fns';
import type { FeedEvent } from '../types';

const severityDot: Record<string, string> = {
  info:    'bg-blue-400',
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  danger:  'bg-red-500',
};

interface Props { events: FeedEvent[]; maxHeight?: string }

export function EventFeed({ events, maxHeight = 'max-h-96' }: Props) {
  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
        Hali hech qanday voqea yo'q...
      </div>
    );
  }

  return (
    <div className={`overflow-y-auto ${maxHeight} space-y-0`}>
      {events.map((ev) => (
        <div
          key={ev.id}
          className="flex items-start gap-3 px-4 py-2.5 border-b border-slate-700/60 hover:bg-slate-700/30 transition-colors"
        >
          <div className="flex-shrink-0 pt-1.5">
            <div className={`w-2 h-2 rounded-full ${severityDot[ev.severity]}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-200 truncate">{ev.label}</span>
              {ev.imei && (
                <span className="text-xs font-mono text-slate-500 truncate">{ev.imei}</span>
              )}
            </div>
            <p className="text-xs text-slate-400 truncate mt-0.5">{ev.detail}</p>
          </div>
          <span className="flex-shrink-0 text-xs text-slate-500 pt-0.5">
            {formatDistanceToNow(new Date(ev.timestamp), { addSuffix: true })}
          </span>
        </div>
      ))}
    </div>
  );
}
