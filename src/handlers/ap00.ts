import { LoginPacket, ParseResult } from '../types';
import { buildBP00, buildBP34, buildBP16, bp40 } from '../responses';
import { getDevicePersonName, upsertDevice } from '../db';
import { serverEvents } from '../events';
import logger from '../logger';

/**
 * AP00 — Login packet
 * Format: IWAP00{IMEI},{ICCID},{IMSI}DCX#
 *
 * Example: IWAP00868888031082345,89860617840074615172,460017141050094DCX#
 */
export function parseAP00(raw: string, payload: string): ParseResult<LoginPacket> {
  try {
    // payload is everything after "IWAP00"
    // Strip trailing "DCX" if present
    const cleaned = payload.replace(/DCX$/, '');
    const parts = cleaned.split(',');

    if (parts.length < 3) {
      return { success: false, error: `AP00: expected 3 fields, got ${parts.length}` };
    }

    const [imei, iccid, imsi] = parts;

    if (!imei || imei.length < 10) {
      return { success: false, error: `AP00: invalid IMEI "${imei}"` };
    }

    const packet: LoginPacket = {
      raw,
      commandId: 'AP00',
      imei: imei.trim(),
      iccid: iccid.trim(),
      imsi: imsi.trim(),
      timestamp: new Date(),
    };

    return { success: true, packet };
  } catch (err) {
    return { success: false, error: `AP00 parse error: ${(err as Error).message}` };
  }
}

export async function handleAP00(
  raw: string,
  payload: string,
  send: (data: string) => void
): Promise<string | null> {
  const result = parseAP00(raw, payload);
  if (!result.success || !result.packet) {
    logger.warn('AP00 parse failed', { error: result.error, raw });
    return null;
  }

  const packet = result.packet;
  logger.info('Login packet received', { imei: packet.imei, iccid: packet.iccid });

  try {
    await upsertDevice(packet);
  } catch (err) {
    logger.error('AP00 db error', { error: (err as Error).message, imei: packet.imei });
  }

  const personName = await getDevicePersonName(packet.imei);

  serverEvents.emit('device:login', {
    type: 'device:login',
    imei: packet.imei,
    personName,
    iccid: packet.iccid,
    imsi: packet.imsi,
    timestamp: packet.timestamp.toISOString(),
  });

  const timezone = parseInt(process.env.TIMEZONE || '8', 10);
  const timezoneArea = process.env.TIMEZONE_AREA || 'UTC';
  const networkKey = process.env.NETWORK_TRACKING_KEY || '';

  // 1. BP00 — timezone / session key
  const response = buildBP00(timezone, timezoneArea, networkKey);
  send(response);
  logger.debug('AP00 response sent', { imei: packet.imei, response });

  // 2. BP34 — GPS mode 8 (GPS priority over WiFi), GPS switch ON
  const gpsMode     = parseInt(process.env.GPS_MODE     || '8',  10);
  const gpsInterval = parseInt(process.env.GPS_INTERVAL || '60', 10);
  const bp34 = buildBP34(packet.imei, gpsMode, gpsInterval, 1);
  send(bp34);
  logger.info('GPS activated after login', { imei: packet.imei, mode: gpsMode, interval: gpsInterval });

  // 3. Enable network/hybrid positioning (adds [lat@lng] to AP01 when GPS is unavailable)
  const netLoc = bp40.networkLoc(packet.imei, true);
  send(netLoc);
  logger.debug('Network location enabled', { imei: packet.imei });

  // 4. BP16 — request immediate location right after login
  const bp16 = buildBP16(packet.imei);
  send(bp16);
  logger.debug('Immediate location requested', { imei: packet.imei });

  return packet.imei;
}
