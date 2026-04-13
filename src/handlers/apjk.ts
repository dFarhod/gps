import { HealthPacket, ParseResult, HEALTH_TYPES } from '../types';
import { buildBPJK } from '../responses';
import { insertHealthData, updateDeviceLastSeen } from '../db';
import { serverEvents } from '../events';
import logger from '../logger';

/**
 * APJK — Health data packet
 *
 * Format: IWAPJK,{datetime},{type},{value}#
 *
 * datetime: YYYYMMDDHHmmss
 * type:
 *   1 = Blood pressure → value = "diastolic|systolic" (e.g. "80|120")
 *   2 = Heart rate     → value = bpm number
 *   3 = Body temperature → value = degrees (e.g. "36.5")
 *   4 = Blood oxygen   → value = SpO2 percentage
 *
 * Example: IWAPJK,20240406123000,2,72#
 */
export function parseAPJK(
  raw: string,
  payload: string,
  imei: string
): ParseResult<HealthPacket> {
  try {
    const cleaned = payload.startsWith(',') ? payload.slice(1) : payload;
    const parts = cleaned.split(',');

    if (parts.length < 3) {
      return { success: false, error: `APJK: expected 3 parts, got ${parts.length}` };
    }

    const datetime = parts[0].trim();
    const type = parseInt(parts[1].trim(), 10);
    const value = parts[2].trim();

    if (isNaN(type)) {
      return { success: false, error: `APJK: invalid type "${parts[1]}"` };
    }

    const typeName = HEALTH_TYPES[type] || `Unknown type (${type})`;

    const packet: HealthPacket = {
      raw,
      commandId: 'APJK',
      imei,
      timestamp: new Date(),
      datetime,
      type,
      typeName,
      value,
    };

    return { success: true, packet };
  } catch (err) {
    return { success: false, error: `APJK parse error: ${(err as Error).message}` };
  }
}

export async function handleAPJK(
  raw: string,
  payload: string,
  imei: string,
  send: (data: string) => void
): Promise<void> {
  const result = parseAPJK(raw, payload, imei);
  if (!result.success || !result.packet) {
    logger.warn('APJK parse failed', { error: result.error, raw });
    return;
  }

  const packet = result.packet;
  logger.info('Health data received', {
    imei,
    type: packet.typeName,
    value: packet.value,
    datetime: packet.datetime,
  });

  try {
    await insertHealthData(packet);
    await updateDeviceLastSeen(imei);
  } catch (err) {
    logger.error('APJK db error', { error: (err as Error).message, imei });
  }

  serverEvents.emit('device:health', {
    type: 'device:health',
    imei,
    healthType: packet.type,
    typeName: packet.typeName,
    value: packet.value,
    timestamp: packet.timestamp.toISOString(),
  });

  send(buildBPJK(packet.type));
  logger.debug('APJK response sent', { imei, type: packet.type });
}
