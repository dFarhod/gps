import { LocationPacket, WiFiData, ParseResult } from '../types';
import { buildBP01 } from '../responses';
import { insertLocation, updateDeviceLastSeen } from '../db';
import { serverEvents } from '../events';
import logger from '../logger';

/**
 * AP01 — Location packet
 *
 * Format:
 * IWAP01{date}{A/V}{lat}{N/S}{lng}{E/W}{speed}{time}{direction}{status},
 *        {mcc},{mnc},{lac},{cid},{wifi},[hybrid]#
 *
 * The first segment (before first comma) is a fixed-width block:
 *   date      = 6 chars DDMMYY
 *   valid     = 1 char A|V
 *   lat       = 9 chars DDMM.MMMM (no leading zeros guaranteed — parse until N/S)
 *   N/S       = 1 char
 *   lng       = 10 chars DDDMM.MMMM
 *   E/W       = 1 char
 *   speed     = variable, ends before next fixed block
 *   time      = 6 chars HHmmss
 *   direction = 3 chars DDD  (0-359)
 *   status    = 8 chars hex
 *
 * Because some fields are variable-width we use a regex to parse the first segment.
 *
 * Example first segment:
 *   0604242232.9806N11408.0412E000.01200545122001F000
 *   date=060424, valid=A, lat=2232.9806, N, lng=11408.0412, E, speed=000.0, time=120054, dir=122, status=001F0000
 */

// Fixed-width block format (all segments concatenated without separators):
//   date      = 6 digits  YYMMDD
//   valid     = 1 char    A|V
//   lat       = DDMM.MMMM (e.g. 4117.9700 or 0000.0000)
//   N/S       = 1 char
//   lng       = DDDMM.MMMM (e.g. 06914.4060 or 00000.0000)
//   E/W       = 1 char
//   speed     = DDD.D (exactly 5 chars: 3 int + dot + 1 decimal)
//   time      = 6 digits  HHmmss
//   direction = DDD.DD (exactly 6 chars: 3 int + dot + 2 decimal)
//   status    = 14 decimal digits (GSM×3 + sats×3 + bat×3 + reserved×1 + fort×2 + mode×2)
const LOCATION_REGEX =
  /^(\d{6})([AV])(\d{4}\.\d+)([NS])(\d{5}\.\d+)([EW])(\d{3}\.\d)(\d{6})(\d{3}\.\d{2})(\d{14})/;

function nmeaToDegrees(raw: string, hemisphere: string): number {
  const dot = raw.indexOf('.');
  // Degrees are all digits before the last 2 digits before the decimal
  const degLen = dot - 2;
  const degrees = parseFloat(raw.slice(0, degLen));
  const minutes = parseFloat(raw.slice(degLen));
  let decimal = degrees + minutes / 60;
  if (hemisphere === 'S' || hemisphere === 'W') {
    decimal = -decimal;
  }
  return parseFloat(decimal.toFixed(7));
}

function parseWifi(wifiStr: string): WiFiData[] {
  if (!wifiStr || wifiStr.trim() === '' || wifiStr === '0') return [];
  // Format: SSID|MAC|signal&SSID|MAC|signal  (separator is "&")
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

export function parseAP01(
  raw: string,
  payload: string,
  imei: string
): ParseResult<LocationPacket> {
  try {
    const segments = payload.split(',');
    if (segments.length < 5) {
      return { success: false, error: `AP01: too few segments (${segments.length})` };
    }

    const firstSeg = segments[0];
    const match = LOCATION_REGEX.exec(firstSeg);
    if (!match) {
      return { success: false, error: `AP01: cannot parse fixed block: "${firstSeg}"` };
    }

    const [, date, validChar, latRaw, latHem, lngRaw, lngHem, speedRaw, time, , statusStr] =
      match;

    const gpsValid = validChar === 'A';
    const latitude = nmeaToDegrees(latRaw, latHem);
    const longitude = nmeaToDegrees(lngRaw, lngHem);
    const speed = parseFloat(speedRaw);

    // Status: 14 decimal chars — GSM(3) + SATS(3) + BATTERY(3) + RESERVED(1) + FORT(2) + MODE(2)
    const gsmSignal     = parseInt(statusStr.slice(0, 3),  10);
    const gpsSatellites = parseInt(statusStr.slice(3, 6),  10);
    const battery       = parseInt(statusStr.slice(6, 9),  10);
    const workMode      = statusStr.slice(12, 14);

    const mcc = segments[1] || '';
    const mnc = segments[2] || '';
    const lac = segments[3] || '';
    const cid = segments[4] || '';
    const wifiStr = segments[5] || '';
    const hybridStr = segments[6] || '';

    const wifiData = parseWifi(wifiStr);

    let hybridLat: number | undefined;
    let hybridLng: number | undefined;
    if (hybridStr) {
      // Format: [lat@lng]  e.g. [40.13305@100.927618]
      const cleaned = hybridStr.replace(/[\[\]]/g, '');
      const hParts = cleaned.split('@');
      if (hParts.length >= 2) {
        hybridLat = parseFloat(hParts[0]) || undefined;
        hybridLng = parseFloat(hParts[1]) || undefined;
      }
    }

    const packet: LocationPacket = {
      raw,
      commandId: 'AP01',
      imei,
      timestamp: new Date(),
      date,
      gpsValid,
      latitude,
      longitude,
      speed,
      locationTime: time,
      direction: 0,
      gsmSignal,
      gpsSatellites,
      battery,
      workMode,
      mcc,
      mnc,
      lac,
      cid,
      wifiData,
      hybridLat,
      hybridLng,
    };

    return { success: true, packet };
  } catch (err) {
    return { success: false, error: `AP01 parse error: ${(err as Error).message}` };
  }
}

export async function handleAP01(
  raw: string,
  payload: string,
  imei: string,
  send: (data: string) => void
): Promise<void> {
  const result = parseAP01(raw, payload, imei);
  if (!result.success || !result.packet) {
    logger.warn('AP01 parse failed', { error: result.error, raw });
    send(buildBP01());
    return;
  }

  const packet = result.packet;

  // Prefer hybrid when GPS invalid and raw lat/lng = 0
  const useLat = (!packet.gpsValid && packet.latitude === 0 && packet.hybridLat != null)
    ? packet.hybridLat : packet.latitude;
  const useLng = (!packet.gpsValid && packet.longitude === 0 && packet.hybridLng != null)
    ? packet.hybridLng : packet.longitude;

  const hasPosition = useLat !== 0 || useLng !== 0;

  logger.info('Location received', {
    imei,
    lat: useLat,
    lng: useLng,
    valid: packet.gpsValid,
    hasPosition,
    speed: packet.speed,
    battery: packet.battery,
  });

  try {
    // Only save to DB when we have meaningful coordinates
    if (hasPosition) {
      await insertLocation({ ...packet, latitude: useLat, longitude: useLng });
    }
    await updateDeviceLastSeen(imei);
  } catch (err) {
    logger.error('AP01 db error', { error: (err as Error).message, imei });
  }

  // Only emit WebSocket event when we have a real position
  if (!hasPosition) {
    send(buildBP01());
    return;
  }

  serverEvents.emit('device:location', {
    type: 'device:location',
    imei,
    latitude: useLat,
    longitude: useLng,
    speed: packet.speed,
    gpsValid: packet.gpsValid,
    battery: packet.battery,
    gsmSignal: packet.gsmSignal,
    timestamp: packet.timestamp.toISOString(),
  });

  send(buildBP01());
  logger.debug('AP01 response sent', { imei });
}
