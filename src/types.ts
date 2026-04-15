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
  '00': 'Yo\'q',
  '01': 'SOS',
  '02': 'Batareya zaryadi past',
  '03': 'Yechildi',
  '04': 'Yechildi',
  '05': 'Buzildi',
  '06': 'Yiqilish',
  '07': 'Yurak urishi noaniq',
  '08': 'Yurak urishi yuqori',
  '09': 'Yurak urishi past',
  '10': 'Sistolik qon bosimi yuqori',
  '14': 'Harakatsizlik',
  '16': 'Yechildi',
  '19': 'O\'chirildi',
  '20': 'Geofens tashqarisida',
  '21': 'Geofensga kirdi',
};

export const HEALTH_TYPES: Record<number, string> = {
  1: 'Qon bosimi',
  2: 'Yurak urishi',
  3: 'Tana harorati',
  4: 'Qon kislorodi',
};
