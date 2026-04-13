import 'dotenv/config';
import net from 'net';
import { processData, ConnectionState } from './parser';
import { initDb, closeDb } from './db';
import { startApiServer } from './api';
import { serverEvents } from './events';
import { registerConnection, unregisterConnection } from './connections';
import logger from './logger';
import fs from 'fs';
import path from 'path';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const PORT = parseInt(process.env.TCP_PORT || '4500', 10);
// BP16 (real-time location) requires up to 90s for GPS search.
// Heartbeat comes every ~5 min. So 3 minutes is a safe idle threshold.
const CONNECTION_TIMEOUT_MS = 3 * 60_000; // 3 minutes

const activeConnections = new Set<net.Socket>();

function createServer(): net.Server {
  const server = net.createServer((socket) => {
    const remoteAddr = `${socket.remoteAddress}:${socket.remotePort}`;
    logger.info('New connection', { remote: remoteAddr });

    activeConnections.add(socket);

    serverEvents.emit('server:connection', {
      type: 'server:connection',
      remote: remoteAddr,
      activeConnections: activeConnections.size,
      timestamp: new Date().toISOString(),
    });

    const state: ConnectionState = {
      imei: null,
      buffer: '',
    };

    // Set idle timeout
    socket.setTimeout(CONNECTION_TIMEOUT_MS);

    // Helper to send data back to device
    const send = (data: string): void => {
      if (socket.destroyed || socket.writableEnded) {
        logger.warn('Attempted to write to closed socket', { imei: state.imei });
        return;
      }
      try {
        socket.write(Buffer.from(data, 'utf8'), (err) => {
          if (err) {
            logger.error('Write error', { imei: state.imei, error: err.message });
          } else {
            logger.debug('Sent to device', { imei: state.imei, data });
          }
        });
      } catch (err) {
        logger.error('Socket write threw', { imei: state.imei, error: (err as Error).message });
      }
    };

    socket.on('data', (data: Buffer) => {
      // Reset idle timer on every incoming packet
      socket.setTimeout(CONNECTION_TIMEOUT_MS);

      logger.debug('Data received', {
        imei: state.imei,
        remote: remoteAddr,
        bytes: data.length,
        raw: data.toString('utf8').slice(0, 200),
      });

      processData(data, state, send, socket).catch((err) => {
        logger.error('processData error', {
          imei: state.imei,
          error: (err as Error).message,
        });
      });
    });

    socket.on('timeout', () => {
      logger.info('Connection timed out (idle)', { imei: state.imei, remote: remoteAddr });
      socket.destroy();
    });

    socket.on('close', (hadError: boolean) => {
      activeConnections.delete(socket);
      if (state.imei) unregisterConnection(state.imei, socket);
      logger.info('Connection closed', { imei: state.imei, remote: remoteAddr, hadError });
      serverEvents.emit('server:disconnect', {
        type: 'server:disconnect',
        imei: state.imei,
        remote: remoteAddr,
        activeConnections: activeConnections.size,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('error', (err: Error) => {
      const code = (err as NodeJS.ErrnoException).code;
      // ECONNRESET/EPIPE are normal disconnects — log at debug level
      if (code === 'ECONNRESET' || code === 'EPIPE') {
        logger.debug('Socket error (normal disconnect)', {
          imei: state.imei,
          remote: remoteAddr,
          code,
        });
      } else {
        logger.error('Socket error', {
          imei: state.imei,
          remote: remoteAddr,
          error: err.message,
          code,
        });
      }
    });
  });

  server.on('error', (err: Error) => {
    logger.error('Server error', { error: err.message });
  });

  return server;
}

async function gracefulShutdown(server: net.Server, signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  // Stop accepting new connections
  server.close(() => {
    logger.info('Server stopped accepting connections');
  });

  // Destroy all active connections
  for (const socket of activeConnections) {
    socket.destroy();
  }
  activeConnections.clear();

  try {
    await closeDb();
  } catch (err) {
    logger.error('Error closing database', { error: (err as Error).message });
  }

  logger.info('Graceful shutdown complete');
  process.exit(0);
}

async function main(): Promise<void> {
  logger.info('Starting IW Protocol TCP server (Thinkrace V3.03)');

  // Initialize database
  try {
    await initDb();
  } catch (err) {
    logger.error('Failed to initialize database', { error: (err as Error).message });
    logger.warn('Continuing without database — data will not be persisted');
  }

  // Start REST API + WebSocket server
  startApiServer();

  const server = createServer();

  server.listen(PORT, '0.0.0.0', () => {
    logger.info(`TCP server listening`, { port: PORT, address: '0.0.0.0' });
  });

  // Graceful shutdown handlers
  process.on('SIGTERM', () => gracefulShutdown(server, 'SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown(server, 'SIGINT'));

  // Catch unhandled errors to prevent crashes
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { error: err.message, stack: err.stack });
    // Don't exit — keep server running
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
    });
    // Don't exit — keep server running
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
