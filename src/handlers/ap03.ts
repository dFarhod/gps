import { HeartbeatPacket, ParseResult } from '../types';
import { buildBP03 } from '../responses';
import { insertHeartbeat, updateDeviceLastSeen } from '../db';
import { serverEvents } from '../events';
import logger from '../logger';

/**
 * AP03 — Heartbeat packet
 *
 * Format: IWAP03,{status},{pedometer},{rolls}[,{mode},{interval}]#
 *
 * status field (8 hex chars = 4 bytes):
 *   byte0 = gsm_signal (0-31)
 *   byte1 = gps_satellites
 *   byte2 = battery (0-100)
 *   byte3 = reserved
 *   byte4 = fort_state
 *   byte5 = work_mode
 *   (The spec says the first segment after AP03, is a comma-separated 8-hex-char status)
 *
 * Example: IWAP03,1F0A640001,00012345,0000,01,30#
 */
export function parseAP03(
  raw: string,
  payload: string,
  imei: string
): ParseResult<HeartbeatPacket> {
  try {
    // payload: ",{status},{pedometer},{rolls}[,{mode},{interval}]"
    // strip leading comma if present
    const cleaned = payload.startsWith(',') ? payload.slice(1) : payload;
    const parts = cleaned.split(',');

    if (parts.length < 3) {
      return { success: false, error: `AP03: expected at least 3 parts, got ${parts.length}` };
    }

    // Status field: GSM(3)+GPS_SATS(3)+BATTERY(3)+RESERVED(1)+FORT(2)+MODE(2) — all decimal
    // Example: 06000908000102 → gsm=060, sats=009, bat=080, reserved=0, fort=01, mode=02
    const statusStr = parts[0].padStart(14, '0');
    const gsmSignal     = parseInt(statusStr.slice(0, 3),  10);
    const gpsSatellites = parseInt(statusStr.slice(3, 6),  10);
    const battery       = parseInt(statusStr.slice(6, 9),  10);
    const fortState     = statusStr.slice(10, 12);
    const workModeVal   = statusStr.slice(12, 14);

    const pedometer = parseInt(parts[1] || '0', 10);
    const rollsFrequency = parseInt(parts[2] || '0', 10);

    let workMode: string | undefined;
    let locationInterval: number | undefined;
    if (parts.length >= 5) {
      workMode = parts[3];
      locationInterval = parseInt(parts[4], 10);
    } else {
      workMode = workModeVal;
    }

    const packet: HeartbeatPacket = {
      raw,
      commandId: 'AP03',
      imei,
      timestamp: new Date(),
      gsmSignal,
      gpsSatellites,
      battery,
      fortState,
      pedometer,
      rollsFrequency,
      workMode,
      locationInterval,
    };

    return { success: true, packet };
  } catch (err) {
    return { success: false, error: `AP03 parse error: ${(err as Error).message}` };
  }
}

export async function handleAP03(
  raw: string,
  payload: string,
  imei: string,
  send: (data: string) => void
): Promise<void> {
  const result = parseAP03(raw, payload, imei);
  if (!result.success || !result.packet) {
    logger.warn('AP03 parse failed', { error: result.error, raw });
    send(buildBP03());
    return;
  }

  const packet = result.packet;
  logger.info('Heartbeat received', {
    imei,
    battery: packet.battery,
    gsm: packet.gsmSignal,
    pedometer: packet.pedometer,
  });

  try {
    await insertHeartbeat(packet);
    await updateDeviceLastSeen(imei);
  } catch (err) {
    logger.error('AP03 db error', { error: (err as Error).message, imei });
  }

  serverEvents.emit('device:heartbeat', {
    type: 'device:heartbeat',
    imei,
    battery: packet.battery,
    gsmSignal: packet.gsmSignal,
    gpsSatellites: packet.gpsSatellites,
    pedometer: packet.pedometer,
    timestamp: packet.timestamp.toISOString(),
  });

  send(buildBP03());
  logger.debug('AP03 response sent', { imei });
}
