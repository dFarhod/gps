import http from 'http';
import express, { Request, Response, NextFunction } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { serverEvents, AnyServerEvent } from './events';
import { sendToDevice, isConnected } from './connections';
import {
  buildBP15, buildBP16, buildBP17, buildBP18, buildBP19, buildBP31, buildBP34,
  buildBP46, buildBP12, buildBP84, buildBP86, buildBPMC, buildBPPH,
  buildBPXL, buildBPXY, buildBPXZ,
  buildBP40, buildBPSM, bp40,
} from './responses';
import {
  getDevices,
  getDevice,
  getLocations,
  getAlarms,
  getHealthData,
  getHeartbeats,
  getStats,
  updateDevicePerson,
  assignDeviceToPerson,
  getWearingEvents,
  getPersons,
  getPerson,
  createPerson,
  updatePerson,
  deletePerson,
} from './db';
import logger from './logger';

const API_PORT = parseInt(process.env.API_PORT || '3001', 10);

// ── Express app ────────────────────────────────────────────────────────────────

const app = express();
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
}));
app.options('*', cors());
app.use(express.json());

// ── REST API routes ────────────────────────────────────────────────────────────

app.get('/api/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/devices', async (_req: Request, res: Response) => {
  try {
    const devices = await getDevices();
    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/devices/:imei', async (req: Request, res: Response) => {
  try {
    const device = await getDevice(req.params.imei);
    if (!device) return res.status(404).json({ error: 'Device not found' });
    res.json(device);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.patch('/api/devices/:imei/person', async (req: Request, res: Response) => {
  try {
    const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName : null;
    const device = await updateDevicePerson(req.params.imei, fullName);
    if (!device) return res.status(404).json({ error: 'Device not found' });
    res.json(device);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.patch('/api/devices/:imei/assign', async (req: Request, res: Response) => {
  try {
    const personId = req.body?.personId != null ? Number(req.body.personId) : null;
    const device = await assignDeviceToPerson(req.params.imei, personId);
    if (!device) return res.status(404).json({ error: 'Device not found' });
    res.json(device);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── Persons routes ─────────────────────────────────────────────────────────────

app.get('/api/persons', async (_req: Request, res: Response) => {
  try {
    res.json(await getPersons());
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/persons/:id', async (req: Request, res: Response) => {
  try {
    const person = await getPerson(Number(req.params.id));
    if (!person) return res.status(404).json({ error: 'Person not found' });
    res.json(person);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/persons', async (req: Request, res: Response) => {
  try {
    const { fullName, phone, notes } = req.body ?? {};
    if (!fullName?.trim()) return res.status(400).json({ error: 'fullName is required' });
    const person = await createPerson(fullName, phone, notes);
    res.status(201).json(person);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.patch('/api/persons/:id', async (req: Request, res: Response) => {
  try {
    const { fullName, phone, notes } = req.body ?? {};
    if (!fullName?.trim()) return res.status(400).json({ error: 'fullName is required' });
    const person = await updatePerson(Number(req.params.id), fullName, phone, notes);
    if (!person) return res.status(404).json({ error: 'Person not found' });
    res.json(person);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/persons/:id', async (req: Request, res: Response) => {
  try {
    await deletePerson(Number(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/devices/:imei/locations', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string || '100', 10), 5000);
    const offset = parseInt(req.query.offset as string || '0', 10);
    const from = req.query.from as string | undefined;
    const to   = req.query.to   as string | undefined;
    const rows = await getLocations(req.params.imei, limit, offset, from, to);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/devices/:imei/alarms', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 500);
    const rows = await getAlarms(req.params.imei, limit);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/devices/:imei/health', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 500);
    const rows = await getHealthData(req.params.imei, limit);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/devices/:imei/heartbeats', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 500);
    const rows = await getHeartbeats(req.params.imei, limit);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/devices/:imei/wearing', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string || '100', 10), 500);
    const rows = await getWearingEvents(req.params.imei, limit);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/wearing', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string || '200', 10), 1000);
    const rows = await getWearingEvents(undefined, limit);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/alarms', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string || '100', 10), 1000);
    const rows = await getAlarms(undefined, limit);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── Device command endpoint ────────────────────────────────────────────────────
app.post('/api/devices/:imei/command', (req: Request, res: Response) => {
  const { imei } = req.params;
  const { cmd, params = {} } = req.body as { cmd: string; params?: Record<string, unknown> };

  if (!isConnected(imei)) {
    return res.status(409).json({ error: 'Device not connected' });
  }

  let packet: string | null = null;

  switch (cmd) {
    case 'location':      packet = buildBP16(imei); break;
    case 'message':       packet = buildBP40(imei, `>*setmsg@${String(params.text ?? '')}*<`); break;
    case 'restart':       packet = buildBP18(imei); break;
    case 'poweroff':      packet = buildBP31(imei); break;
    case 'factoryreset':  packet = buildBP17(imei); break;
    case 'photo':         packet = bp40.photo(imei); break;   // PT880 uses BP40 >*photo@1*<
    case 'photo_bp46':    packet = buildBP46(imei); break;   // other models
    case 'heartrate':     packet = buildBPXL(imei); break;
    case 'bloodpressure': packet = buildBPXY(imei); break;
    case 'bloodoxygen':   packet = buildBPXZ(imei); break;
    case 'interval':
      packet = buildBP15(imei, Number(params.seconds ?? 60));
      break;
    case 'workmode':
    case 'gps_on':
      // BP34: mode 8 = GPS priority over WiFi, GPS switch ON
      packet = buildBP34(imei, Number(params.mode ?? 8), Number(params.interval ?? 60), 1);
      break;
    case 'gps_off':
      packet = buildBP34(imei, Number(params.mode ?? 8), Number(params.interval ?? 60), 0);
      break;
    case 'setserver':
      packet = buildBP19(imei, String(params.host ?? ''), Number(params.port ?? 4500));
      break;
    case 'healthmonitor':
      packet = buildBP86(imei, Boolean(params.enable ?? true), Number(params.minutes ?? 10));
      break;
    case 'sos':
      packet = buildBP12(imei, String(params.sos1 ?? ''), String(params.sos2 ?? ''), String(params.sos3 ?? ''));
      break;
    case 'whitelist':
      packet = buildBP84(imei, Boolean(params.enable ?? true));
      break;
    case 'motiondetect':
      packet = buildBPMC(imei, Number(params.flag ?? 1) as 0 | 1 | 2);
      break;
    case 'phonecall':
      packet = buildBPPH(imei, Boolean(params.enable ?? true));
      break;
    case 'fall_on':    packet = bp40.fallOn(imei); break;
    case 'fall_off':   packet = bp40.fallOff(imei); break;
    case 'ble_on':     packet = bp40.bleOn(imei, Number(params.seconds ?? 3600)); break;
    case 'ble_off':    packet = bp40.bleOff(imei); break;
    case 'wear_on':    packet = bp40.wearOn(imei); break;
    case 'wear_off':   packet = bp40.wearOff(imei); break;
    case 'sedentary':  packet = bp40.sedentary(imei, Number(params.seconds ?? 300)); break;
    case 'title':      packet = bp40.setTitle(imei, String(params.name ?? '')); break;
    case 'networkloc': packet = bp40.networkLoc(imei, Boolean(params.enable)); break;
    case 'wifi_on':      packet = buildBPSM(imei, '@wifict@=switch-1'); break;
    case 'wifi_off':     packet = buildBPSM(imei, '@wifict@=switch-0'); break;
    case 'wifi_connect': {
      const ssid = String(params.ssid ?? '').replace(/,/g, '-');
      const pass = String(params.password ?? '').replace(/,/g, '-');
      const enc  = String(params.encrypt ?? 'psk');
      packet = buildBPSM(imei, `@wifictl@=connect-${ssid}-${pass}-${enc}`);
      break;
    }
    case 'wifi_reset':   packet = buildBPSM(imei, '@wifictl@=reset'); break;
    case 'raw_bp40':   packet = buildBP40(imei, String(params.command ?? '')); break;
    case 'raw_bpsm':   packet = buildBPSM(imei, String(params.command ?? '')); break;
    default:
      return res.status(400).json({ error: `Unknown command: ${cmd}` });
  }

  const ok = sendToDevice(imei, packet);
  if (!ok) return res.status(500).json({ error: 'Failed to send' });

  logger.info('Command sent via API', { imei, cmd, packet });
  res.json({ success: true, sent: packet });
});

app.get('/api/connected', (_req: Request, res: Response) => {
  const { getConnectedImeis } = require('./connections');
  res.json(getConnectedImeis());
});

app.post('/api/location/request-all', (_req: Request, res: Response) => {
  const { getConnectedImeis } = require('./connections');
  const imeis: string[] = getConnectedImeis();
  let sent = 0;
  for (const imei of imeis) {
    const packet = buildBP16(imei);
    if (sendToDevice(imei, packet)) sent++;
  }
  logger.info('Broadcast location request', { sent, total: imeis.length });
  res.json({ sent, total: imeis.length });
});

// ── Photos API ────────────────────────────────────────────────────────────────
const PHOTOS_DIR = path.join(process.cwd(), 'photos');

app.get('/api/photos/:imei', (req: Request, res: Response) => {
  const deviceDir = path.join(PHOTOS_DIR, req.params.imei);
  if (!fs.existsSync(deviceDir)) return res.json([]);
  const files = fs.readdirSync(deviceDir)
    .filter(f => f.endsWith('.jpg'))
    .sort()
    .reverse()
    .map(f => ({
      filename: f,
      url: `/api/photos/${req.params.imei}/${f}`,
      timestamp: f.replace('.jpg', ''),
      size: fs.statSync(path.join(deviceDir, f)).size,
    }));
  res.json(files);
});

app.get('/api/photos/:imei/:filename', (req: Request, res: Response) => {
  const { imei, filename } = req.params;
  if (!/^[\w.-]+$/.test(filename)) return res.status(400).json({ error: 'Invalid filename' });
  const filepath = path.join(PHOTOS_DIR, imei, filename);
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Not found' });
  res.sendFile(filepath);
});

app.get('/api/photos', (req: Request, res: Response) => {
  if (!fs.existsSync(PHOTOS_DIR)) return res.json([]);
  const result: object[] = [];
  const imeis = fs.readdirSync(PHOTOS_DIR).filter(d =>
    fs.statSync(path.join(PHOTOS_DIR, d)).isDirectory()
  );
  for (const imei of imeis) {
    const deviceDir = path.join(PHOTOS_DIR, imei);
    const files = fs.readdirSync(deviceDir).filter(f => f.endsWith('.jpg')).sort().reverse();
    for (const f of files) {
      result.push({
        imei,
        filename: f,
        url: `/api/photos/${imei}/${f}`,
        timestamp: f.replace('.jpg', ''),
        size: fs.statSync(path.join(deviceDir, f)).size,
      });
    }
  }
  result.sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp));
  res.json(result);
});

app.get('/api/health', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string || '100', 10), 1000);
    const rows = await getHealthData(undefined, limit);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Serve built UI in production
const uiDist = path.join(process.cwd(), 'ui', 'dist');
if (fs.existsSync(uiDist)) {
  app.use(express.static(uiDist));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(uiDist, 'index.html'));
  });
}

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('API error', { error: err.message });
  res.status(500).json({ error: err.message });
});

// ── WebSocket server ───────────────────────────────────────────────────────────

const wsClients = new Set<WebSocket>();

export function broadcastEvent(event: AnyServerEvent): void {
  const payload = JSON.stringify(event);
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

// Forward internal server events to all WebSocket clients
const forwardedEvents: AnyServerEvent['type'][] = [
  'device:login',
  'device:location',
  'device:alarm',
  'device:heartbeat',
  'device:health',
  'device:wearing',
  'device:fall',
  'device:photo',
  'server:connection',
  'server:disconnect',
];

for (const eventType of forwardedEvents) {
  serverEvents.on(eventType, (data: AnyServerEvent) => {
    broadcastEvent(data);
  });
}

// ── HTTP + WS server ───────────────────────────────────────────────────────────

export function startApiServer(): http.Server {
  const httpServer = http.createServer(app);

  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    wsClients.add(ws);
    logger.debug('WebSocket client connected', {
      remote: req.socket.remoteAddress,
      total: wsClients.size,
    });

    // Send current stats on connect
    getStats()
      .then((stats) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'init:stats', data: stats }));
        }
      })
      .catch(() => {});

    ws.on('close', () => {
      wsClients.delete(ws);
      logger.debug('WebSocket client disconnected', { total: wsClients.size });
    });

    ws.on('error', (err) => {
      logger.error('WebSocket client error', { error: err.message });
      wsClients.delete(ws);
    });
  });

  httpServer.listen(API_PORT, '0.0.0.0', () => {
    logger.info('API + WebSocket server listening', { port: API_PORT });
  });

  return httpServer;
}

export { wsClients };
