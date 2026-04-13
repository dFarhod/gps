import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, RefreshCw, Activity, Thermometer, Droplets, Wind } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useApi } from '../hooks/useApi';
import { api } from '../api';
import type { HealthRecord } from '../types';

const TYPE_CONFIG: Record<number, { label: string; unit: string; icon: typeof Heart; color: string; bg: string }> = {
  1: { label: 'Qon bosimi', unit: 'mmHg', icon: Activity,    color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20' },
  2: { label: 'Yurak urish', unit: 'bpm',  icon: Heart,       color: 'text-pink-400',   bg: 'bg-pink-500/10 border-pink-500/20' },
  3: { label: "Tana harorat", unit: '°C', icon: Thermometer, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
  4: { label: 'Qon kislorod', unit: '%',   icon: Wind,        color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20' },
};

function SummaryCard({ type, records }: { type: number; records: HealthRecord[] }) {
  const cfg = TYPE_CONFIG[type];
  if (!cfg || records.length === 0) return null;
  const Icon = cfg.icon;
  const latest = records[0];

  return (
    <div className={`border rounded-xl p-4 ${cfg.bg}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} className={cfg.color} />
        <span className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</span>
      </div>
      <div className="text-2xl font-bold text-slate-100">
        {latest.value}
        <span className="text-sm font-normal text-slate-400 ml-1">{cfg.unit}</span>
      </div>
      <div className="text-xs text-slate-500 mt-1">
        {records.length} ta yozuv · {formatDistanceToNow(new Date(latest.created_at), { addSuffix: true })}
      </div>
    </div>
  );
}

export function HealthData() {
  const { data: records, loading, error, refetch } = useApi(() => api.health(200));
  const [typeFilter, setTypeFilter] = useState<number | null>(null);
  const [imeiFilter, setImeiFilter] = useState('');

  const filtered = (records ?? []).filter((r) => {
    const typeMatch = typeFilter === null || r.type === typeFilter;
    const imeiMatch = !imeiFilter || r.imei.includes(imeiFilter);
    return typeMatch && imeiMatch;
  });

  const byType: Record<number, HealthRecord[]> = {};
  (records ?? []).forEach((r) => {
    if (!byType[r.type]) byType[r.type] = [];
    byType[r.type].push(r);
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Heart size={22} className="text-pink-400" />
            Sog'liq ma'lumotlari
          </h1>
          <p className="text-slate-400 text-sm mt-1">{filtered.length} ta yozuv</p>
        </div>
        <button
          onClick={refetch}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Yangilash
        </button>
      </div>

      {/* Summary cards */}
      {!loading && !error && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((t) => (
            <SummaryCard key={t} type={t} records={byType[t] ?? []} />
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setTypeFilter(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              typeFilter === null
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200'
            }`}
          >
            Barchasi
          </button>
          {Object.entries(TYPE_CONFIG).map(([t, cfg]) => (
            <button
              key={t}
              onClick={() => setTypeFilter(Number(t))}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                typeFilter === Number(t)
                  ? `bg-emerald-500/20 text-emerald-400 border border-emerald-500/30`
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200'
              }`}
            >
              {cfg.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="IMEI..."
          value={imeiFilter}
          onChange={(e) => setImeiFilter(e.target.value)}
          className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-48"
        />
      </div>

      {/* Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Yuklanmoqda...</div>
        ) : error ? (
          <div className="p-12 text-center text-red-400">Database ulanmadi</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500">Ma'lumot yo'q</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-700 bg-slate-800/80">
                  {['Vaqt', 'IMEI', 'Tur', 'Qiymat'].map((h) => (
                    <th key={h} className="px-5 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {filtered.map((r) => {
                  const cfg = TYPE_CONFIG[r.type];
                  return (
                    <tr key={r.id} className="hover:bg-slate-700/20 transition-colors">
                      <td className="px-5 py-3">
                        <div className="text-xs text-slate-300 font-mono">
                          {format(new Date(r.created_at), 'dd.MM.yyyy HH:mm:ss')}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                        </div>
                      </td>
                      <td className="px-5 py-3 font-mono text-sm">
                        <Link to={`/devices/${r.imei}`} className="text-slate-300 hover:text-emerald-400">
                          {r.imei}
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        {cfg ? (
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.color}`}>
                            <cfg.icon size={11} />
                            {cfg.label}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">{r.type_name}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 font-mono font-bold text-slate-100">
                        {r.value}
                        {cfg && <span className="text-xs font-normal text-slate-500 ml-1">{cfg.unit}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
