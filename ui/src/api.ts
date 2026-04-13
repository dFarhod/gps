import type { Device, Location, Alarm, HealthRecord, Heartbeat, Stats, Photo, WearingEvent, Person } from './types';

const BASE = '/api';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function patch<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const api = {
  stats: ()                                        => get<Stats>('/stats'),
  devices: ()                                      => get<Device[]>('/devices'),
  device: (imei: string)                           => get<Device>(`/devices/${imei}`),
  locations: (imei: string, limit = 100)           => get<Location[]>(`/devices/${imei}/locations?limit=${limit}`),
  deviceAlarms: (imei: string, limit = 50)         => get<Alarm[]>(`/devices/${imei}/alarms?limit=${limit}`),
  deviceHealth: (imei: string, limit = 50)         => get<HealthRecord[]>(`/devices/${imei}/health?limit=${limit}`),
  deviceHeartbeats: (imei: string, limit = 50)     => get<Heartbeat[]>(`/devices/${imei}/heartbeats?limit=${limit}`),
  deviceWearing: (imei: string, limit = 100)        => get<WearingEvent[]>(`/devices/${imei}/wearing?limit=${limit}`),
  wearingEvents: (limit = 200)                      => get<WearingEvent[]>(`/wearing?limit=${limit}`),
  alarms: (limit = 100)                            => get<Alarm[]>(`/alarms?limit=${limit}`),
  health: (limit = 100)                            => get<HealthRecord[]>(`/health?limit=${limit}`),
  connected: ()                                    => get<string[]>('/connected'),
  photos: (imei: string)                           => get<Photo[]>(`/photos/${imei}`),
  allPhotos: ()                                    => get<Photo[]>('/photos'),
  updateDevicePerson: (imei: string, fullName: string) =>
    patch<Device>(`/devices/${imei}/person`, { fullName }),
  assignDeviceToPerson: (imei: string, personId: number | null) =>
    patch<Device>(`/devices/${imei}/assign`, { personId }),
  persons: ()                                       => get<Person[]>('/persons'),
  person: (id: number)                              => get<Person>(`/persons/${id}`),
  createPerson: (fullName: string, phone?: string, notes?: string) =>
    post<Person>('/persons', { fullName, phone, notes }),
  updatePerson: (id: number, fullName: string, phone?: string, notes?: string) =>
    patch<Person>(`/persons/${id}`, { fullName, phone, notes }),
  deletePerson: async (id: number) => {
    const res = await fetch(`/api/persons/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return res.json();
  },
  sendCommand: (imei: string, cmd: string, params?: Record<string, unknown>) =>
    post<{ success: boolean; sent: string }>(`/devices/${imei}/command`, { cmd, params }),
  requestLocationAll: ()                           => post<{ sent: number; total: number }>('/location/request-all'),
};
