export interface IWPacket {
  raw: string;
  commandId: string;
  imei: string;
  timestamp: Date;
}

export interface LoginPacket extends IWPacket {
  iccid: string;
  imsi: string;
}

export interface WiFiData {
  ssid: string;
  mac: string;
  signal: number;
}

export interface LocationPacket extends IWPacket {
  date: string;
  gpsValid: boolean;
  latitude: number;
  longitude: number;
  speed: number;
  locationTime: string;
  direction: number;
  gsmSignal: number;
  gpsSatellites: number;
  battery: number;
  workMode: string;
  mcc: string;
  mnc: string;
  lac: string;
  cid: string;
  wifiData: WiFiData[];
  hybridLat?: number;
  hybridLng?: number;
}

export interface HeartbeatPacket extends IWPacket {
  gsmSignal: number;
  gpsSatellites: number;
  battery: number;
  fortState: string;
  pedometer: number;
  rollsFrequency: number;
  workMode?: string;
  locationInterval?: number;
}

export interface AlarmPacket extends LocationPacket {
  alarmCode: string;
  alarmName: string;
  language: string;
  responseFlag: string;
}

export interface HealthPacket extends IWPacket {
  datetime: string;
  type: number;
  typeName: string;
  value: string;
}

export interface BLEDevice {
  mac: string;
  rssi: number;
  name?: string;
}

export interface BLEPacket extends IWPacket {
  bleDevices: BLEDevice[];
  ownMac: string;
  bleTimestamp: string;
}

export interface FirmwarePacket extends IWPacket {
  version: string;
}

export interface WearingPacket extends IWPacket {
  status: number;
  wearTimestamp: string;
}

export interface FallAlarmPacket extends IWPacket {
  fallTimestamp: string;
}

export interface PicturePacket extends IWPacket {
  pictureData: string;
}

export interface ParseResult<T extends IWPacket = IWPacket> {
  success: boolean;
  packet?: T;
  error?: string;
}

export const ALARM_CODES: Record<string, string> = {
  '00': 'None',
  '01': 'SOS',
  '02': 'Low battery',
  '03': 'Take off',
  '04': 'Take off',
  '05': 'Tamper',
  '06': 'Fall',
  '07': 'Heart rate abnormal',
  '08': 'High heart rate',
  '09': 'Low heart rate',
  '10': 'High systolic blood pressure',
  '14': 'Sedentary',
  '16': 'Take off',
  '19': 'Power OFF',
  '20': 'Out of geofence',
  '21': 'Enter geofence',
};

export const HEALTH_TYPES: Record<number, string> = {
  1: 'Blood pressure',
  2: 'Heart rate',
  3: 'Body temperature',
  4: 'Blood oxygen',
};
