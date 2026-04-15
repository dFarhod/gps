import { Pool, PoolClient } from 'pg';
import logger from './logger';
import {
  LoginPacket,
  LocationPacket,
  AlarmPacket,
  HealthPacket,
  HeartbeatPacket,
  FirmwarePacket,
  WearingPacket,
  FallAlarmPacket,
} from './types';

let pool: Pool | null = null;

export async function initDb(): Promise<void> {
  pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'tracker_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on('error', (err) => {
    logger.error('Unexpected error on idle client', { error: err.message });
  });

  const client = await pool.connect();
  try {
    await createSchema(client);
    logger.info('Database connected and schema initialized');
  } finally {
    client.release();
  }
}

// Alarm code string → DB enum value
const ALARM_TYPE_MAP: Record<string, string> = {
  '00': 'no_alarm',
  '01': 'sos',
  '02': 'low_battery',
  '03': 'device_removed',
  '04': 'device_removed',
  '05': 'tamper_open',
  '06': 'fall',
  '07': 'heart_rate_abnormal',
  '08': 'heart_rate_high',
  '09': 'heart_rate_low',
  '10': 'systolic_high',
  '11': 'systolic_low',
  '12': 'diastolic_high',
  '13': 'diastolic_low',
  '14': 'sedentary',
  '15': 'temp_high',
  '16': 'device_removed',
  '17': 'temp_low',
  '19': 'power_off',
  '20': 'geofence_exit',
  '21': 'geofence_enter',
};

async function createSchema(client: PoolClient): Promise<void> {
  // persons table — may already exist
  await client.query(`
    CREATE TABLE IF NOT EXISTS persons (
      id            SERIAL PRIMARY KEY,
      full_name     VARCHAR(150) NOT NULL,
      phone         VARCHAR(30),
      notes         TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // devices — full_name and person_id columns added if missing
  await client.query(`
    ALTER TABLE devices
    ADD COLUMN IF NOT EXISTS full_name VARCHAR(150)
  `);
  await client.query(`
    ALTER TABLE devices
    ADD COLUMN IF NOT EXISTS person_id INTEGER REFERENCES persons(id) ON DELETE SET NULL
  `);

  // gps_interval_sec column — tracks the last configured GPS upload interval
  await client.query(`
    ALTER TABLE devices
    ADD COLUMN IF NOT EXISTS gps_interval_sec INTEGER
  `);

  // wearing_events — new table not in old schema
  await client.query(`
    CREATE TABLE IF NOT EXISTS wearing_events (
      id             BIGSERIAL PRIMARY KEY,
      imei           VARCHAR(20) NOT NULL,
      status         SMALLINT NOT NULL,
      person_name    VARCHAR(150),
      wear_timestamp VARCHAR(30),
      created_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_wearing_events_imei ON wearing_events(imei);
    CREATE INDEX IF NOT EXISTS idx_wearing_events_created_at ON wearing_events(created_at DESC);
  `);
}

/** Look up the devices.id UUID for a given IMEI. */
async function getDeviceUuid(imei: string): Promise<string | null> {
  const db = getPool();
  const r = await db.query('SELECT id FROM devices WHERE imei = $1', [imei]);
  return r.rows[0]?.id ?? null;
}

function getPool(): Pool {
  if (!pool) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return pool;
}

export async function upsertDevice(packet: LoginPacket): Promise<void> {
  const db = getPool();
  // imsi column is varchar(16) in DB; truncate to avoid length errors
  const imsi = packet.imsi ? packet.imsi.slice(0, 16) : null;
  await db.query(
    `INSERT INTO devices (imei, iccid, imsi, last_seen, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW(), NOW())
     ON CONFLICT (imei) DO UPDATE
       SET iccid      = EXCLUDED.iccid,
           imsi       = EXCLUDED.imsi,
           last_seen  = NOW(),
           updated_at = NOW()`,
    [packet.imei, packet.iccid, imsi]
  );
}

export async function updateDeviceLastSeen(imei: string): Promise<void> {
  const db = getPool();
  await db.query(
    `INSERT INTO devices (imei, last_seen, created_at)
     VALUES ($1, NOW(), NOW())
     ON CONFLICT (imei) DO UPDATE SET last_seen = NOW()`,
    [imei]
  );
}

export async function updateDeviceFirmware(packet: FirmwarePacket): Promise<void> {
  const db = getPool();
  await db.query(
    `INSERT INTO devices (imei, firmware_version, last_seen, created_at)
     VALUES ($1, $2, NOW(), NOW())
     ON CONFLICT (imei) DO UPDATE
       SET firmware_version = EXCLUDED.firmware_version,
           last_seen = NOW()`,
    [packet.imei, packet.version]
  );
}

export async function insertLocation(packet: LocationPacket): Promise<void> {
  const deviceId = await getDeviceUuid(packet.imei);
  if (!deviceId) return;

  const db = getPool();
  const locationTime = parseLocationTime(packet.date, packet.locationTime);
  const workingMode = packet.workMode ? parseInt(packet.workMode, 10) || null : null;

  await db.query(
    `INSERT INTO locations
       (device_id, latitude, longitude, speed, gps_valid, gsm_signal, battery_level,
        working_mode, lbs_mcc, lbs_mnc, lbs_lac, lbs_cid, wifi_data, hybrid_lat, hybrid_lng,
        location_time, source, received_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'gps',NOW())`,
    [
      deviceId,
      packet.latitude,
      packet.longitude,
      packet.speed,
      packet.gpsValid,
      packet.gsmSignal,
      packet.battery,
      workingMode,
      packet.mcc ? parseInt(packet.mcc, 10) || null : null,
      packet.mnc ? parseInt(packet.mnc, 10) || null : null,
      packet.lac ? parseInt(packet.lac, 10) || null : null,
      packet.cid ? parseInt(packet.cid, 10) || null : null,
      JSON.stringify(packet.wifiData),
      packet.hybridLat ?? null,
      packet.hybridLng ?? null,
      locationTime,
    ]
  );
  // Update cached location on devices
  await db.query(
    `UPDATE devices SET last_lat = $1, last_lng = $2, last_seen = NOW(), updated_at = NOW() WHERE id = $3`,
    [packet.latitude, packet.longitude, deviceId]
  );
}

export async function insertAlarm(packet: AlarmPacket): Promise<void> {
  const deviceId = await getDeviceUuid(packet.imei);
  if (!deviceId) return;

  const db = getPool();
  const locationTime = parseLocationTime(packet.date, packet.locationTime);
  const alarmCodeInt = parseInt(packet.alarmCode, 10) || 0;
  const alarmType = ALARM_TYPE_MAP[packet.alarmCode] ?? 'unknown';

  await db.query(
    `INSERT INTO alarms (device_id, alarm_code, alarm_type, latitude, longitude, alarm_time, received_at)
     VALUES ($1,$2,$3::alarm_type,$4,$5,$6,NOW())`,
    [deviceId, alarmCodeInt, alarmType, packet.latitude, packet.longitude, locationTime]
  );
}

export async function insertHealthData(packet: HealthPacket): Promise<void> {
  const deviceId = await getDeviceUuid(packet.imei);
  if (!deviceId) return;

  const db = getPool();
  let measuredAt: Date | null = null;
  try {
    const parsed = new Date(packet.datetime.trim().replace(' ', 'T'));
    measuredAt = isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    measuredAt = null;
  }

  const healthTypeMap: Record<number, string> = {
    1: 'blood_pressure',
    2: 'heart_rate',
    3: 'body_temperature',
    4: 'blood_oxygen',
  };
  const healthType = healthTypeMap[packet.type] ?? 'heart_rate';

  if (packet.type === 1) {
    // value = "diastolic|systolic"
    const [d, s] = packet.value.split('|').map((v) => parseInt(v, 10) || null);
    await db.query(
      `INSERT INTO health_data (device_id, health_type, diastolic_bp, systolic_bp, measured_at, received_at)
       VALUES ($1,$2::health_type,$3,$4,$5,NOW())`,
      [deviceId, healthType, d, s, measuredAt]
    );
  } else if (packet.type === 2) {
    await db.query(
      `INSERT INTO health_data (device_id, health_type, heart_rate, measured_at, received_at)
       VALUES ($1,$2::health_type,$3,$4,NOW())`,
      [deviceId, healthType, parseInt(packet.value, 10) || null, measuredAt]
    );
  } else if (packet.type === 3) {
    await db.query(
      `INSERT INTO health_data (device_id, health_type, body_temperature, measured_at, received_at)
       VALUES ($1,$2::health_type,$3,$4,NOW())`,
      [deviceId, healthType, parseFloat(packet.value) || null, measuredAt]
    );
  } else {
    await db.query(
      `INSERT INTO health_data (device_id, health_type, blood_oxygen, measured_at, received_at)
       VALUES ($1,$2::health_type,$3,$4,NOW())`,
      [deviceId, healthType, parseInt(packet.value, 10) || null, measuredAt]
    );
  }
}

export async function insertWearingEvent(
  imei: string,
  status: number,
  personName: string | null,
  wearTimestamp: string
): Promise<void> {
  const db = getPool();
  await db.query(
    `INSERT INTO wearing_events (imei, status, person_name, wear_timestamp, created_at)
     VALUES ($1, $2, $3, $4, NOW())`,
    [imei, status, personName, wearTimestamp]
  );
}

export async function getWearingEvents(imei?: string, limit = 100): Promise<unknown[]> {
  try {
    const db = getPool();
    if (imei) {
      const result = await db.query(
        `SELECT * FROM wearing_events WHERE imei = $1 ORDER BY created_at DESC LIMIT $2`,
        [imei, limit]
      );
      return result.rows;
    }
    const result = await db.query(
      `SELECT * FROM wearing_events ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows;
  } catch {
    return [];
  }
}

export async function insertHeartbeat(packet: HeartbeatPacket): Promise<void> {
  const deviceId = await getDeviceUuid(packet.imei);
  if (!deviceId) return;

  const db = getPool();
  await db.query(
    `INSERT INTO heartbeats (device_id, battery_level, gsm_signal, pedometer, received_at)
     VALUES ($1,$2,$3,$4,NOW())`,
    [deviceId, packet.battery, packet.gsmSignal, packet.pedometer]
  );
}

function parseLocationTime(date: string, time: string): Date | null {
  try {
    // date: DDMMYY, time: HHmmss
    if (date.length < 6 || time.length < 6) return null;
    const day = date.slice(0, 2);
    const month = date.slice(2, 4);
    const year = `20${date.slice(4, 6)}`;
    const hour = time.slice(0, 2);
    const min = time.slice(2, 4);
    const sec = time.slice(4, 6);
    return new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}Z`);
  } catch {
    return null;
  }
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database connection closed');
  }
}

export async function getDevicePersonName(imei: string): Promise<string | null> {
  try {
    const db = getPool();
    const result = await db.query(
      `SELECT COALESCE(p.full_name, NULLIF(BTRIM(d.full_name), '')) AS full_name
         FROM devices d
         LEFT JOIN persons p ON p.id = d.person_id
        WHERE d.imei = $1`,
      [imei]
    );
    return result.rows[0]?.full_name ?? null;
  } catch {
    return null;
  }
}

export async function updateDevicePerson(imei: string, fullName: string | null): Promise<unknown | null> {
  const db = getPool();
  const normalized = fullName?.trim() ? fullName.trim() : null;

  await db.query(
    `INSERT INTO devices (imei, full_name, last_seen, created_at)
     VALUES ($1, $2, NOW(), NOW())
     ON CONFLICT (imei) DO UPDATE
       SET full_name = EXCLUDED.full_name`,
    [imei, normalized]
  );

  return getDevice(imei);
}

export async function updateDeviceInterval(imei: string, intervalSec: number): Promise<void> {
  const db = getPool();
  await db.query(
    `INSERT INTO devices (imei, gps_interval_sec, last_seen, created_at)
     VALUES ($1, $2, NOW(), NOW())
     ON CONFLICT (imei) DO UPDATE SET gps_interval_sec = EXCLUDED.gps_interval_sec`,
    [imei, intervalSec]
  );
}

export async function assignDeviceToPerson(imei: string, personId: number | null): Promise<unknown | null> {
  const db = getPool();
  await db.query(
    `UPDATE devices SET person_id = $1 WHERE imei = $2`,
    [personId, imei]
  );
  return getDevice(imei);
}

// ── Persons CRUD ───────────────────────────────────────────────────────────────

export async function getPersons(): Promise<unknown[]> {
  try {
    const db = getPool();
    const result = await db.query(`
      SELECT p.*,
             COUNT(d.imei)::int AS device_count,
             JSON_AGG(
               JSON_BUILD_OBJECT('imei', d.imei, 'full_name', d.full_name, 'last_seen', d.last_seen)
             ) FILTER (WHERE d.imei IS NOT NULL) AS devices
        FROM persons p
        LEFT JOIN devices d ON d.person_id = p.id
       GROUP BY p.id
       ORDER BY p.full_name
    `);
    return result.rows;
  } catch {
    return [];
  }
}

export async function getPerson(id: number): Promise<unknown | null> {
  try {
    const db = getPool();
    const result = await db.query(
      `SELECT p.*,
              COUNT(d.imei)::int AS device_count,
              JSON_AGG(
                JSON_BUILD_OBJECT('imei', d.imei, 'full_name', d.full_name, 'last_seen', d.last_seen)
              ) FILTER (WHERE d.imei IS NOT NULL) AS devices
         FROM persons p
         LEFT JOIN devices d ON d.person_id = p.id
        WHERE p.id = $1
        GROUP BY p.id`,
      [id]
    );
    return result.rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function createPerson(fullName: string, phone?: string, notes?: string): Promise<unknown | null> {
  const db = getPool();
  const result = await db.query(
    `INSERT INTO persons (full_name, phone, notes, created_at)
     VALUES ($1, $2, $3, NOW())
     RETURNING *`,
    [fullName.trim(), phone?.trim() || null, notes?.trim() || null]
  );
  return result.rows[0] ?? null;
}

export async function updatePerson(id: number, fullName: string, phone?: string, notes?: string): Promise<unknown | null> {
  const db = getPool();
  await db.query(
    `UPDATE persons SET full_name = $1, phone = $2, notes = $3 WHERE id = $4`,
    [fullName.trim(), phone?.trim() || null, notes?.trim() || null, id]
  );
  return getPerson(id);
}

export async function deletePerson(id: number): Promise<void> {
  const db = getPool();
  await db.query(`DELETE FROM persons WHERE id = $1`, [id]);
}

// ── Query functions for REST API ───────────────────────────────────────────────

export async function getStats(): Promise<Record<string, number>> {
  try {
    const db = getPool();
    const [devices, locations, alarms, health] = await Promise.all([
      db.query('SELECT COUNT(*) FROM devices'),
      db.query('SELECT COUNT(*) FROM locations'),
      db.query('SELECT COUNT(*) FROM alarms'),
      db.query('SELECT COUNT(*) FROM health_data'),
    ]);
    const onlineResult = await db.query(
      `SELECT COUNT(*) FROM devices WHERE last_seen > NOW() - INTERVAL '5 minutes'`
    );
    return {
      totalDevices: parseInt(devices.rows[0].count, 10),
      onlineDevices: parseInt(onlineResult.rows[0].count, 10),
      totalLocations: parseInt(locations.rows[0].count, 10),
      totalAlarms: parseInt(alarms.rows[0].count, 10),
      totalHealthRecords: parseInt(health.rows[0].count, 10),
    };
  } catch {
    return { totalDevices: 0, onlineDevices: 0, totalLocations: 0, totalAlarms: 0, totalHealthRecords: 0 };
  }
}

export async function getDevices(): Promise<unknown[]> {
  try {
    const db = getPool();
    const result = await db.query(`
      SELECT d.imei,
             COALESCE(p.full_name, d.full_name) AS full_name,
             COALESCE(p.full_name, d.full_name) AS display_name,
             d.iccid, d.imsi, d.firmware_version, d.last_seen, d.created_at,
             d.person_id,
             d.gps_interval_sec,
             p.full_name AS person_full_name,
             p.phone     AS person_phone,
             COALESCE(l.latitude,  d.last_lat)         AS latitude,
             COALESCE(l.longitude, d.last_lng)         AS longitude,
             COALESCE(l.battery_level, d.last_battery) AS battery,
             COALESCE(l.gsm_signal, d.last_gsm_signal) AS gsm_signal,
             l.gps_valid,
             l.speed,
             l.received_at AS last_location_at,
             (SELECT COUNT(*) FROM alarms a WHERE a.device_id = d.id)::int AS alarm_count
        FROM devices d
        LEFT JOIN persons p ON p.id = d.person_id
        LEFT JOIN LATERAL (
          SELECT latitude, longitude, battery_level, gsm_signal, gps_valid, speed, received_at
            FROM locations
           WHERE device_id = d.id
             AND (latitude != 0 OR longitude != 0)
           ORDER BY received_at DESC LIMIT 1
        ) l ON true
       ORDER BY d.last_seen DESC NULLS LAST
    `);
    return result.rows;
  } catch (err) {
    logger.error('getDevices error', { error: (err as Error).message });
    return [];
  }
}

export async function getDevice(imei: string): Promise<unknown | null> {
  try {
    const db = getPool();
    const result = await db.query(
      `SELECT d.imei,
              COALESCE(p.full_name, d.full_name) AS full_name,
              COALESCE(p.full_name, d.full_name) AS display_name,
              d.iccid, d.imsi, d.firmware_version, d.last_seen, d.created_at,
              d.person_id,
              d.gps_interval_sec,
              p.full_name AS person_full_name,
              p.phone     AS person_phone,
              COALESCE(l.latitude,  d.last_lat)         AS latitude,
              COALESCE(l.longitude, d.last_lng)         AS longitude,
              COALESCE(l.battery_level, d.last_battery) AS battery,
              COALESCE(l.gsm_signal, d.last_gsm_signal) AS gsm_signal,
              l.gps_valid,
              l.speed,
              l.received_at AS last_location_at
         FROM devices d
         LEFT JOIN persons p ON p.id = d.person_id
         LEFT JOIN LATERAL (
           SELECT latitude, longitude, battery_level, gsm_signal, gps_valid, speed, received_at
             FROM locations
            WHERE device_id = d.id
              AND (latitude != 0 OR longitude != 0)
            ORDER BY received_at DESC LIMIT 1
         ) l ON true
        WHERE d.imei = $1`,
      [imei]
    );
    return result.rows[0] ?? null;
  } catch (err) {
    logger.error('getDevice error', { error: (err as Error).message, imei });
    return null;
  }
}

export async function getLocations(imei: string, limit = 100, offset = 0, from?: string, to?: string): Promise<unknown[]> {
  try {
    const db = getPool();
    const params: unknown[] = [imei];
    const conditions: string[] = ['d.imei = $1'];

    if (from) {
      params.push(new Date(from));
      conditions.push(`l.received_at >= $${params.length}`);
    }
    if (to) {
      params.push(new Date(to));
      conditions.push(`l.received_at <= $${params.length}`);
    }

    params.push(limit);
    params.push(offset);

    const result = await db.query(
      `SELECT l.id,
              d.imei,
              l.latitude, l.longitude, l.speed, l.gps_valid,
              l.gsm_signal,
              l.battery_level AS battery,
              l.working_mode::text AS work_mode,
              l.lbs_mcc::text AS mcc,
              l.lbs_mnc::text AS mnc,
              l.lbs_lac::text AS lac,
              l.lbs_cid::text AS cid,
              l.wifi_data,
              l.hybrid_lat, l.hybrid_lng,
              l.location_time,
              l.received_at AS created_at
         FROM locations l
         JOIN devices d ON d.id = l.device_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY l.received_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return result.rows;
  } catch {
    return [];
  }
}

export async function getAlarms(imei?: string, limit = 100): Promise<unknown[]> {
  try {
    const db = getPool();
    const alarmSql = `
      SELECT a.id,
             d.imei,
             COALESCE(p.full_name, d.full_name) AS full_name,
             LPAD(a.alarm_code::text, 2, '0') AS alarm_code,
             a.alarm_type::text AS alarm_name,
             a.latitude, a.longitude,
             a.alarm_time AS location_time,
             a.received_at AS created_at
        FROM alarms a
        JOIN devices d ON d.id = a.device_id
        LEFT JOIN persons p ON p.id = d.person_id`;

    if (imei) {
      const result = await db.query(
        `${alarmSql} WHERE d.imei = $1 ORDER BY a.received_at DESC LIMIT $2`,
        [imei, limit]
      );
      return result.rows;
    }
    const result = await db.query(
      `${alarmSql} ORDER BY a.received_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows;
  } catch (err) {
    logger.error('getAlarms error', { error: (err as Error).message });
    return [];
  }
}

export async function getHealthData(imei?: string, limit = 100): Promise<unknown[]> {
  try {
    const db = getPool();
    const healthSql = `
      SELECT h.id,
             d.imei,
             CASE h.health_type
               WHEN 'blood_pressure'   THEN 1
               WHEN 'heart_rate'       THEN 2
               WHEN 'body_temperature' THEN 3
               WHEN 'blood_oxygen'     THEN 4
               ELSE 0
             END AS type,
             h.health_type::text AS type_name,
             CASE h.health_type
               WHEN 'blood_pressure'   THEN CONCAT(h.diastolic_bp, '|', h.systolic_bp)
               WHEN 'heart_rate'       THEN h.heart_rate::text
               WHEN 'body_temperature' THEN h.body_temperature::text
               WHEN 'blood_oxygen'     THEN h.blood_oxygen::text
               ELSE ''
             END AS value,
             h.measured_at,
             h.received_at AS created_at
        FROM health_data h
        JOIN devices d ON d.id = h.device_id`;

    if (imei) {
      const result = await db.query(
        `${healthSql} WHERE d.imei = $1 ORDER BY h.received_at DESC LIMIT $2`,
        [imei, limit]
      );
      return result.rows;
    }
    const result = await db.query(
      `${healthSql} ORDER BY h.received_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows;
  } catch (err) {
    logger.error('getHealthData error', { error: (err as Error).message });
    return [];
  }
}

export async function getHeartbeats(imei: string, limit = 50): Promise<unknown[]> {
  try {
    const db = getPool();
    const result = await db.query(
      `SELECT h.id,
              d.imei,
              h.battery_level AS battery,
              h.gsm_signal,
              h.pedometer,
              h.received_at AS created_at
         FROM heartbeats h
         JOIN devices d ON d.id = h.device_id
        WHERE d.imei = $1
        ORDER BY h.received_at DESC LIMIT $2`,
      [imei, limit]
    );
    return result.rows;
  } catch (err) {
    logger.error('getHeartbeats error', { error: (err as Error).message });
    return [];
  }
}
