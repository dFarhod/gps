import fs from 'fs';
import path from 'path';
import { updateDeviceLastSeen } from '../db';
import { serverEvents } from '../events';
import logger from '../logger';

// Ensure photos directory exists
const PHOTOS_DIR = path.join(process.cwd(), 'photos');
if (!fs.existsSync(PHOTOS_DIR)) {
  fs.mkdirSync(PHOTOS_DIR, { recursive: true });
}

// In-memory assembly buffer: key = imei+time
interface PictureAssembly {
  imei: string;
  time: string;      // yyyymmddhhmmss
  total: number;
  chunks: Map<number, string>; // packet index → hex/base64 data
  length: number;   // bytes per packet
}
const assemblies = new Map<string, PictureAssembly>();

/**
 * AP42 — Upload picture packet (multi-packet)
 *
 * Protocol format:
 *   IWAP42,{time},{total},{current},{length},{data}#
 *
 * Example:
 *   IWAP42,20140818064408,6,1,1024,FFD8FFE0...#
 *
 * Server must ACK each packet:
 *   IWBP42,{time},{total},{current},1#   (1=success, 0=fail)
 */
export async function handleAP42(
  raw: string,
  payload: string,
  imei: string,
  send: (data: string) => void
): Promise<void> {
  try {
    // Strip leading comma if present
    const cleaned = payload.startsWith(',') ? payload.slice(1) : payload;

    // Parse: time,total,current,length,data
    const firstComma = cleaned.indexOf(',');
    if (firstComma < 0) {
      logger.warn('AP42: malformed payload', { imei, raw: raw.slice(0, 60) });
      send('IWBP42#');
      return;
    }

    const parts = cleaned.split(',');
    if (parts.length < 5) {
      logger.warn('AP42: too few fields', { imei, fields: parts.length });
      send('IWBP42#');
      return;
    }

    let timeStr: string, totalStr: string, currentStr: string, lengthStr: string, dataParts: string[];

    // PT880 sends: imei,total,current,size,data (no timestamp)
    // Standard AP42: timestamp,total,current,size,data
    // Detect PT880 format: first field is 15-digit IMEI
    if (/^\d{15}$/.test(parts[0]) && parts[0] === imei) {
      [, totalStr, currentStr, lengthStr, ...dataParts] = parts;
      timeStr = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
    } else {
      [timeStr, totalStr, currentStr, lengthStr, ...dataParts] = parts;
    }

    const total   = parseInt(totalStr,   10);
    const current = parseInt(currentStr, 10);
    const length  = parseInt(lengthStr,  10);
    const data    = dataParts.join(',');

    if (isNaN(total) || isNaN(current) || isNaN(length)) {
      logger.warn('AP42: invalid numeric fields', { imei, totalStr, currentStr, lengthStr });
      send(`IWBP42,${timeStr},${total},${current},0#`);
      return;
    }

    logger.info('Picture packet received', { imei, time: timeStr, current, total, length, dataLen: data.length });

    // Use imei as key base for PT880 (no unique timestamp per photo)
    const key = `${imei}_photo`;

    // Packet 1 = yangi foto boshlanishi → eski assemblyni tozala
    if (current === 1) {
      assemblies.delete(key);
    }

    if (!assemblies.has(key)) {
      assemblies.set(key, { imei, time: timeStr, total, chunks: new Map(), length });
    }

    const assembly = assemblies.get(key)!;
    assembly.chunks.set(current, data);

    // ACK this packet
    send(`IWBP42,${timeStr},${total},${current},1#`);

    // Check if all packets received
    if (assembly.chunks.size < total) {
      logger.debug('Picture incomplete', { imei, received: assembly.chunks.size, total });
      return;
    }

    // All packets received — assemble
    assemblies.delete(key);

    const allData = Array.from({ length: total }, (_, i) => assembly.chunks.get(i + 1) ?? '').join('');

    // Detect encoding and convert to Buffer
    let imageBuffer: Buffer;
    if (/^[0-9A-Fa-f]+$/.test(allData.trim())) {
      imageBuffer = Buffer.from(allData.trim(), 'hex');
    } else {
      imageBuffer = Buffer.from(allData.trim(), 'base64');
    }

    // Save to disk: photos/{imei}/{time}.jpg
    const deviceDir = path.join(PHOTOS_DIR, imei);
    if (!fs.existsSync(deviceDir)) fs.mkdirSync(deviceDir, { recursive: true });

    const filename = `${timeStr}.jpg`;
    const filepath = path.join(deviceDir, filename);
    fs.writeFileSync(filepath, imageBuffer);

    logger.info('Picture saved', { imei, path: filepath, size: imageBuffer.length });

    try {
      await updateDeviceLastSeen(imei);
    } catch (err) {
      logger.error('AP42 db error', { error: (err as Error).message, imei });
    }

    // Broadcast via WebSocket
    serverEvents.emit('device:photo', {
      type: 'device:photo',
      imei,
      filename,
      url: `/api/photos/${imei}/${filename}`,
      size: imageBuffer.length,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    logger.error('AP42 handler error', { error: (err as Error).message, imei });
    send('IWBP42#');
  }
}
