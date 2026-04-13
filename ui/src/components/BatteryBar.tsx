interface Props { value: number; showText?: boolean }

export function BatteryBar({ value, showText = true }: Props) {
  const pct = Math.max(0, Math.min(100, value));
  const color =
    pct > 60 ? 'bg-emerald-500' :
    pct > 30 ? 'bg-amber-400' :
               'bg-red-500';

  return (
    <div className="flex items-center gap-2">
      <div className="relative w-8 h-4 border border-slate-500 rounded-sm flex items-center px-0.5">
        <div
          className={`h-2.5 rounded-sm transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
        <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-1 h-2 bg-slate-500 rounded-r-sm" />
      </div>
      {showText && (
        <span className={`text-xs font-mono ${color.replace('bg-', 'text-')}`}>{pct}%</span>
      )}
    </div>
  );
}
