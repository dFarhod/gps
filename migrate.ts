import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'tracker_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

async function migrate() {
  const client = await pool.connect();
  console.log('Connected to database. Running migrations...');

  try {
    await client.query('BEGIN');

    // ── Enums ─────────────────────────────────────────────────────────────────
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE alarm_type AS ENUM (
          'no_alarm','sos','low_battery','device_removed','tamper_open','fall',
          'heart_rate_abnormal','heart_rate_high','heart_rate_low',
          'systolic_high','systolic_low','diastolic_high','diastolic_low',
          'sedentary','temp_high','temp_low','power_off',
          'geofence_exit','geofence_enter','unknown'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    console.log('✓ alarm_type enum');

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE health_type AS ENUM (
          'blood_pressure','heart_rate','body_temperature','blood_oxygen'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    console.log('✓ health_type enum');

    // ── persons ───────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS persons (
        id        SERIAL PRIMARY KEY,
        full_name VARCHAR(150) NOT NULL,
        phone     VARCHAR(30),
        notes     TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('✓ persons table');

    // ── devices ───────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        imei             VARCHAR(20) NOT NULL UNIQUE,
        iccid            VARCHAR(30),
        imsi             VARCHAR(16),
        firmware_version VARCHAR(50),
        full_name        VARCHAR(150),
        person_id        INTEGER REFERENCES persons(id) ON DELETE SET NULL,
        last_seen        TIMESTAMPTZ,
        last_lat         DOUBLE PRECISION,
        last_lng         DOUBLE PRECISION,
        last_battery     SMALLINT,
        last_gsm_signal  SMALLINT,
        created_at       TIMESTAMPTZ DEFAULT NOW(),
        updated_at       TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    // add new columns if upgrading from older schema
    await client.query(`ALTER TABLE devices ADD COLUMN IF NOT EXISTS full_name       VARCHAR(150)`);
    await client.query(`ALTER TABLE devices ADD COLUMN IF NOT EXISTS person_id       INTEGER REFERENCES persons(id) ON DELETE SET NULL`);
    await client.query(`ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_lat        DOUBLE PRECISION`);
    await client.query(`ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_lng        DOUBLE PRECISION`);
    await client.query(`ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_battery    SMALLINT`);
    await client.query(`ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_gsm_signal SMALLINT`);
    console.log('✓ devices table');

    // ── locations ─────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS locations (
        id            BIGSERIAL PRIMARY KEY,
        device_id     UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        latitude      DOUBLE PRECISION,
        longitude     DOUBLE PRECISION,
        speed         DOUBLE PRECISION,
        gps_valid     BOOLEAN,
        gsm_signal    SMALLINT,
        battery_level SMALLINT,
        working_mode  SMALLINT,
        lbs_mcc       INTEGER,
        lbs_mnc       INTEGER,
        lbs_lac       INTEGER,
        lbs_cid       INTEGER,
        wifi_data     JSONB,
        hybrid_lat    DOUBLE PRECISION,
        hybrid_lng    DOUBLE PRECISION,
        location_time TIMESTAMPTZ,
        source        VARCHAR(20),
        received_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_locations_device_id   ON locations(device_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_locations_received_at ON locations(received_at DESC)`);
    console.log('✓ locations table');

    // ── alarms ────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS alarms (
        id          BIGSERIAL PRIMARY KEY,
        device_id   UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        alarm_code  INTEGER,
        alarm_type  alarm_type,
        latitude    DOUBLE PRECISION,
        longitude   DOUBLE PRECISION,
        alarm_time  TIMESTAMPTZ,
        received_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_alarms_device_id   ON alarms(device_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_alarms_received_at ON alarms(received_at DESC)`);
    console.log('✓ alarms table');

    // ── health_data ───────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS health_data (
        id               BIGSERIAL PRIMARY KEY,
        device_id        UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        health_type      health_type,
        heart_rate       SMALLINT,
        diastolic_bp     SMALLINT,
        systolic_bp      SMALLINT,
        body_temperature DOUBLE PRECISION,
        blood_oxygen     SMALLINT,
        measured_at      TIMESTAMPTZ,
        received_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_health_data_device_id ON health_data(device_id)`);
    console.log('✓ health_data table');

    // ── heartbeats ────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS heartbeats (
        id            BIGSERIAL PRIMARY KEY,
        device_id     UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        battery_level SMALLINT,
        gsm_signal    SMALLINT,
        pedometer     INTEGER,
        received_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_heartbeats_device_id ON heartbeats(device_id)`);
    console.log('✓ heartbeats table');

    // ── wearing_events ────────────────────────────────────────────────────────
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
    await client.query(`CREATE INDEX IF NOT EXISTS idx_wearing_events_imei       ON wearing_events(imei)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_wearing_events_created_at ON wearing_events(created_at DESC)`);
    console.log('✓ wearing_events table');

    await client.query('COMMIT');
    console.log('\n✅ Migration completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
