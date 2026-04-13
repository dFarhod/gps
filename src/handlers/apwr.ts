import { WearingPacket, ParseResult } from '../types';
import { getDevicePersonName, updateDeviceLastSeen, insertWearingEvent } from '../db';
import { serverEvents } from '../events';
import logger from '../logger';

/**
 * APWR — Wearing status packet
 *
 * Format: IWAPWR,{imei},{status},{timestamp}#
 * status: 1=wearing, 0=removed
 * No response required.
 *
 * Example: IWAPWR,868888031082345,1,1712345678#
 */
export function parseAPWR(
  raw: string,
  payload: string
): ParseResult<WearingPacket> {
  try {
    const cleaned = payload.startsWith(',') ? payload.slice(1) : payload;
    const parts = cleaned.split(',');

    if (parts.length < 3) {
      return { success: false, error: `APWR: expected 3 parts, got ${parts.length}` };
    }

    const imei = parts[0].trim();
    const status = parseInt(parts[1].trim(), 10);
    const wearTimestamp = parts[2].trim();

    if (!imei || imei.length < 10) {
      return { success: false, error: `APWR: invalid IMEI "${imei}"` };
    }

    const packet: WearingPacket = {
      raw,
      commandId: 'APWR',
      imei,
      timestamp: new Date(),
      status,
      wearTimestamp,
    };

    return { success: true, packet };
  } catch (err) {
    return { success: false, error: `APWR parse error: ${(err as Error).message}` };
  }
}

export async function handleAPWR(
  raw: string,
  payload: string
): Promise<void> {
  const result = parseAPWR(raw, payload);
  if (!result.success || !result.packet) {
    logger.warn('APWR parse failed', { error: result.error, raw });
    return;
  }

  const packet = result.packet;
  logger.info('Wearing status received', {
    imei: packet.imei,
    status: packet.status === 1 ? 'wearing' : 'removed',
    timestamp: packet.wearTimestamp,
  });

  try {
    await updateDeviceLastSeen(packet.imei);
  } catch (err) {
    logger.error('APWR db error', { error: (err as Error).message, imei: packet.imei });
  }

  const personName = await getDevicePersonName(packet.imei);

  try {
    await insertWearingEvent(packet.imei, packet.status, personName, packet.wearTimestamp);
  } catch (err) {
    logger.error('APWR wearing_events insert error', { error: (err as Error).message, imei: packet.imei });
  }

  serverEvents.emit('device:wearing', {
    type: 'device:wearing',
    imei: packet.imei,
    personName,
    status: packet.status,
    wearTimestamp: packet.wearTimestamp,
    timestamp: packet.timestamp.toISOString(),
  });
}
