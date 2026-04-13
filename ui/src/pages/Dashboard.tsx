import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Smartphone, MapPin, Bell, Activity, AlertTriangle, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useApp } from '../context/AppContext';
import { useApi } from '../hooks/useApi';
import { api } from '../api';
import { StatCard } from '../components/StatCard';
import { EventFeed } from '../components/EventFeed';
import { AlarmBadge } from '../components/AlarmBadge';
import { BatteryBar } from '../components/BatteryBar';

export function Dashboard() {
  const { state, refreshStats } = useApp();
  const alarmsApi = useApi(() => api.alarms(10));
  const devicesApi = useApi(() => api.devices());

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  const { stats } = state;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">GPS Tracker monitoring tizimi</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Jami qurilmalar"
          value={stats.totalDevices}
          icon={Smartphone}
          color="text-blue-400"
        />
        <StatCard
          label="Online (5 daqiqa)"
          value={stats.onlineDevices}
          icon={Activity}
          color="text-emerald-400"
        />
        <StatCard
          label="Jami alarmlar"
          value={stats.totalAlarms}
          icon={Bell}
          color="text-red-400"
        />
        <StatCard
          label="Jami lokatsiyalar"
          value={stats.totalLocations.toLocaleString()}
          icon={MapPin}
          color="text-purple-400"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Live event feed */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
            <h2 className="font-semibold text-slate-100">Jonli voqealar</h2>
            <span className={`flex items-center gap-1.5 text-xs font-medium ${state.connected ? 'text-emerald-400' : 'text-red-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${state.connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
              {state.connected ? 'Ulangan' : 'Uzilgan'}
            </span>
          </div>
          <EventFeed events={state.feed} maxHeight="max-h-80" />
        </div>

        {/* Recent alarms */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
            <h2 className="font-semibold text-slate-100 flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-400" />
              So'nggi alarmlar
            </h2>
            <Link to="/alarms" className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
              Barchasi <ExternalLink size={11} />
            </Link>
          </div>
          {alarmsApi.loading ? (
            <div className="p-8 text-center text-slate-500 text-sm">Yuklanmoqda...</div>
          ) : alarmsApi.error ? (
            <div className="p-8 text-center text-red-400 text-sm">DB ulanmagan</div>
          ) : alarmsApi.data?.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">Alarmlar yo'q</div>
          ) : (
            <div className="overflow-y-auto max-h-80">
              {alarmsApi.data?.map((alarm) => (
                <div key={alarm.id} className="flex items-center gap-3 px-5 py-3 border-b border-slate-700/60 hover:bg-slate-700/30">
                  <AlarmBadge code={alarm.alarm_code} name={alarm.alarm_name} />
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/devices/${alarm.imei}`}
                      className="text-xs font-mono text-slate-400 hover:text-emerald-400 truncate block"
                    >
                      {alarm.imei}
                    </Link>
                  </div>
                  <span className="text-xs text-slate-500 flex-shrink-0">
                    {formatDistanceToNow(new Date(alarm.created_at), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick device overview */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
          <h2 className="font-semibold text-slate-100">Qurilmalar holati</h2>
          <Link to="/devices" className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
            Barchasi <ExternalLink size={11} />
          </Link>
        </div>
        {devicesApi.loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Yuklanmoqda...</div>
        ) : devicesApi.error ? (
          <div className="p-8 text-center text-red-400 text-sm">DB ulanmagan</div>
        ) : devicesApi.data?.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">Qurilmalar yo'q</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-700">
                  <th className="px-5 py-3 font-medium">IMEI</th>
                  <th className="px-5 py-3 font-medium">Holat</th>
                  <th className="px-5 py-3 font-medium">Batareya</th>
                  <th className="px-5 py-3 font-medium">So'nggi ko'ringan</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {devicesApi.data?.slice(0, 8).map((device) => {
                  const isOnline = device.last_seen
                    ? Date.now() - new Date(device.last_seen).getTime() < 5 * 60 * 1000
                    : false;
                  return (
                    <tr key={device.imei} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="px-5 py-3 font-mono text-slate-300">{device.imei}</td>
                      <td className="px-5 py-3">
                        <span className={`flex items-center gap-1.5 text-xs font-medium ${isOnline ? 'text-emerald-400' : 'text-slate-500'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                          {isOnline ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {device.battery != null ? <BatteryBar value={device.battery} /> : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-5 py-3 text-slate-400 text-xs">
                        {device.last_seen
                          ? formatDistanceToNow(new Date(device.last_seen), { addSuffix: true })
                          : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <Link to={`/devices/${device.imei}`} className="text-emerald-400 hover:text-emerald-300">
                          <ExternalLink size={14} />
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
