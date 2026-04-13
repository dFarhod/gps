import React, {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useCallback,
} from 'react';
import type { WsEvent, LiveDevicePosition, FeedEvent, Stats } from '../types';
import { api } from '../api';

// ── State ─────────────────────────────────────────────────────────────────────

export interface TrailPoint {
  lat: number;
  lng: number;
  ts: string;
  speed: number;
  gpsValid: boolean;
}

const TRAIL_MAX = 30;

export interface Toast {
  id: string;
  imei?: string;
  message: string;
  severity: 'danger' | 'warning' | 'info';
  timestamp: string;
}

export interface ActiveAlert {
  id: string;
  imei: string;
  message: string;
  timestamp: string;
}

interface AppState {
  connected: boolean;
  activeConnections: number;
  stats: Stats;
  positions: Map<string, LiveDevicePosition>;
  trails: Map<string, TrailPoint[]>;
  feed: FeedEvent[];
  toasts: Toast[];
  wearingStatus: Map<string, 0 | 1>;
  activeAlerts: ActiveAlert[];
}

const initialState: AppState = {
  connected: false,
  activeConnections: 0,
  stats: { totalDevices: 0, onlineDevices: 0, totalLocations: 0, totalAlarms: 0, totalHealthRecords: 0 },
  positions: new Map(),
  trails: new Map(),
  feed: [],
  toasts: [],
  wearingStatus: new Map(),
  activeAlerts: [],
};

// ── Reducer ───────────────────────────────────────────────────────────────────

type Action =
  | { type: 'WS_CONNECTED' }
  | { type: 'WS_DISCONNECTED' }
  | { type: 'WS_EVENT'; event: WsEvent }
  | { type: 'DISMISS_TOAST'; id: string }
  | { type: 'DISMISS_ALERT'; id: string };

let feedIdCounter = 0;
function nextId() { return String(++feedIdCounter); }

function getSubject(ev: WsEvent): string {
  if ('personName' in ev && ev.personName && ev.personName.trim()) {
    return ev.personName.trim();
  }
  if ('imei' in ev && typeof ev.imei === 'string' && ev.imei.trim()) {
    return ev.imei;
  }
  return 'Qurilma';
}

function makeFeedEvent(ev: WsEvent): FeedEvent | null {
  const ts = ('timestamp' in ev ? ev.timestamp : new Date().toISOString()) as string;
  const subject = getSubject(ev);
  switch (ev.type) {
    case 'device:login':
      return { id: nextId(), type: ev.type, imei: ev.imei, label: 'Login', detail: `${subject} ulandi`, severity: 'success', timestamp: ts };
    case 'device:location':
      return { id: nextId(), type: ev.type, imei: ev.imei, label: 'Location', detail: `${subject} · ${ev.latitude.toFixed(5)}, ${ev.longitude.toFixed(5)} · ${ev.speed} km/h`, severity: 'info', timestamp: ts };
    case 'device:alarm':
      return { id: nextId(), type: ev.type, imei: ev.imei, label: `Alarm: ${ev.alarmName}`, detail: `${subject} · ${ev.alarmName}`, severity: 'danger', timestamp: ts };
    case 'device:heartbeat':
      return { id: nextId(), type: ev.type, imei: ev.imei, label: 'Heartbeat', detail: `${subject} · bat ${ev.battery}% · GSM ${ev.gsmSignal}`, severity: 'info', timestamp: ts };
    case 'device:health':
      return { id: nextId(), type: ev.type, imei: ev.imei, label: `Health: ${ev.typeName}`, detail: `${subject} · ${ev.typeName}: ${ev.value}`, severity: 'info', timestamp: ts };
    case 'device:fall':
      return { id: nextId(), type: ev.type, imei: ev.imei, label: 'Yiqilish', detail: `${subject} yiqildi`, severity: 'danger', timestamp: ts };
    case 'device:wearing':
      return { id: nextId(), type: ev.type, imei: ev.imei, label: 'Tasma', detail: `${subject} soatni ${ev.status === 1 ? 'taqdi' : 'yechdi'}`, severity: 'info', timestamp: ts };
    case 'server:connection':
      return { id: nextId(), type: ev.type, label: 'TCP Connected', detail: `New connection from ${ev.remote}`, severity: 'success', timestamp: ts };
    case 'server:disconnect':
      return { id: nextId(), type: ev.type, imei: ev.imei ?? undefined, label: 'TCP Disconnected', detail: `${ev.imei ?? ev.remote} disconnected`, severity: 'warning', timestamp: ts };
    default:
      return null;
  }
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'WS_CONNECTED':
      return { ...state, connected: true };
    case 'WS_DISCONNECTED':
      return { ...state, connected: false };
    case 'WS_EVENT': {
      const ev = action.event;
      let next = { ...state };

      if (ev.type === 'init:stats') {
        next.stats = ev.data;
        return next;
      }

      if (ev.type === 'server:connection' || ev.type === 'server:disconnect') {
        next.activeConnections = ev.activeConnections;
      }

      if (ev.type === 'device:location') {
        const positions = new Map(state.positions);
        positions.set(ev.imei, {
          imei: ev.imei,
          latitude: ev.latitude,
          longitude: ev.longitude,
          battery: ev.battery,
          gsmSignal: ev.gsmSignal,
          speed: ev.speed,
          gpsValid: ev.gpsValid,
          updatedAt: ev.timestamp,
        });
        next.positions = positions;

        // Trail (yo'l) yangilash
        const trails = new Map(state.trails);
        const existing = trails.get(ev.imei) ?? [];
        const newPoint: TrailPoint = {
          lat: ev.latitude,
          lng: ev.longitude,
          ts: ev.timestamp,
          speed: ev.speed,
          gpsValid: ev.gpsValid,
        };
        const updated = [...existing, newPoint].slice(-TRAIL_MAX);
        trails.set(ev.imei, updated);
        next.trails = trails;
      }

      // Heartbeat — batareya va signal ko'rsatkichlarini yangilash
      if (ev.type === 'device:heartbeat') {
        const positions = new Map(state.positions);
        const prev = positions.get(ev.imei);
        positions.set(ev.imei, {
          imei: ev.imei,
          latitude: prev?.latitude ?? 0,
          longitude: prev?.longitude ?? 0,
          battery: ev.battery,
          gsmSignal: ev.gsmSignal,
          speed: prev?.speed ?? 0,
          gpsValid: prev?.gpsValid ?? false,
          updatedAt: ev.timestamp,
        });
        next.positions = positions;
      }

      const feedEvent = makeFeedEvent(ev);
      if (feedEvent) {
        next.feed = [feedEvent, ...state.feed].slice(0, 100);
      }

      // Show toast for important events
      let toast: Toast | null = null;
      const ts = ('timestamp' in ev ? ev.timestamp : new Date().toISOString()) as string;
      const subject = getSubject(ev);

      // Track wearing status
      if (ev.type === 'device:wearing') {
        const wearingStatus = new Map(state.wearingStatus);
        wearingStatus.set(ev.imei, ev.status as 0 | 1);
        next.wearingStatus = wearingStatus;
        if (ev.status === 0) {
          next.activeAlerts = [
            ...state.activeAlerts,
            { id: nextId(), imei: ev.imei, message: `${subject} soatni yechdi`, timestamp: ts },
          ];
        }
      }
      const TAKEOFF_CODES = new Set(['03', '04', '05', '16']);

      if (ev.type === 'server:disconnect' && ev.imei) {
        toast = { id: nextId(), imei: ev.imei, message: `Qurilma uzildi: ${ev.imei}`, severity: 'warning', timestamp: ts };
      } else if (ev.type === 'device:wearing' && ev.status === 0) {
        toast = { id: nextId(), imei: ev.imei, message: `${subject} soatni yechdi`, severity: 'warning', timestamp: ts };
      } else if (ev.type === 'device:alarm' && TAKEOFF_CODES.has(ev.alarmCode)) {
        // Tasma yechilish alarmi — ovozli modal
        next.activeAlerts = [
          ...state.activeAlerts,
          { id: nextId(), imei: ev.imei, message: `${subject} soatni yechdi`, timestamp: ts },
        ];
        toast = { id: nextId(), imei: ev.imei, message: `${subject} soatni yechdi`, severity: 'danger', timestamp: ts };
      } else if (ev.type === 'device:alarm') {
        toast = { id: nextId(), imei: ev.imei, message: `${subject}: ${ev.alarmName}`, severity: 'danger', timestamp: ts };
      } else if (ev.type === 'device:fall') {
        toast = { id: nextId(), imei: ev.imei, message: `${subject} yiqildi`, severity: 'danger', timestamp: ts };
      }
      if (toast) {
        next.toasts = [...state.toasts, toast].slice(-10);
      }

      return next;
    }
    case 'DISMISS_TOAST':
      return { ...state, toasts: state.toasts.filter(t => t.id !== action.id) };
    case 'DISMISS_ALERT':
      return { ...state, activeAlerts: state.activeAlerts.filter(a => a.id !== action.id) };
    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

interface AppContextValue {
  state: AppState;
  refreshStats: () => Promise<void>;
  requestLocation: (imei: string) => void;
  requestAllLocations: () => void;
  dismissToast: (id: string) => void;
  dismissAlert: (id: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);

  const refreshStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        dispatch({ type: 'WS_EVENT', event: { type: 'init:stats', data } });
      }
    } catch { /* ignore */ }
  }, []);

  const requestLocation = useCallback((imei: string) => {
    api.sendCommand(imei, 'location').catch(() => {});
  }, []);

  const requestAllLocations = useCallback(() => {
    api.requestLocationAll().catch(() => {});
  }, []);

  const dismissToast = useCallback((id: string) => {
    dispatch({ type: 'DISMISS_TOAST', id });
  }, []);

  const dismissAlert = useCallback((id: string) => {
    dispatch({ type: 'DISMISS_ALERT', id });
  }, []);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.host;
    const ws = new WebSocket(`${protocol}://${host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      dispatch({ type: 'WS_CONNECTED' });
      attemptRef.current = 0;
      refreshStats();
    };

    ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data as string) as WsEvent;
        dispatch({ type: 'WS_EVENT', event });
      } catch { /* ignore */ }
    };

    ws.onclose = () => {
      dispatch({ type: 'WS_DISCONNECTED' });
      wsRef.current = null;
      // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
      const delay = Math.min(1000 * Math.pow(2, attemptRef.current), 30000);
      attemptRef.current++;
      reconnectTimer.current = setTimeout(connect, delay);
    };

    ws.onerror = () => ws.close();
  }, [refreshStats]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return (
    <AppContext.Provider value={{ state, refreshStats, requestLocation, requestAllLocations, dismissToast, dismissAlert }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
