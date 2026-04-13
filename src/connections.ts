/**
 * Active TCP connection registry.
 * Maps IMEI → Socket so downlink commands can be sent to specific devices.
 */
import net from 'net';
import logger from './logger';

const connections = new Map<string, net.Socket>();

export function registerConnection(imei: string, socket: net.Socket): void {
  // Eski socket bo'lsa — uni yoping (lekin map dan o'chirmang)
  const old = connections.get(imei);
  if (old && old !== socket && !old.destroyed) {
    logger.debug('Closing old socket for re-login', { imei });
    old.destroy();
  }
  connections.set(imei, socket);
  logger.debug('Connection registered', { imei, total: connections.size });
}

export function unregisterConnection(imei: string, socket: net.Socket): void {
  // Faqat bu socket hali ro'yxatda bo'lsa o'chiramiz
  if (connections.get(imei) === socket) {
    connections.delete(imei);
    logger.debug('Connection unregistered', { imei, total: connections.size });
  }
}

export function sendToDevice(imei: string, data: string): boolean {
  const socket = connections.get(imei);
  if (!socket || socket.destroyed || socket.writableEnded) {
    logger.warn('sendToDevice: device not connected', { imei });
    return false;
  }
  try {
    socket.write(Buffer.from(data, 'utf8'));
    logger.info('Command sent to device', { imei, data });
    return true;
  } catch (err) {
    logger.error('sendToDevice write error', { imei, error: (err as Error).message });
    return false;
  }
}

export function getConnectedImeis(): string[] {
  return Array.from(connections.keys());
}

export function isConnected(imei: string): boolean {
  const s = connections.get(imei);
  return !!s && !s.destroyed && !s.writableEnded;
}
