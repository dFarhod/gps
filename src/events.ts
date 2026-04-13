import { EventEmitter } from 'events';

export const serverEvents = new EventEmitter();
serverEvents.setMaxListeners(200);

export type DeviceLoginEvent = {
  type: 'device:login';
  imei: string;
  personName?: string | null;
  iccid: string;
  imsi: string;
  timestamp: string;
};

export type DeviceLocationEvent = {
  type: 'device:location';
  imei: string;
  personName?: string | null;
  latitude: number;
  longitude: number;
  speed: number;
  gpsValid: boolean;
  battery: number;
  gsmSignal: number;
  timestamp: string;
};

export type DeviceAlarmEvent = {
  type: 'device:alarm';
  imei: string;
  personName?: string | null;
  alarmCode: string;
  alarmName: string;
  latitude: number;
  longitude: number;
  battery: number;
  timestamp: string;
};

export type DeviceHeartbeatEvent = {
  type: 'device:heartbeat';
  imei: string;
  personName?: string | null;
  battery: number;
  gsmSignal: number;
  gpsSatellites: number;
  pedometer: number;
  timestamp: string;
};

export type DeviceHealthEvent = {
  type: 'device:health';
  imei: string;
  personName?: string | null;
  healthType: number;
  typeName: string;
  value: string;
  timestamp: string;
};

export type DeviceWearingEvent = {
  type: 'device:wearing';
  imei: string;
  personName?: string | null;
  status: number;
  wearTimestamp: string;
  timestamp: string;
};

export type DeviceFallEvent = {
  type: 'device:fall';
  imei: string;
  personName?: string | null;
  fallTimestamp: string;
  timestamp: string;
};

export type DevicePhotoEvent = {
  type: 'device:photo';
  imei: string;
  personName?: string | null;
  filename: string;
  url: string;
  size: number;
  timestamp: string;
};

export type ServerConnectionEvent = {
  type: 'server:connection';
  remote: string;
  activeConnections: number;
  timestamp: string;
};

export type ServerDisconnectEvent = {
  type: 'server:disconnect';
  imei: string | null;
  remote: string;
  activeConnections: number;
  timestamp: string;
};

export type AnyServerEvent =
  | DeviceLoginEvent
  | DeviceLocationEvent
  | DeviceAlarmEvent
  | DeviceHeartbeatEvent
  | DeviceHealthEvent
  | DeviceWearingEvent
  | DeviceFallEvent
  | DevicePhotoEvent
  | ServerConnectionEvent
  | ServerDisconnectEvent;
