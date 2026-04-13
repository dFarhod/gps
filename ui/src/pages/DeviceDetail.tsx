import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ArrowLeft, MapPin, Heart, Activity, Bell, Smartphone, Terminal, Camera, Watch, UserCheck, X,
} from 'lucide-react';
import { DeviceCommands } from './DeviceCommands';
import { formatDistanceToNow, format } from 'date-fns';
import { useApi } from '../hooks/useApi';
import { useApp } from '../context/AppContext';
import { api } from '../api';
import { BatteryBar } from '../components/BatteryBar';
import { SignalBars } from '../components/SignalBars';
import { AlarmBadge } from '../components/AlarmBadge';

// Fix leaflet icons
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function AutoCenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  map.setView([lat, lng], map.getZoom());
  return null;
}

type Tab = 'overview' | 'locations' | 'alarms' | 'health' | 'heartbeats' | 'wearing' | 'commands' | 'photos';

export function DeviceDetail() {
  const { imei = '' } = useParams<{ imei: string }>();
  const { state } = useApp();
  const [tab, setTab] = useState<Tab>('overview');
  const [selectedPersonId, setSelectedPersonId] = useState<string>('');
  const [savingPerson, setSavingPerson] = useState(false);
  const [personMessage, setPersonMessage] = useState<string | null>(null);

  const deviceApi = useApi(() => api.device(imei), [imei]);
  const personsApi = useApi(() => api.persons());
  const locApi    = useApi(() => api.locations(imei, 50),        [imei]);
  const alarmApi  = useApi(() => api.deviceAlarms(imei, 50),     [imei]);
  const healthApi = useApi(() => api.deviceHealth(imei, 50),     [imei]);
  const hbApi      = useApi(() => api.deviceHeartbeats(imei, 50),  [imei]);
  const wearApi    = useApi(() => api.deviceWearing(imei, 100),    [imei]);
  const photoApi   = useApi(() => api.photos(imei),                [imei]);

  const livePos = state.positions.get(imei);
  const wearing = state.wearingStatus.get(imei);
  const device = deviceApi.data;
  const lat = livePos?.latitude ?? device?.latitude;
  const lng = livePos?.longitude ?? device?.longitude;
  const battery = livePos?.battery ?? device?.battery;
  const gsm = livePos?.gsmSignal ?? device?.gsm_signal;

  const isOnline = device?.last_seen
    ? Date.now() - new Date(device.last_seen).getTime() < 5 * 60 * 1000
    : false;

  useEffect(() => {
    setSelectedPersonId(device?.person_id != null ? String(device.person_id) : '');
  }, [device?.person_id]);

  const polyline: [number, number][] = (locApi.data ?? [])
    .filter((l) => l.gps_valid && l.latitude && l.longitude)
    .map((l) => [l.latitude, l.longitude]);

  const tabs: { key: Tab; label: string; icon: typeof MapPin }[] = [
    { key: 'overview',   label: 'Umumiy',         icon: Smartphone },
    { key: 'locations',  label: 'Lokatsiyalar',    icon: MapPin    },
    { key: 'alarms',     label: 'Alarmlar',        icon: Bell      },
    { key: 'health',     label: "Sog'liq",         icon: Heart     },
    { key: 'heartbeats', label: 'Heartbeat',       icon: Activity  },
    { key: 'wearing',    label: 'Tasma hodisalari', icon: Watch     },
    { key: 'photos',     label: 'Rasmlar',         icon: Camera    },
    { key: 'commands',   label: 'Komandalar',      icon: Terminal  },
  ];

  return (
    <div className="p-6 space-y-5">
      {/* Back + header */}
      <div>
        <Link to="/devices" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-emerald-400 mb-3">
          <ArrowLeft size={14} /> Qurilmalarga qaytish
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className={`text-xl font-bold text-slate-100 ${device?.full_name ? '' : 'font-mono'}`}>
              {device?.full_name || imei}
            </h1>
            {device?.full_name && (
              <div className="text-xs text-slate-500 font-mono mt-1">{imei}</div>
            )}
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className={`flex items-center gap-1.5 text-xs font-medium ${isOnline ? 'text-emerald-400' : 'text-slate-500'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                {isOnline ? 'Online' : 'Offline'}
              </span>
              {wearing !== undefined && (
                <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                  wearing === 1
                    ? 'bg-blue-500/15 text-blue-400'
                    : 'bg-red-500/15 text-red-400'
                }`}>
                  <Watch size={11} />
                  {wearing === 1 ? 'Tasma kiyilgan' : 'Tasma yechildi'}
                </span>
              )}
              {device?.firmware_version && (
                <span className="text-xs text-slate-500 font-mono">fw: {device.firmware_version}</span>
              )}
              {device?.last_seen && (
                <span className="text-xs text-slate-500">
                  {formatDistanceToNow(new Date(device.last_seen), { addSuffix: true })}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {battery != null && <BatteryBar value={battery} />}
            {gsm != null && <SignalBars value={gsm} />}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-700">
        <div className="flex gap-1">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === key
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Map */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden" style={{ height: 340 }}>
            {lat != null && lng != null ? (
              <MapContainer center={[lat, lng]} zoom={13} className="w-full h-full">
                <TileLayer
                  attribution='&copy; OpenStreetMap'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {polyline.length > 1 && <Polyline positions={polyline} color="#10b981" weight={2} opacity={0.7} />}
                <Marker position={[lat, lng]} />
                {livePos && <AutoCenter lat={lat} lng={lng} />}
              </MapContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">
                <div className="text-center">
                  <MapPin size={32} className="mx-auto mb-2 opacity-30" />
                  <p>Lokatsiya mavjud emas</p>
                </div>
              </div>
            )}
          </div>

          {/* Device info */}
          <div className="space-y-3">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
              <h3 className="font-medium text-slate-200 text-sm">Qurilma ma'lumotlari</h3>
              <div className="space-y-2 text-sm">
                {[
                  { label: 'F.I.Sh', value: device?.full_name },
                  { label: 'IMEI', value: imei },
                  { label: 'ICCID', value: device?.iccid },
                  { label: 'IMSI', value: device?.imsi },
                  { label: 'Firmware', value: device?.firmware_version },
                  { label: "Ro'yxatga olingan", value: device?.created_at ? format(new Date(device.created_at), 'dd.MM.yyyy HH:mm') : undefined },
                ].map(({ label, value }) => value ? (
                  <div key={label} className="flex justify-between items-center py-1 border-b border-slate-700/50">
                    <span className="text-slate-500">{label}</span>
                    <span className="font-mono text-slate-300 text-xs">{value}</span>
                  </div>
                ) : null)}
                {wearing !== undefined && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-700/50">
                    <span className="text-slate-500 flex items-center gap-1"><Watch size={12} /> Tasma holati</span>
                    <span className={`text-xs font-medium ${wearing === 1 ? 'text-blue-400' : 'text-red-400'}`}>
                      {wearing === 1 ? 'Kiyilgan' : 'Yechildi'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <UserCheck size={15} className="text-emerald-400" />
                <h3 className="font-medium text-slate-200 text-sm">Shaxsga biriktirish</h3>
              </div>
              {device?.person_id != null && (
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <UserCheck size={13} className="text-emerald-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-emerald-300 font-medium truncate">{device.person_full_name}</div>
                    {device.person_phone && (
                      <div className="text-xs text-slate-400">{device.person_phone}</div>
                    )}
                  </div>
                </div>
              )}
              <form
                className="space-y-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setSavingPerson(true);
                  setPersonMessage(null);
                  try {
                    const personId = selectedPersonId ? Number(selectedPersonId) : null;
                    await api.assignDeviceToPerson(imei, personId);
                    deviceApi.refetch();
                    setPersonMessage(personId ? 'Biriktirildi' : "Ajratildi");
                  } catch (err) {
                    setPersonMessage((err as Error).message);
                  } finally {
                    setSavingPerson(false);
                  }
                }}
              >
                <div className="flex gap-2">
                  <select
                    value={selectedPersonId}
                    onChange={(e) => setSelectedPersonId(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">— Shaxs tanlanmagan —</option>
                    {(personsApi.data ?? []).map((p) => (
                      <option key={p.id} value={String(p.id)}>{p.full_name}</option>
                    ))}
                  </select>
                  {selectedPersonId && (
                    <button
                      type="button"
                      onClick={() => setSelectedPersonId('')}
                      className="px-2 py-2 bg-slate-700 border border-slate-600 text-slate-400 rounded-lg hover:text-slate-200 transition-colors"
                      title="Tozalash"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={savingPerson}
                    className="px-4 py-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-lg text-sm hover:bg-emerald-500/25 transition-colors disabled:opacity-60"
                  >
                    {savingPerson ? 'Saqlanmoqda...' : 'Saqlash'}
                  </button>
                  {personMessage && (
                    <span className="text-xs text-slate-400">{personMessage}</span>
                  )}
                </div>
              </form>
            </div>

            {lat != null && lng != null && (
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-2">
                <h3 className="font-medium text-slate-200 text-sm">So'nggi pozitsiya</h3>
                <div className="space-y-2 text-sm">
                  {[
                    { label: 'Kenglik', value: lat.toFixed(7) },
                    { label: 'Uzunlik', value: lng.toFixed(7) },
                    { label: 'Tezlik', value: (livePos?.speed ?? device?.speed) != null ? `${livePos?.speed ?? device?.speed} km/h` : undefined },
                    { label: 'GPS holati', value: (livePos?.gpsValid ?? device?.gps_valid) ? 'Valid (A)' : 'Invalid (V)' },
                  ].map(({ label, value }) => value ? (
                    <div key={label} className="flex justify-between items-center py-1 border-b border-slate-700/50">
                      <span className="text-slate-500">{label}</span>
                      <span className="font-mono text-slate-300 text-xs">{value}</span>
                    </div>
                  ) : null)}
                </div>
                <a
                  href={`https://www.google.com/maps?q=${lat},${lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 mt-1"
                >
                  <MapPin size={12} /> Google Maps'da ko'rish
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'locations' && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-700 text-sm text-slate-400">
            {locApi.data?.length ?? 0} ta yozuv (so'nggi 50)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-700 bg-slate-800/80">
                  {['Vaqt', 'GPS', 'Kenglik', 'Uzunlik', 'Tezlik', 'Batareya', 'Signal', 'MCC/MNC'].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {(locApi.data ?? []).map((loc) => (
                  <tr key={loc.id} className="hover:bg-slate-700/20">
                    <td className="px-4 py-2.5 text-slate-400 font-mono">
                      {format(new Date(loc.created_at), 'dd.MM HH:mm:ss')}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`font-medium ${loc.gps_valid ? 'text-emerald-400' : 'text-red-400'}`}>
                        {loc.gps_valid ? 'A' : 'V'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-300">{loc.latitude?.toFixed(6)}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-300">{loc.longitude?.toFixed(6)}</td>
                    <td className="px-4 py-2.5 text-slate-300">{loc.speed} km/h</td>
                    <td className="px-4 py-2.5"><BatteryBar value={loc.battery} showText={false} /></td>
                    <td className="px-4 py-2.5"><SignalBars value={loc.gsm_signal} /></td>
                    <td className="px-4 py-2.5 text-slate-500 font-mono">{loc.mcc}/{loc.mnc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'alarms' && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          {(alarmApi.data?.length ?? 0) === 0 ? (
            <div className="p-12 text-center text-slate-500">Alarmlar yo'q</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-700">
                    {['Vaqt', 'Alarm', 'Koordinat'].map((h) => (
                      <th key={h} className="px-5 py-3 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40">
                  {alarmApi.data?.map((alarm) => (
                    <tr key={alarm.id} className="hover:bg-slate-700/20">
                      <td className="px-5 py-3 text-xs text-slate-400 font-mono">
                        {format(new Date(alarm.created_at), 'dd.MM.yyyy HH:mm:ss')}
                      </td>
                      <td className="px-5 py-3">
                        <AlarmBadge code={alarm.alarm_code} name={alarm.alarm_name} />
                      </td>
                      <td className="px-5 py-3 text-xs font-mono text-slate-400">
                        {alarm.latitude?.toFixed(5)}, {alarm.longitude?.toFixed(5)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'health' && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          {(healthApi.data?.length ?? 0) === 0 ? (
            <div className="p-12 text-center text-slate-500">Sog'liq ma'lumotlari yo'q</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-700">
                    {['Vaqt', 'Tur', 'Qiymat'].map((h) => (
                      <th key={h} className="px-5 py-3 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40">
                  {healthApi.data?.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-700/20">
                      <td className="px-5 py-3 text-xs text-slate-400 font-mono">
                        {format(new Date(h.created_at), 'dd.MM.yyyy HH:mm:ss')}
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs px-2 py-0.5 bg-purple-500/15 text-purple-400 rounded-full">
                          {h.type_name}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-mono text-slate-200 font-medium">{h.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'heartbeats' && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          {(hbApi.data?.length ?? 0) === 0 ? (
            <div className="p-12 text-center text-slate-500">Heartbeat yo'q</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-700">
                    {['Vaqt', 'Batareya', 'Signal', 'Qadam'].map((h) => (
                      <th key={h} className="px-5 py-3 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40">
                  {hbApi.data?.map((hb) => (
                    <tr key={hb.id} className="hover:bg-slate-700/20">
                      <td className="px-5 py-3 text-xs text-slate-400 font-mono">
                        {format(new Date(hb.created_at), 'dd.MM.yyyy HH:mm:ss')}
                      </td>
                      <td className="px-5 py-3"><BatteryBar value={hb.battery} /></td>
                      <td className="px-5 py-3"><SignalBars value={hb.gsm_signal} /></td>
                      <td className="px-5 py-3 text-slate-300 font-mono">{hb.pedometer.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'wearing' && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          {(wearApi.data?.length ?? 0) === 0 ? (
            <div className="p-12 text-center text-slate-500">Tasma hodisalari yo'q</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-700">
                    {['Vaqt', 'Shaxs', 'Holat'].map((h) => (
                      <th key={h} className="px-5 py-3 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40">
                  {wearApi.data?.map((ev) => (
                    <tr key={ev.id} className="hover:bg-slate-700/20">
                      <td className="px-5 py-3 text-xs text-slate-400 font-mono">
                        {format(new Date(ev.created_at), 'dd.MM.yyyy HH:mm:ss')}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-200">
                        {ev.person_name ?? <span className="text-slate-500 italic">Biriktirilmagan</span>}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${
                          ev.status === 1
                            ? 'bg-blue-500/15 text-blue-400'
                            : 'bg-red-500/15 text-red-400'
                        }`}>
                          <Watch size={11} />
                          {ev.status === 1 ? 'Kiydi' : 'Yechdi'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'photos' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-200 flex items-center gap-2">
              <Camera size={16} className="text-amber-400" />
              Rasmlar
            </h3>
            {isOnline && (
              <button
                onClick={async () => {
                  await fetch(`/api/devices/${imei}/command`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cmd: 'photo' }),
                  });
                  setTimeout(() => photoApi.refetch?.(), 5000);
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded-lg text-sm hover:bg-amber-500/25 transition-colors"
              >
                <Camera size={14} /> Rasm ol
              </button>
            )}
          </div>

          {photoApi.loading && (
            <div className="text-slate-500 text-sm">Yuklanmoqda...</div>
          )}

          {!photoApi.loading && (!photoApi.data || photoApi.data.length === 0) && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
              <Camera size={32} className="mx-auto mb-3 text-slate-600" />
              <p className="text-slate-400">Hali rasm yo'q</p>
              <p className="text-slate-600 text-sm mt-1">
                Qurilmadan rasm olish uchun "Rasm ol" tugmasini bosing
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {(photoApi.data ?? []).map((photo) => {
              const ts = photo.timestamp;
              const dateStr = ts.length >= 14
                ? `${ts.slice(0,4)}-${ts.slice(4,6)}-${ts.slice(6,8)} ${ts.slice(8,10)}:${ts.slice(10,12)}:${ts.slice(12,14)}`
                : ts;
              return (
                <a
                  key={photo.filename}
                  href={photo.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group bg-slate-800 border border-slate-700 rounded-xl overflow-hidden hover:border-amber-500/40 transition-colors"
                >
                  <div className="aspect-square bg-slate-900 overflow-hidden">
                    <img
                      src={photo.url}
                      alt={photo.filename}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <div className="p-2">
                    <p className="text-xs text-slate-400 truncate">{dateStr}</p>
                    <p className="text-xs text-slate-600">{(photo.size / 1024).toFixed(1)} KB</p>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'commands' && (
        <DeviceCommands imei={imei} connected={isOnline} />
      )}
    </div>
  );
}
