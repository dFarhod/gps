import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, RefreshCw, MapPin, ChevronRight, Watch } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useApi } from '../hooks/useApi';
import { useApp } from '../context/AppContext';
import { api } from '../api';
import { BatteryBar } from '../components/BatteryBar';
import { SignalBars } from '../components/SignalBars';

export function Devices() {
  const { state } = useApp();
  const { data: devices, loading, error, refetch } = useApi(() => api.devices());
  const [search, setSearch] = useState('');

  const filtered = (devices ?? []).filter(
    (d) =>
      d.imei.includes(search) ||
      (d.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (d.iccid ?? '').includes(search) ||
      (d.firmware_version ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const isOnline = (lastSeen?: string) =>
    lastSeen ? Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000 : false;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Qurilmalar</h1>
          <p className="text-slate-400 text-sm mt-1">{devices?.length ?? 0} ta qurilma ro'yxatda</p>
        </div>
        <button
          onClick={refetch}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Yangilash
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="IMEI, F.I.Sh, ICCID yoki firmware bo'yicha qidiring..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
        />
      </div>

      {/* Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Yuklanmoqda...</div>
        ) : error ? (
          <div className="p-12 text-center text-red-400">
            <p className="font-medium">Database ulanmadi</p>
            <p className="text-sm mt-1 text-red-400/70">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            {search ? 'Qurilma topilmadi' : "Hali hech qanday qurilma yo'q"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 bg-slate-800/80 border-b border-slate-700">
                  <th className="px-5 py-3 font-medium">IMEI</th>
                  <th className="px-5 py-3 font-medium">Shaxs</th>
                  <th className="px-5 py-3 font-medium">Holat</th>
                  <th className="px-5 py-3 font-medium">Batareya</th>
                  <th className="px-5 py-3 font-medium">Signal</th>
                  <th className="px-5 py-3 font-medium">Firmware</th>
                  <th className="px-5 py-3 font-medium">Koordinat</th>
                  <th className="px-5 py-3 font-medium">So'nggi signal</th>
                  <th className="px-5 py-3 font-medium">Alarmlar</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filtered.map((device) => {
                  const online = isOnline(device.last_seen);
                  const livePos = state.positions.get(device.imei);
                  const battery = livePos?.battery ?? device.battery;
                  const gsm = livePos?.gsmSignal ?? device.gsm_signal;
                  const lat = livePos?.latitude ?? device.latitude;
                  const lng = livePos?.longitude ?? device.longitude;
                  const wearing = state.wearingStatus.get(device.imei);

                  return (
                    <tr
                      key={device.imei}
                      className="hover:bg-slate-700/30 transition-colors group"
                    >
                      <td className="px-5 py-3.5">
                        <div className="font-mono text-slate-200 text-sm">{device.imei}</div>
                        {device.iccid && (
                          <div className="font-mono text-xs text-slate-500 mt-0.5">{device.iccid}</div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-200">
                        {device.full_name ?? 'Biriktirilmagan'}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-1">
                          <span className={`flex items-center gap-1.5 text-xs font-medium w-fit px-2.5 py-1 rounded-full ${
                            online
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-slate-700 text-slate-500'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                            {online ? 'Online' : 'Offline'}
                          </span>
                          {wearing !== undefined && (
                            <span className={`flex items-center gap-1 text-xs w-fit px-2 py-0.5 rounded-full ${
                              wearing === 1
                                ? 'bg-blue-500/15 text-blue-400'
                                : 'bg-red-500/15 text-red-400'
                            }`}>
                              <Watch size={10} />
                              {wearing === 1 ? 'Kiyilgan' : 'Yechildi'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {battery != null ? <BatteryBar value={battery} /> : <span className="text-slate-600 text-xs">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        {gsm != null ? <SignalBars value={gsm} /> : <span className="text-slate-600 text-xs">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-400 font-mono">
                        {device.firmware_version ?? '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        {lat != null && lng != null ? (
                          <a
                            href={`https://www.google.com/maps?q=${lat},${lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-slate-400 hover:text-emerald-400"
                          >
                            <MapPin size={12} />
                            {lat.toFixed(5)}, {lng.toFixed(5)}
                          </a>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-400">
                        {device.last_seen
                          ? formatDistanceToNow(new Date(device.last_seen), { addSuffix: true })
                          : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        {(device.alarm_count ?? 0) > 0 ? (
                          <span className="text-xs font-medium px-2 py-0.5 bg-red-500/15 text-red-400 rounded-full">
                            {device.alarm_count}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-xs">0</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5">
                        <Link
                          to={`/devices/${device.imei}`}
                          className="text-slate-500 hover:text-emerald-400 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <ChevronRight size={16} />
                        </Link>
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
