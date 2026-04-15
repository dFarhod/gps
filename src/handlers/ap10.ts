import { AlarmPacket, WiFiData, ParseResult, ALARM_CODES } from '../types';
import { buildBP10 } from '../responses';
import { getDevicePersonName, insertAlarm, insertLocation, updateDeviceLastSeen } from '../db';
import { serverEvents } from '../events';
import logger from '../logger';

/**
 * AP10 — Alarm packet
 *
 * Format:
 * IWAP10{date}{A/V}{lat}{N/S}{lng}{E/W}{speed}{alarm_time}{direction}{status},
 *        {mcc},{mnc},{lac},{cid},{alarm_code},{language},{response_flag},{wifi}#
 *
 * The first segment structure is same as AP01 location, but uses alarm_time instead of GPS time.
 * alarm_code: 2 digit string
 * language: 0=Chinese, 1=English
 * response_flag: 0=no address needed, 1=device wants address in BP10
 */

const ALARM_REGEX =
  /^(\d{6})([AV])(\d{4}\.\d+)([NS])(\d{5}\.\d+)([EW])(\d{3}\.\d)(\d{6})(\d{3}\.\d{2})(\d{13,14})/;

function nmeaToDegrees(raw: string, hemisphere: string): number {
  const dot = raw.indexOf('.');
  const degLen = dot - 2;
  const degrees = parseFloat(raw.slice(0, degLen));
  const minutes = parseFloat(raw.slice(degLen));
  let decimal = degrees + minutes / 60;
  if (hemisphere === 'S' || hemisphere === 'W') decimal = -decimal;
  return parseFloat(decimal.toFixed(7));
}

function parseWifi(wifiStr: string): WiFiData[] {
  if (!wifiStr || wifiStr.trim() === '' || wifiStr === '0') return [];
  return wifiStr
    .split('&')
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.trim().split('|');
      return {
        ssid: parts[0] || '',
        mac: parts[1] || '',
        signal: parseInt(parts[2] || '0', 10),
      };
    });
}

export function parseAP10(
  raw: string,
  payload: string,
  imei: string
): ParseResult<AlarmPacket> {
  try {
    const segments = payload.split(',');
    if (segments.length < 7) {
      return { success: false, error: `AP10: too few segments (${segments.length})` };
    }

    const firstSeg = segments[0];
    const match = ALARM_REGEX.exec(firstSeg);
    if (!match) {
      return { success: false, error: `AP10: cannot parse fixed block: "${firstSeg}"` };
    }

    const [, date, validChar, latRaw, latHem, lngRaw, lngHem, speedRaw, time, , statusStr] =
      match;

    const gpsValid = validChar === 'A';
    const latitude = nmeaToDegrees(latRaw, latHem);
    const longitude = nmeaToDegrees(lngRaw, lngHem);
    const speed = parseFloat(speedRaw);
    const direction = 0;

    // Status: 13 or 14 decimal chars
    // PT880 sends 13: GSM(2)+SATS(3)+BAT(3)+RES(1)+FORT(2)+MODE/ALARM(2)
    // Standard:  14: GSM(3)+SATS(3)+BAT(3)+RES(1)+FORT(2)+MODE/ALARM(2)
    const offset = statusStr.length === 13 ? 0 : 1;
    const gsmSignal     = parseInt(statusStr.slice(0, 2 + offset), 10);
    const gpsSatellites = parseInt(statusStr.slice(2 + offset, 5 + offset), 10);
    const battery       = parseInt(statusStr.slice(5 + offset, 8 + offset), 10);
    const workMode      = statusStr.slice(statusStr.length - 2);

    const mcc = segments[1] || '';
    const mnc = segments[2] || '';
    const lac = segments[3] || '';
    const cid = segments[4] || '';
    const alarmCode = (segments[5] || '00').trim();
    const language = segments[6] || '1';
    const responseFlag = segments[7] || '0';
    const wifiStr = segments[8] || '';

    const alarmName = ALARM_CODES[alarmCode] || `Noma'lum signal (${alarmCode})`;
    const wifiData = parseWifi(wifiStr);

    const packet: AlarmPacket = {
      raw,
      commandId: 'AP10',
      imei,
      timestamp: new Date(),
      date,
      gpsValid,
      latitude,
      longitude,
      speed,
      locationTime: time,
      direction,
      gsmSignal,
      gpsSatellites,
      battery,
      workMode,
      mcc,
      mnc,
      lac,
      cid,
      wifiData,
      alarmCode,
      alarmName,
      language,
      responseFlag,
    };

    return { success: true, packet };
  } catch (err) {
    return { success: false, error: `AP10 parse error: ${(err as Error).message}` };
  }
}

export async function handleAP10(
  raw: string,
  payload: string,
  imei: string,
  send: (data: string) => void
): Promise<void> {
  const result = parseAP10(raw, payload, imei);
  if (!result.success || !result.packet) {
    logger.warn('AP10 parse failed', { error: result.error, raw });
    send(buildBP10());
    return;
  }

  const packet = result.packet;
  logger.warn('ALARM received', {
    imei,
    alarmCode: packet.alarmCode,
    alarmName: packet.alarmName,
    lat: packet.latitude,
    lng: packet.longitude,
    battery: packet.battery,
  });

  try {
    await insertAlarm(packet);
    await insertLocation(packet);
    await updateDeviceLastSeen(imei);
  } catch (err) {
    logger.error('AP10 db error', { error: (err as Error).message, imei });
  }

  const personName = await getDevicePersonName(imei);

  serverEvents.emit('device:alarm', {
    type: 'device:alarm',
    imei,
    personName,
    alarmCode: packet.alarmCode,
    alarmName: packet.alarmName,
    latitude: packet.latitude,
    longitude: packet.longitude,
    battery: packet.battery,
    timestamp: packet.timestamp.toISOString(),
  });

  // Take-off alarm → also update wearing status
  // PT880 uses: 03=Take off, 04=Take off, 05=Tamper(strap off), 16=Wearing sensor off
  if (['03', '04', '05', '16'].includes(packet.alarmCode)) {
    serverEvents.emit('device:wearing', {
      type: 'device:wearing',
      imei,
      personName,
      status: 0,
      wearTimestamp: packet.locationTime,
      timestamp: packet.timestamp.toISOString(),
    });
  }

  // If device requests address (responseFlag === '1'), send empty address response
  // In production you could reverse-geocode lat/lng here
  const response = buildBP10();
  send(response);
  logger.debug('AP10 response sent', { imei, alarmCode: packet.alarmCode });
}
