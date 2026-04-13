import { FallAlarmPacket, ParseResult } from '../types';
import { buildBPFD } from '../responses';
import { getDevicePersonName, updateDeviceLastSeen } from '../db';
import { serverEvents } from '../events';
import logger from '../logger';

/**
 * APFD — Fall alarm packet
 *
 * Format: IWAPFD,{imei},{timestamp}#
 * Response: IWBPFD#
 *
 * Example: IWAPFD,868888031082345,1712345678#
 */
export function parseAPFD(
  raw: string,
  payload: string
): ParseResult<FallAlarmPacket> {
  try {
    const cleaned = payload.startsWith(',') ? payload.slice(1) : payload;
    const parts = cleaned.split(',');

    if (parts.length < 2) {
      return { success: false, error: `APFD: expected 2 parts, got ${parts.length}` };
    }

    const imei = parts[0].trim();
    const fallTimestamp = parts[1].trim();

    if (!imei || imei.length < 10) {
      return { success: false, error: `APFD: invalid IMEI "${imei}"` };
    }

    const packet: FallAlarmPacket = {
      raw,
      commandId: 'APFD',
      imei,
      timestamp: new Date(),
      fallTimestamp,
    };

    return { success: true, packet };
  } catch (err) {
    return { success: false, error: `APFD parse error: ${(err as Error).message}` };
  }
}

export async function handleAPFD(
  raw: string,
  payload: string,
  send: (data: string) => void
): Promise<void> {
  const result = parseAPFD(raw, payload);
  if (!result.success || !result.packet) {
    logger.warn('APFD parse failed', { error: result.error, raw });
    send(buildBPFD());
    return;
  }

  const packet = result.packet;
  logger.warn('FALL ALARM received', {
    imei: packet.imei,
    fallTimestamp: packet.fallTimestamp,
  });

  try {
    await updateDeviceLastSeen(packet.imei);
  } catch (err) {
    logger.error('APFD db error', { error: (err as Error).message, imei: packet.imei });
  }

  const personName = await getDevicePersonName(packet.imei);

  serverEvents.emit('device:fall', {
    type: 'device:fall',
    imei: packet.imei,
    personName,
    fallTimestamp: packet.fallTimestamp,
    timestamp: packet.timestamp.toISOString(),
  });

  send(buildBPFD());
  logger.debug('APFD response sent', { imei: packet.imei });
}
