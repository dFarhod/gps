export interface Person {
  id: number;
  full_name: string;
  phone?: string;
  notes?: string;
  created_at: string;
  device_count?: number;
  devices?: { imei: string; full_name?: string; last_seen?: string }[];
}

export interface Device {
  imei: string;
  full_name?: string;
  display_name?: string;
  person_id?: number | null;
  person_full_name?: string | null;
  person_phone?: string | null;
  iccid?: string;
  imsi?: string;
  firmware_version?: string;
  last_seen?: string;
  created_at?: string;
  // joined from latest location
  latitude?: number;
  longitude?: number;
  battery?: number;
  gsm_signal?: number;
  gps_valid?: boolean;
  speed?: number;
  last_location_at?: string;
  alarm_count?: number;
}

export interface Location {
  id: number;
  imei: string;
  latitude: number;
  longitude: number;
  speed: number;
  gps_valid: boolean;
  gsm_signal: number;
  battery: number;
  work_mode?: string;
  mcc?: string;
  mnc?: string;
  lac?: string;
  cid?: string;
  wifi_data?: WiFiData[];
  hybrid_lat?: number;
  hybrid_lng?: number;
  location_time?: string;
  created_at: string;
}

export interface WiFiData {
  ssid: string;
  mac: string;
  signal: number;
}

export interface Alarm {
  id: number;
  imei: string;
  full_name?: string;
  alarm_code: string;
  alarm_name: string;
  latitude: number;
  longitude: number;
  location_time?: string;
  created_at: string;
}

export interface HealthRecord {
  id: number;
  imei: string;
  type: number;
  type_name: string;
  value: string;
  measured_at?: string;
  created_at: string;
}

export interface Heartbeat {
  id: number;
  imei: string;
  battery: number;
  gsm_signal: number;
  pedometer: number;
  created_at: string;
}

export interface Stats {
  totalDevices: number;
  onlineDevices: number;
  totalLocations: number;
  totalAlarms: number;
  totalHealthRecords: number;
}

export interface WearingEvent {
  id: number;
  imei: string;
  status: number;
  person_name?: string | null;
  wear_timestamp?: string;
  created_at: string;
}

export interface Photo {
  imei?: string;
  filename: string;
  url: string;
  timestamp: string;
  size: number;
}

// WebSocket event types
export type WsEvent =
  | { type: 'device:login';     imei: string; personName?: string | null; iccid: string; imsi: string; timestamp: string }
  | { type: 'device:location';  imei: string; personName?: string | null; latitude: number; longitude: number; speed: number; gpsValid: boolean; battery: number; gsmSignal: number; timestamp: string }
  | { type: 'device:alarm';     imei: string; personName?: string | null; alarmCode: string; alarmName: string; latitude: number; longitude: number; battery: number; timestamp: string }
  | { type: 'device:heartbeat'; imei: string; personName?: string | null; battery: number; gsmSignal: number; gpsSatellites: number; pedometer: number; timestamp: string }
  | { type: 'device:health';    imei: string; personName?: string | null; healthType: number; typeName: string; value: string; timestamp: string }
  | { type: 'device:wearing';   imei: string; personName?: string | null; status: number; wearTimestamp: string; timestamp: string }
  | { type: 'device:fall';      imei: string; personName?: string | null; fallTimestamp: string; timestamp: string }
  | { type: 'device:photo';     imei: string; personName?: string | null; filename: string; url: string; size: number; timestamp: string }
  | { type: 'server:connection'; remote: string; activeConnections: number; timestamp: string }
  | { type: 'server:disconnect'; imei: string | null; remote: string; activeConnections: number; timestamp: string }
  | { type: 'init:stats'; data: Stats };

export interface LiveDevicePosition {
  imei: string;
  latitude: number;
  longitude: number;
  battery: number;
  gsmSignal: number;
  speed: number;
  gpsValid: boolean;
  updatedAt: string;
}

export interface FeedEvent {
  id: string;
  type: WsEvent['type'];
  imei?: string;
  label: string;
  detail: string;
  severity: 'info' | 'warning' | 'danger' | 'success';
  timestamp: string;
}

export const ALARM_COLORS: Record<string, string> = {
  '00': 'text-slate-400',
  '01': 'text-red-400',
  '02': 'text-amber-400',
  '03': 'text-orange-400',
  '05': 'text-orange-500',
  '06': 'text-red-500',
  '07': 'text-purple-400',
  '08': 'text-red-400',
  '09': 'text-blue-400',
  '10': 'text-red-400',
  '14': 'text-yellow-400',
  '19': 'text-slate-400',
  '20': 'text-orange-400',
  '21': 'text-green-400',
};

export const ALARM_BG: Record<string, string> = {
  '01': 'bg-red-500/10 border-red-500/30',
  '02': 'bg-amber-500/10 border-amber-500/30',
  '03': 'bg-orange-500/10 border-orange-500/30',
  '06': 'bg-red-500/10 border-red-500/30',
  '19': 'bg-slate-500/10 border-slate-500/30',
  '20': 'bg-orange-500/10 border-orange-500/30',
};
