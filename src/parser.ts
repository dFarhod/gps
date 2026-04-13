import { handleAP00 } from './handlers/ap00';
import { handleAP01 } from './handlers/ap01';
import { handleAP03 } from './handlers/ap03';
import { handleAP10 } from './handlers/ap10';
import { handleAP42 } from './handlers/ap42';
import { handleAPBL } from './handlers/apbl';
import { handleAPJK } from './handlers/apjk';
import { handleAPVR } from './handlers/apvr';
import { handleAPWR } from './handlers/apwr';
import { handleAPFD } from './handlers/apfd';
import { registerConnection } from './connections';
import logger from './logger';

export interface ConnectionState {
  imei: string | null;
  buffer: string;
}

/**
 * Parse lat/lng from NMEA DDMM.MMMM format to decimal degrees.
 * Exported for testing.
 */
export function nmeaToDecimal(raw: string, hemisphere: string): number {
  const dot = raw.indexOf('.');
  if (dot < 2) throw new Error(`Invalid NMEA coordinate: ${raw}`);
  const degLen = dot - 2;
  const degrees = parseFloat(raw.slice(0, degLen));
  const minutes = parseFloat(raw.slice(degLen));
  let decimal = degrees + minutes / 60;
  if (hemisphere === 'S' || hemisphere === 'W') decimal = -decimal;
  return parseFloat(decimal.toFixed(7));
}

/**
 * Extract all complete packets from the buffer.
 * Packets end with "#". Multiple packets may arrive in one TCP segment.
 * Returns array of complete packet strings (without "#") and the remaining incomplete buffer.
 */
export function extractPackets(buffer: string): { packets: string[]; remaining: string } {
  const packets: string[] = [];
  let remaining = buffer;

  let hashIdx: number;
  while ((hashIdx = remaining.indexOf('#')) !== -1) {
    const packet = remaining.slice(0, hashIdx);
    remaining = remaining.slice(hashIdx + 1);
    if (packet.trim().length > 0) {
      packets.push(packet.trim());
    }
  }

  return { packets, remaining };
}

/**
 * Parse a single packet string and extract the command ID and payload.
 * All packets start with "IW".
 */
export function parseCommandId(packet: string): { commandId: string; payload: string } | null {
  if (!packet.startsWith('IW')) {
    logger.warn('Packet does not start with IW', { packet: packet.slice(0, 30) });
    return null;
  }

  // Command IDs are 4 chars (AP00, AP01, APBL, APJK, etc.) — all uppercase after "IW"
  const body = packet.slice(2); // strip "IW"

  // Known command IDs — ordered by specificity (longer first)
  const knownIds = [
    // Uplink: device → server
    'AP00', 'AP01', 'AP03', 'AP10', 'AP42',
    'APBL', 'APJK', 'APVR', 'APWR', 'APFD', 'APTQ',
    // Uplink: device ACK responses to downlink commands
    'APMC', 'APPH', 'APSM', 'APXL', 'APXY', 'APXZ',
    'AP12', 'AP14', 'AP15', 'AP16', 'AP17', 'AP18', 'AP19',
    'AP31', 'AP34', 'AP40', 'AP46', 'AP84', 'AP86',
    // Downlink echoes (shouldn't come from device but just in case)
    'BP00', 'BP01', 'BP03', 'BP10', 'BPBL', 'BPJK', 'BPFD',
  ];

  for (const id of knownIds) {
    if (body.startsWith(id)) {
      return { commandId: id, payload: body.slice(id.length) };
    }
  }

  // Fallback: try first 4 chars as command ID
  const commandId = body.slice(0, 4).toUpperCase();
  return { commandId, payload: body.slice(4) };
}

/**
 * Dispatch a single parsed packet to the appropriate handler.
 * Returns the IMEI if discovered (from AP00 login), null otherwise.
 */
export async function dispatchPacket(
  packet: string,
  state: ConnectionState,
  send: (data: string) => void
): Promise<string | null> {
  const parsed = parseCommandId(packet);
  if (!parsed) {
    logger.warn('Cannot parse command ID', { packet: packet.slice(0, 50) });
    return null;
  }

  const { commandId, payload } = parsed;
  const imei = state.imei || 'unknown';

  logger.debug('Dispatching packet', { commandId, imei, payloadLen: payload.length });

  try {
    switch (commandId) {
      case 'AP00': {
        // AP00 contains IMEI in its payload; returns the imei
        const discoveredImei = await handleAP00(packet, payload, send);
        return discoveredImei;
      }

      case 'AP01':
        await handleAP01(packet, payload, imei, send);
        break;

      case 'AP03':
        await handleAP03(packet, payload, imei, send);
        break;

      case 'AP10':
        await handleAP10(packet, payload, imei, send);
        break;

      case 'AP42':
      case 'NULL': // PT880 sends photo packets as "IWnull,..." instead of "IWAP42,..."
        await handleAP42(packet, payload, imei, send);
        break;

      case 'APBL':
        await handleAPBL(packet, payload, send);
        break;

      case 'APJK':
        await handleAPJK(packet, payload, imei, send);
        break;

      case 'APVR':
        await handleAPVR(packet, payload);
        break;

      case 'APWR':
        await handleAPWR(packet, payload);
        break;

      case 'APFD':
        await handleAPFD(packet, payload, send);
        break;

      case 'APTQ':
        logger.debug('APTQ weather query received (no weather service configured)', { imei });
        break;

      // ── Device ACK responses to downlink commands ──────────────────────────
      case 'AP12':
        logger.debug('AP12 SOS config acknowledged', { imei, payload });
        break;
      case 'AP14':
        logger.debug('AP14 whitelist acknowledged', { imei });
        break;
      case 'AP15':
        logger.info('AP15 interval acknowledged', { imei, payload });
        break;
      case 'AP16':
        logger.info('AP16 real-time location triggered', { imei, payload });
        break;
      case 'AP17':
        logger.info('AP17 factory reset acknowledged', { imei });
        break;
      case 'AP18':
        logger.info('AP18 restart acknowledged', { imei });
        break;
      case 'AP19':
        logger.info('AP19 server config acknowledged', { imei, payload });
        break;
      case 'AP31':
        logger.info('AP31 power-off acknowledged', { imei });
        break;
      case 'AP34':
        logger.info('AP34 GPS working mode acknowledged', { imei, payload });
        break;
      case 'AP40':
        logger.debug('AP40 shortcut command acknowledged', { imei, payload });
        break;
      case 'AP46':
        logger.debug('AP46 photo command acknowledged', { imei, payload });
        break;
      case 'AP84':
        logger.debug('AP84 whitelist switch acknowledged', { imei, payload });
        break;
      case 'AP86':
        logger.debug('AP86 health monitor acknowledged', { imei, payload });
        break;
      case 'APMC':
        logger.debug('APMC motion detection acknowledged', { imei, payload });
        break;
      case 'APPH':
        logger.debug('APPH phone call switch acknowledged', { imei, payload });
        break;
      case 'APSM':
        logger.info('APSM GPRS command response', { imei, payload });
        break;
      case 'APXL':
        logger.debug('APXL heart rate measure acknowledged', { imei });
        break;
      case 'APXY':
        logger.debug('APXY blood pressure measure acknowledged', { imei });
        break;
      case 'APXZ':
        logger.debug('APXZ blood oxygen measure acknowledged', { imei });
        break;

      default:
        logger.warn('Unknown command ID', { commandId, imei, packet: packet.slice(0, 80) });
    }
  } catch (err) {
    logger.error('Handler threw unexpected error', {
      commandId,
      imei,
      error: (err as Error).message,
      stack: (err as Error).stack,
    });
  }

  return null;
}

/**
 * Process incoming data for a connection.
 * Appends data to the connection buffer, extracts complete packets, and dispatches each.
 * Updates state.imei if an AP00 login is received.
 */
export async function processData(
  data: Buffer,
  state: ConnectionState,
  send: (data: string) => void,
  socket?: import('net').Socket
): Promise<void> {
  state.buffer += data.toString('utf8');

  const { packets, remaining } = extractPackets(state.buffer);
  state.buffer = remaining;

  for (const packet of packets) {
    if (!packet) continue;

    logger.debug('Processing packet', {
      imei: state.imei,
      raw: packet.length > 100 ? packet.slice(0, 100) + '...' : packet,
    });

    const discoveredImei = await dispatchPacket(packet, state, send);
    if (discoveredImei && !state.imei) {
      state.imei = discoveredImei;
      if (socket) registerConnection(discoveredImei, socket);
      logger.info('Device identified', { imei: discoveredImei });
    }
  }

  // Sanity: if buffer is suspiciously large (> 64KB) without a terminator, discard
  if (state.buffer.length > 65536) {
    logger.warn('Buffer overflow, discarding', { imei: state.imei, size: state.buffer.length });
    state.buffer = '';
  }
}
