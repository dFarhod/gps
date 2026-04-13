import { FirmwarePacket, ParseResult } from '../types';
import { updateDeviceFirmware } from '../db';
import logger from '../logger';

/**
 * APVR — Firmware version packet
 *
 * Format: IWAPVR,{imei},{version}#
 * No response required.
 *
 * Example: IWAPVR,868888031082345,V3.03.001#
 */
export function parseAPVR(
  raw: string,
  payload: string
): ParseResult<FirmwarePacket> {
  try {
    const cleaned = payload.startsWith(',') ? payload.slice(1) : payload;
    const parts = cleaned.split(',');

    if (parts.length < 2) {
      return { success: false, error: `APVR: expected 2 parts, got ${parts.length}` };
    }

    const imei = parts[0].trim();
    const version = parts[1].trim();

    if (!imei || imei.length < 10) {
      return { success: false, error: `APVR: invalid IMEI "${imei}"` };
    }

    const packet: FirmwarePacket = {
      raw,
      commandId: 'APVR',
      imei,
      timestamp: new Date(),
      version,
    };

    return { success: true, packet };
  } catch (err) {
    return { success: false, error: `APVR parse error: ${(err as Error).message}` };
  }
}

export async function handleAPVR(
  raw: string,
  payload: string
): Promise<void> {
  const result = parseAPVR(raw, payload);
  if (!result.success || !result.packet) {
    logger.warn('APVR parse failed', { error: result.error, raw });
    return;
  }

  const packet = result.packet;
  logger.info('Firmware version received', { imei: packet.imei, version: packet.version });

  try {
    await updateDeviceFirmware(packet);
  } catch (err) {
    logger.error('APVR db error', { error: (err as Error).message, imei: packet.imei });
  }
  // No response for APVR
}
