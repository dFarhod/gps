import { BLEPacket, BLEDevice, ParseResult } from '../types';
import { buildBPBL } from '../responses';
import { updateDeviceLastSeen } from '../db';
import logger from '../logger';

/**
 * APBL — BLE (Bluetooth Low Energy) data packet
 *
 * Format: IWAPBL,{imei},{ble_devices},{own_mac},{timestamp}#
 *
 * ble_devices: MAC|RSSI|Name;MAC|RSSI|Name;...  (semicolon-separated)
 * own_mac: device's own BLE MAC address
 * timestamp: Unix timestamp or YYYYMMDDHHmmss
 *
 * Example: IWAPBL,868888031082345,AA:BB:CC:DD:EE:FF|-70|DeviceName,11:22:33:44:55:66,1712345678#
 */
export function parseAPBL(
  raw: string,
  payload: string
): ParseResult<BLEPacket> {
  try {
    const cleaned = payload.startsWith(',') ? payload.slice(1) : payload;
    const parts = cleaned.split(',');

    if (parts.length < 4) {
      return { success: false, error: `APBL: expected 4 parts, got ${parts.length}` };
    }

    const imei = parts[0].trim();
    const bleDevicesRaw = parts[1].trim();
    const ownMac = parts[2].trim();
    const bleTimestamp = parts[3].trim();

    const bleDevices: BLEDevice[] = bleDevicesRaw
      .split(';')
      .filter(Boolean)
      .map((entry) => {
        const fields = entry.split('|');
        return {
          mac: fields[0] || '',
          rssi: parseInt(fields[1] || '0', 10),
          name: fields[2] || undefined,
        };
      });

    const packet: BLEPacket = {
      raw,
      commandId: 'APBL',
      imei,
      timestamp: new Date(),
      bleDevices,
      ownMac,
      bleTimestamp,
    };

    return { success: true, packet };
  } catch (err) {
    return { success: false, error: `APBL parse error: ${(err as Error).message}` };
  }
}

export async function handleAPBL(
  raw: string,
  payload: string,
  send: (data: string) => void
): Promise<void> {
  const result = parseAPBL(raw, payload);
  if (!result.success || !result.packet) {
    logger.warn('APBL parse failed', { error: result.error, raw });
    send(buildBPBL());
    return;
  }

  const packet = result.packet;
  logger.info('BLE data received', {
    imei: packet.imei,
    deviceCount: packet.bleDevices.length,
    ownMac: packet.ownMac,
  });

  try {
    await updateDeviceLastSeen(packet.imei);
  } catch (err) {
    logger.error('APBL db error', { error: (err as Error).message, imei: packet.imei });
  }

  send(buildBPBL());
  logger.debug('APBL response sent', { imei: packet.imei });
}
