# IW Protocol TCP Server (Thinkrace V3.03)

A production-ready Node.js/TypeScript TCP server for receiving data from GPS trackers and smartwatches using the IW Protocol.

## Features

- Full IW Protocol implementation (AP00, AP01, AP03, AP10, AP42, APBL, APJK, APVR, APWR, APFD)
- PostgreSQL persistence with auto schema creation
- Buffer management for chunked TCP data
- 30-second idle connection timeout
- Graceful shutdown (SIGTERM/SIGINT)
- Winston structured logging with file rotation
- Never crashes on malformed packets

## Requirements

- Node.js 18+
- PostgreSQL 13+ (or skip DB — server logs a warning and continues)
- TypeScript 5.3+

## Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env   # or edit .env directly

# Create PostgreSQL database
createdb tracker_db

# Build
npm run build

# Start production server
npm start

# Development mode (auto-restart on changes)
npm run dev
```

## Environment Variables

| Variable              | Default           | Description                              |
|-----------------------|-------------------|------------------------------------------|
| `TCP_PORT`            | `4500`            | TCP server port                          |
| `DB_HOST`             | `localhost`       | PostgreSQL host                          |
| `DB_PORT`             | `5432`            | PostgreSQL port                          |
| `DB_NAME`             | `tracker_db`      | Database name                            |
| `DB_USER`             | `postgres`        | Database user                            |
| `DB_PASSWORD`         | `password`        | Database password                        |
| `TIMEZONE`            | `8`               | Server timezone offset sent in BP00      |
| `TIMEZONE_AREA`       | `Asia/Tashkent`   | Timezone area string sent in BP00        |
| `NETWORK_TRACKING_KEY`| `your-key-here`   | Network tracking key sent in BP00        |
| `LOG_LEVEL`           | `info`            | Winston log level (debug/info/warn/error)|

## Protocol Reference

### Packet Structure

```
[IW][COMMAND_ID][PAYLOAD]#
```

- Header: `IW`
- Terminator: `#`
- Encoding: UTF-8 (Chinese addresses use UNICODE HEX)

### Uplink Packets (Device → Server)

#### AP00 — Login

```
IWAP00{IMEI},{ICCID},{IMSI}DCX#
```

Example:
```
IWAP00868888031082345,89860617840074615172,460017141050094DCX#
```

Response:
```
IWBP00,20240406123000,+8,Asia/Tashkent,your-key-here#
```

#### AP01 — Location

```
IWAP01{DDMMYY}{A|V}{DDMM.MMMM}{N|S}{DDDMM.MMMM}{E|W}{speed}{HHmmss}{direction}{status8hex},{mcc},{mnc},{lac},{cid},{wifi},[hybrid]#
```

Example:
```
IWAP01060424A2232.9806N11408.0412E000.0120054512200 1F0000,460,01,3A2B,1C4D,HomeWifi|AA:BB:CC|−65#
```

Response: `IWBP01#`

- **GPS valid**: `A`=valid, `V`=invalid
- **Lat/Lng**: NMEA format → decimal: `DDMM.MMMM` → `DD + MM.MMMM/60`
- **Status** (8 hex chars = 4 bytes): `[gsm_signal][gps_sats][battery][work_mode]`
- **WiFi**: `SSID|MAC|signal` semicolon-separated
- **Hybrid**: `lat|lng` for hybrid positioning result

#### AP03 — Heartbeat

```
IWAP03,{status},{pedometer},{rollsFrequency}[,{mode},{interval}]#
```

Status (hex string): `[gsm][gps_sats][battery][reserved][fort_state][work_mode]`

Response: `IWBP03#`

#### AP10 — Alarm

```
IWAP10{location_block},{mcc},{mnc},{lac},{cid},{alarm_code},{language},{response_flag},{wifi}#
```

Location block format is identical to AP01.

| Alarm Code | Name                    |
|------------|-------------------------|
| `00`       | None                    |
| `01`       | SOS                     |
| `02`       | Low battery             |
| `03`       | Take off                |
| `05`       | Tamper                  |
| `06`       | Fall                    |
| `07`       | Heart rate abnormal     |
| `08`       | High heart rate         |
| `09`       | Low heart rate          |
| `10`       | High systolic BP        |
| `14`       | Sedentary               |
| `19`       | Power OFF               |
| `20`       | Out of geofence         |
| `21`       | Enter geofence          |

Response: `IWBP10#` or `IWBP10{UNICODE_HEX_ADDRESS}#`

#### APJK — Health Data

```
IWAPJK,{YYYYMMDDHHmmss},{type},{value}#
```

| Type | Name             | Value format       |
|------|------------------|--------------------|
| `1`  | Blood pressure   | `diastolic|systolic` |
| `2`  | Heart rate       | BPM number         |
| `3`  | Body temperature | Degrees (e.g. 36.5)|
| `4`  | Blood oxygen     | SpO2 %             |

Response: `IWBPJK,{type}#`

#### APBL — BLE Data

```
IWAPBL,{imei},{MAC|RSSI|Name;...},{own_mac},{timestamp}#
```

Response: `IWBPBL#`

#### APVR — Firmware Version

```
IWAPVR,{imei},{version}#
```

No response.

#### APWR — Wearing Status

```
IWAPWR,{imei},{status},{timestamp}#
```

`status`: `1`=wearing, `0`=removed. No response.

#### APFD — Fall Alarm

```
IWAPFD,{imei},{timestamp}#
```

Response: `IWBPFD#`

#### AP42 — Picture Upload

```
IWAP42{imei},{base64_data}#
```

Response: `IWBP42#`

## Database Schema

```sql
-- Device registry
devices (imei PK, iccid, imsi, firmware_version, last_seen, created_at)

-- Location history
locations (id, imei, latitude, longitude, speed, gps_valid, gsm_signal,
           battery, work_mode, mcc, mnc, lac, cid, wifi_data jsonb,
           hybrid_lat, hybrid_lng, location_time, created_at)

-- Alarm events
alarms (id, imei, alarm_code, alarm_name, latitude, longitude,
        location_time, created_at)

-- Health measurements
health_data (id, imei, type, type_name, value, measured_at, created_at)

-- Heartbeat log
heartbeats (id, imei, battery, gsm_signal, pedometer, created_at)
```

## Project Structure

```
src/
  server.ts          - TCP server, connection lifecycle, graceful shutdown
  parser.ts          - Packet extraction, command routing, buffer management
  types.ts           - TypeScript interfaces and constants
  responses.ts       - BP downlink response builders
  logger.ts          - Winston logger configuration
  db.ts              - PostgreSQL connection pool and queries
  handlers/
    ap00.ts          - Login handler
    ap01.ts          - Location handler
    ap03.ts          - Heartbeat handler
    ap10.ts          - Alarm handler
    ap42.ts          - Picture upload handler
    apbl.ts          - BLE data handler
    apjk.ts          - Health data handler
    apvr.ts          - Firmware version handler
    apwr.ts          - Wearing status handler
    apfd.ts          - Fall alarm handler
logs/
  combined.log       - All log output (rotated at 10MB, max 10 files)
  error.log          - Error-level logs only (rotated at 10MB, max 5 files)
```

## Testing with netcat

```bash
# Simulate a device login
echo -n "IWAP00868888031082345,89860617840074615172,460017141050094DCX#" | nc localhost 4500

# Simulate a heartbeat
echo -n "IWAP03,1F0A640001,00012345,0000#" | nc localhost 4500

# Simulate a location
echo -n "IWAP01060424A2232.9806N11408.0412E000.0120054122001F0000,460,01,3A2B,1C4D,#" | nc localhost 4500

# Simulate an SOS alarm
echo -n "IWAP10060424A2232.9806N11408.0412E000.0120054122001F0000,460,01,3A2B,1C4D,01,1,0,#" | nc localhost 4500
```
# gps
