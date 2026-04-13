import { ALARM_COLORS } from '../types';

interface Props { code: string; name: string; size?: 'sm' | 'md' }

const severeBg: Record<string, string> = {
  '01': 'bg-red-500/15 border border-red-500/40',
  '06': 'bg-red-500/15 border border-red-500/40',
  '02': 'bg-amber-500/15 border border-amber-500/40',
  '03': 'bg-orange-500/15 border border-orange-500/40',
  '19': 'bg-slate-500/15 border border-slate-500/40',
  '20': 'bg-orange-500/15 border border-orange-500/40',
  '21': 'bg-emerald-500/15 border border-emerald-500/40',
};

export function AlarmBadge({ code, name, size = 'sm' }: Props) {
  const textCls = ALARM_COLORS[code] ?? 'text-slate-300';
  const bgCls = severeBg[code] ?? 'bg-slate-700/40 border border-slate-600/40';
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium ${padding} ${bgCls} ${textCls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {name}
    </span>
  );
}
