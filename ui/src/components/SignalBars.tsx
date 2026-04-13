interface Props { value: number; max?: number }

export function SignalBars({ value, max = 31 }: Props) {
  const pct = Math.max(0, Math.min(1, value / max));
  const bars = 4;
  const filled = Math.round(pct * bars);
  const color =
    filled >= 3 ? 'bg-emerald-500' :
    filled >= 2 ? 'bg-amber-400' :
                  'bg-red-500';

  return (
    <div className="flex items-end gap-0.5 h-4">
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className={`w-1.5 rounded-sm transition-all ${
            i < filled ? color : 'bg-slate-600'
          }`}
          style={{ height: `${((i + 1) / bars) * 100}%` }}
        />
      ))}
    </div>
  );
}
