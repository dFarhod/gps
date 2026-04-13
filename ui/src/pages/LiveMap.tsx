import { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatDistanceToNow } from 'date-fns';
import { useApp } from '../context/AppContext';
import { useApi } from '../hooks/useApi';
import { api } from '../api';
import { BatteryBar } from '../components/BatteryBar';
import { SignalBars } from '../components/SignalBars';
import type { Device } from '../types';

// Fix leaflet default marker icons
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function makeIcon(online: boolean, selected: boolean) {
  const color = online ? (selected ? '#f59e0b' : '#10b981') : '#64748b';
  const size = selected ? 34 : 28;
  const circle = selected ? 8 : 6;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${Math.round(size * 1.29)}" viewBox="0 0 ${size} ${Math.round(size * 1.29)}">
      <path d="M${size / 2} 0C${size * 0.224} 0 0 ${size * 0.224} 0 ${size / 2}c0 ${size * 0.348} ${size / 2} ${size * 0.786} ${size / 2} ${size * 0.786}S${size} ${size * 0.848} ${size} ${size / 2}C${size} ${size * 0.224} ${size * 0.776} 0 ${size / 2} 0z"
            fill="${color}" stroke="white" stroke-width="2"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${circle}" fill="white" fill-opacity="0.9"/>
      ${selected ? `<circle cx="${size / 2}" cy="${size / 2}" r="3" fill="${color}"/>` : ''}
    </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [size, Math.round(size * 1.29)],
    iconAnchor: [size / 2, Math.round(size * 1.29)],
    popupAnchor: [0, -Math.round(size * 1.29)],
  });
}

// Fit map to all markers only on first load
function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (!fitted.current && positions.length > 0) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      fitted.current = true;
    }
  }, [map, positions]);
  return null;
}

// Pan to a specific position when selected
function PanTo({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.panTo(position, { animate: true, duration: 0.5 });
    }
  }, [map, position]);
  return null;
}

const TRAIL_COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
];

export function LiveMap() {
  const { state, requestLocation, requestAllLocations } = useApp();
  const devicesApi = useApi(() => api.devices());
  const [selectedImei, setSelectedImei] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [requesting, setRequesting] = useState<Record<string, boolean>>({});
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  interface MergedDevice {
    imei: string;
    latitude?: number;
    longitude?: number;
    battery?: number;
    gsmSignal?: number;
    speed?: number;
    gpsValid?: boolean;
    updatedAt?: string;
    last_seen?: string;
    iccid?: string;
    firmware_version?: string;
    isConnected: boolean;
  }

  const devices: Device[] = devicesApi.data ?? [];

  const mergedPositions: MergedDevice[] = devices
    .map((d) => {
      const live = state.positions.get(d.imei);
      return {
        imei: d.imei,
        latitude: live?.latitude ?? d.latitude,
        longitude: live?.longitude ?? d.longitude,
        battery: live?.battery ?? d.battery,
        gsmSignal: live?.gsmSignal ?? d.gsm_signal,
        speed: live?.speed ?? d.speed,
        gpsValid: live?.gpsValid ?? d.gps_valid,
        updatedAt: live?.updatedAt ?? d.last_location_at,
        last_seen: d.last_seen,
        iccid: d.iccid,
        firmware_version: d.firmware_version,
        isConnected: false,
      } as MergedDevice;
    })
    .filter((d) => d.latitude != null && d.longitude != null);

  state.positions.forEach((pos, imei) => {
    if (!mergedPositions.find((d) => d.imei === imei)) {
      mergedPositions.push({
        imei,
        latitude: pos.latitude,
        longitude: pos.longitude,
        battery: pos.battery,
        gsmSignal: pos.gsmSignal,
        speed: pos.speed,
        gpsValid: pos.gpsValid,
        updatedAt: pos.updatedAt,
        isConnected: true,
      });
    }
  });

  const isOnline = (d: { updatedAt?: string; last_seen?: string }) => {
    const t = d.updatedAt ?? d.last_seen;
    return t ? Date.now() - new Date(t).getTime() < 5 * 60 * 1000 : false;
  };

  const allPositions: [number, number][] = mergedPositions.map((d) => [d.latitude!, d.longitude!]);

  const selectedPos = selectedImei
    ? mergedPositions.find((d) => d.imei === selectedImei)
    : null;
  const panTarget: [number, number] | null =
    selectedPos?.latitude != null && selectedPos?.longitude != null
      ? [selectedPos.latitude!, selectedPos.longitude!]
      : null;

  const handleRequestLocation = useCallback(
    (imei: string) => {
      setRequesting((prev) => ({ ...prev, [imei]: true }));
      requestLocation(imei);
      setTimeout(() => setRequesting((prev) => ({ ...prev, [imei]: false })), 3000);
    },
    [requestLocation],
  );

  const handleRequestAll = useCallback(() => {
    requestAllLocations();
    setLastRefresh(new Date());
  }, [requestAllLocations]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (autoRefresh) {
      handleRequestAll();
      autoRefreshRef.current = setInterval(() => {
        handleRequestAll();
      }, 30000);
    } else {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
    }
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, [autoRefresh, handleRequestAll]);

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-72 bg-slate-800 border-r border-slate-700 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-100 text-sm">Jonli Lokatsiya</h2>
              <p className="text-xs text-slate-500 mt-0.5">{mergedPositions.length} ta qurilma</p>
            </div>
            <span className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border ${
              state.connected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${state.connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
              {state.connected ? 'Jonli' : 'Uzilgan'}
            </span>
          </div>

          {/* Controls */}
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleRequestAll}
              className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1.5 rounded-md transition-colors font-medium"
            >
              Barchasidan so'ra
            </button>
            <button
              onClick={() => setAutoRefresh((v) => !v)}
              className={`text-xs px-2 py-1.5 rounded-md transition-colors font-medium border ${
                autoRefresh
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                  : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {autoRefresh ? '⏸ 30s' : '▶ Auto'}
            </button>
          </div>

          {lastRefresh && (
            <p className="text-xs text-slate-500 mt-2">
              So'nggi: {formatDistanceToNow(lastRefresh, { addSuffix: true })}
            </p>
          )}
        </div>

        {/* Device list */}
        <div className="overflow-y-auto flex-1">
          {mergedPositions.length === 0 ? (
            <div className="p-4 text-slate-500 text-xs text-center">Lokatsiya yo'q</div>
          ) : (
            mergedPositions.map((d, i) => {
              const online = isOnline(d);
              const selected = selectedImei === d.imei;
              const trail = state.trails.get(d.imei) ?? [];
              const trailColor = TRAIL_COLORS[i % TRAIL_COLORS.length];

              return (
                <div
                  key={d.imei}
                  className={`border-b border-slate-700/50 ${selected ? 'bg-amber-500/10' : ''}`}
                >
                  <button
                    onClick={() => setSelectedImei(selected ? null : d.imei)}
                    className={`w-full text-left px-4 py-3 hover:bg-slate-700/40 transition-colors ${
                      selected ? 'border-l-2 border-l-amber-500' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: online ? trailColor : '#475569' }}
                      />
                      <span className="font-mono text-xs text-slate-200 truncate flex-1">{d.imei}</span>
                      {trail.length > 1 && (
                        <span className="text-xs text-slate-500">{trail.length} nuqta</span>
                      )}
                    </div>

                    <div className="mt-1.5 flex items-center gap-3">
                      {d.battery != null && <BatteryBar value={d.battery} />}
                      {d.gsmSignal != null && <SignalBars value={d.gsmSignal} />}
                      {d.speed != null && d.speed > 0 && (
                        <span className="text-xs text-blue-400 font-medium">{d.speed} km/h</span>
                      )}
                    </div>

                    <div className="mt-1 text-xs text-slate-500">
                      {d.latitude?.toFixed(5)}, {d.longitude?.toFixed(5)}
                    </div>

                    {d.updatedAt && (
                      <div className="mt-0.5 text-xs text-slate-600">
                        {formatDistanceToNow(new Date(d.updatedAt), { addSuffix: true })}
                      </div>
                    )}
                  </button>

                  {/* Per-device request button */}
                  {online && (
                    <div className="px-4 pb-2">
                      <button
                        onClick={() => handleRequestLocation(d.imei)}
                        disabled={requesting[d.imei]}
                        className="w-full text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 px-2 py-1 rounded transition-colors"
                      >
                        {requesting[d.imei] ? '⏳ Soralmoqda...' : '📍 Lokatsiya sora'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Legend */}
        <div className="px-4 py-3 border-t border-slate-700 space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-3 h-1 bg-emerald-500 rounded" /> Trek (so'nggi 30 nuqta)
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Tanlangan
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {devicesApi.loading && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-400">
            Yuklanmoqda...
          </div>
        )}

        <MapContainer
          center={[41.2995, 69.2401]}
          zoom={6}
          className="w-full h-full"
          style={{ background: '#1e293b' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {allPositions.length > 0 && <FitBounds positions={allPositions} />}
          {panTarget && <PanTo position={panTarget} />}

          {/* Trail polylines */}
          {mergedPositions.map((d, i) => {
            const trail = state.trails.get(d.imei) ?? [];
            if (trail.length < 2) return null;
            const trailColor = TRAIL_COLORS[i % TRAIL_COLORS.length];
            const positions: [number, number][] = trail.map((p) => [p.lat, p.lng]);
            return (
              <Polyline
                key={`trail-${d.imei}`}
                positions={positions}
                pathOptions={{
                  color: trailColor,
                  weight: selectedImei === d.imei ? 3 : 2,
                  opacity: selectedImei === d.imei ? 0.9 : 0.5,
                  dashArray: undefined,
                }}
              />
            );
          })}

          {/* Device markers */}
          {mergedPositions.map((d) => {
            const online = isOnline(d);
            const selected = selectedImei === d.imei;
            const ts = d.updatedAt ?? d.last_seen;
            const trail = state.trails.get(d.imei) ?? [];

            return (
              <Marker
                key={d.imei}
                position={[d.latitude!, d.longitude!]}
                icon={makeIcon(online, selected)}
                eventHandlers={{ click: () => setSelectedImei(selected ? null : d.imei) }}
                zIndexOffset={selected ? 1000 : 0}
              >
                <Popup minWidth={200}>
                  <div className="space-y-2 p-1">
                    <p className="font-mono font-bold text-sm">{d.imei}</p>

                    <div className="space-y-1 text-xs text-slate-600">
                      <div className="flex justify-between gap-4">
                        <span>Holat</span>
                        <span className={online ? 'text-emerald-600 font-semibold' : 'text-slate-400'}>
                          {online ? '● Online' : '○ Offline'}
                        </span>
                      </div>

                      {d.battery != null && (
                        <div className="flex justify-between gap-4">
                          <span>Batareya</span>
                          <span className={d.battery < 20 ? 'text-red-500 font-medium' : ''}>{d.battery}%</span>
                        </div>
                      )}

                      {d.speed != null && (
                        <div className="flex justify-between gap-4">
                          <span>Tezlik</span>
                          <span>{d.speed} km/h</span>
                        </div>
                      )}

                      <div className="flex justify-between gap-4">
                        <span>GPS</span>
                        <span className={d.gpsValid ? 'text-emerald-600' : 'text-amber-500'}>
                          {d.gpsValid ? 'Aniq' : 'Taxminiy'}
                        </span>
                      </div>

                      <div className="flex justify-between gap-4">
                        <span>Koordinat</span>
                        <span className="font-mono">{d.latitude?.toFixed(5)}, {d.longitude?.toFixed(5)}</span>
                      </div>

                      {trail.length > 0 && (
                        <div className="flex justify-between gap-4">
                          <span>Trek</span>
                          <span>{trail.length} ta nuqta</span>
                        </div>
                      )}

                      {ts && (
                        <div className="flex justify-between gap-4">
                          <span>Yangilangan</span>
                          <span>{formatDistanceToNow(new Date(ts), { addSuffix: true })}</span>
                        </div>
                      )}
                    </div>

                    {online && (
                      <button
                        onClick={() => handleRequestLocation(d.imei)}
                        className="w-full mt-2 text-xs bg-emerald-600 hover:bg-emerald-500 text-white py-1 px-2 rounded transition-colors"
                      >
                        📍 Lokatsiya so'ra
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
