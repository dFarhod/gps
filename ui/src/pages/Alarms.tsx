import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, RefreshCw, ExternalLink } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useApi } from '../hooks/useApi';
import { api } from '../api';
import { AlarmBadge } from '../components/AlarmBadge';

const ALARM_TYPES = [
  'Barchasi', 'SOS', 'Low battery', 'Take off', 'Fall',
  'Sedentary', 'Power OFF', 'Out of geofence', 'Enter geofence',
];

export function Alarms() {
  const { data: alarms, loading, error, refetch } = useApi(() => api.alarms(200));
  const [filter, setFilter] = useState('Barchasi');
  const [imeiFilter, setImeiFilter] = useState('');
  const [personFilter, setPersonFilter] = useState('');

  const filtered = (alarms ?? []).filter((a) => {
    const typeMatch = filter === 'Barchasi' || a.alarm_name === filter;
    const imeiMatch = !imeiFilter || a.imei.includes(imeiFilter);
    const personMatch = !personFilter || (a.full_name ?? '').toLowerCase().includes(personFilter.toLowerCase());
    return typeMatch && imeiMatch && personMatch;
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Bell size={22} className="text-red-400" />
            Alarmlar
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {filtered.length} ta alarm{filter !== 'Barchasi' ? ` · ${filter}` : ''}
          </p>
        </div>
        <button
          onClick={refetch}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Yangilash
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {ALARM_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === t
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="IMEI bo'yicha filter..."
          value={imeiFilter}
          onChange={(e) => setImeiFilter(e.target.value)}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-64"
        />
        <input
          type="text"
          placeholder="F.I.Sh bo'yicha filter..."
          value={personFilter}
          onChange={(e) => setPersonFilter(e.target.value)}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-64"
        />
      </div>

      {/* Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Yuklanmoqda...</div>
        ) : error ? (
          <div className="p-12 text-center text-red-400">Database ulanmadi</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500">Alarmlar yo'q</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-700 bg-slate-800/80">
                  {['Vaqt', 'Shaxs', 'IMEI', 'Alarm', 'Koordinat', ''].map((h) => (
                    <th key={h} className="px-5 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {filtered.map((alarm) => (
                  <tr key={alarm.id} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-5 py-3">
                      <div className="text-xs text-slate-300 font-mono">
                        {format(new Date(alarm.created_at), 'dd.MM.yyyy HH:mm:ss')}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {formatDistanceToNow(new Date(alarm.created_at), { addSuffix: true })}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-200">
                      {alarm.full_name ?? 'Biriktirilmagan'}
                    </td>
                    <td className="px-5 py-3 font-mono text-sm text-slate-300">
                      <Link to={`/devices/${alarm.imei}`} className="hover:text-emerald-400">
                        {alarm.imei}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <AlarmBadge code={alarm.alarm_code} name={alarm.alarm_name} size="md" />
                    </td>
                    <td className="px-5 py-3 text-xs font-mono text-slate-400">
                      {alarm.latitude?.toFixed(5)}, {alarm.longitude?.toFixed(5)}
                    </td>
                    <td className="px-5 py-3">
                      <a
                        href={`https://www.google.com/maps?q=${alarm.latitude},${alarm.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-500 hover:text-emerald-400"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
