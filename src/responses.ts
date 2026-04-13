/**
 * BP Response builders — server→device downlink packets
 * All packets start with "IW" and end with "#"
 *
 * Command serial numbers are 6-digit strings (random or sequential).
 */

let serialCounter = 100000;
export function nextSerial(): string {
  serialCounter = (serialCounter % 999999) + 1;
  return String(serialCounter).padStart(6, '0');
}

/** Encode ASCII/Latin string to uppercase hex (used for BP40 content) */
export function toGB2312Hex(str: string): string {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    result += str.charCodeAt(i).toString(16).padStart(2, '0').toUpperCase();
  }
  return result;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDatetime(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    pad2(d.getUTCMonth() + 1) +
    pad2(d.getUTCDate()) +
    pad2(d.getUTCHours()) +
    pad2(d.getUTCMinutes()) +
    pad2(d.getUTCSeconds())
  );
}

/**
 * BP00 — Login response
 * Format: IWBP00,{datetime},{timezone},{timezone_area},{network_key}#
 */
export function buildBP00(
  timezone: number,
  timezoneArea: string,
  networkKey: string
): string {
  const dt = formatDatetime(new Date());
  return `IWBP00,${dt},${timezone},${timezoneArea},${networkKey}#`;
}

/**
 * BP01 — Location acknowledgment
 */
export function buildBP01(): string {
  return 'IWBP01#';
}

/**
 * BP03 — Heartbeat acknowledgment
 */
export function buildBP03(): string {
  return 'IWBP03#';
}

/**
 * BP10 — Alarm acknowledgment
 * If address is provided it must be UNICODE HEX encoded
 */
export function buildBP10(address?: string): string {
  if (address) {
    const unicodeHex = encodeAddressToUnicodeHex(address);
    return `IWBP10${unicodeHex}#`;
  }
  return 'IWBP10#';
}

/**
 * BPJK — Health data acknowledgment
 * Format: IWBPJK,{type}#
 */
export function buildBPJK(type: number): string {
  return `IWBPJK,${type}#`;
}

/**
 * BPBL — BLE data acknowledgment
 */
export function buildBPBL(): string {
  return 'IWBPBL#';
}

/**
 * BPFD — Fall alarm acknowledgment
 */
export function buildBPFD(): string {
  return 'IWBPFD#';
}

/**
 * Encode a string to Unicode hex representation used by the protocol.
 * Each character is represented as its Unicode code point in 4-digit hex.
 */
function encodeAddressToUnicodeHex(str: string): string {
  let result = '';
  for (const char of str) {
    const code = char.codePointAt(0) ?? 0;
    result += code.toString(16).padStart(4, '0').toUpperCase();
  }
  return result;
}

// ── Downlink command builders (server → device) ────────────────────────────────

/** BP12 — Configure SOS numbers */
export function buildBP12(imei: string, sos1: string, sos2 = '', sos3 = ''): string {
  return `IWBP12,${imei},${nextSerial()},${sos1},${sos2},${sos3}#`;
}

/** BP14 — Configure whitelist (up to 10 contacts: "Name|Number") */
export function buildBP14(imei: string, contacts: string[]): string {
  const padded = [...contacts, ...Array(10).fill('')].slice(0, 10);
  return `IWBP14,${imei},${nextSerial()},${padded.join(',')}#`;
}

/** BP15 — Set location upload interval (seconds) */
export function buildBP15(imei: string, intervalSec: number): string {
  return `IWBP15,${imei},${nextSerial()},${intervalSec}#`;
}

/** BP16 — Request real-time location now */
export function buildBP16(imei: string): string {
  return `IWBP16,${imei},${nextSerial()}#`;
}

/** BP17 — Factory reset */
export function buildBP17(imei: string): string {
  return `IWBP17,${imei},${nextSerial()}#`;
}

/** BP18 — Restart device */
export function buildBP18(imei: string): string {
  return `IWBP18,${imei},${nextSerial()}#`;
}

/** BP19 — Configure server address */
export function buildBP19(imei: string, host: string, port: number): string {
  const isDomain = isNaN(parseInt(host.split('.')[0]));
  return `IWBP19,${imei},${nextSerial()},${isDomain ? 1 : 0},${host},${port}#`;
}

/** BP31 — Power off */
export function buildBP31(imei: string): string {
  return `IWBP31,${imei},${nextSerial()}#`;
}

/**
 * BP34 — Location working mode
 * mode: 8 = GPS priority over WiFi (recommended)
 * intervalSec: upload interval in seconds
 * gpsOn: 1=open GPS, 0=close
 */
export function buildBP34(imei: string, mode = 8, intervalSec = 60, gpsOn = 1): string {
  return `IWBP34,${imei},${nextSerial()},${mode},${intervalSec},${gpsOn}#`;
}

/**
 * BP40 — Issue shortcut command (GB2312 hex encoded)
 * command: raw string like ">*fall@1*<"
 */
export function buildBP40(imei: string, command: string): string {
  const hex = toGB2312Hex(command);
  return `IWBP40,${imei},${nextSerial()},${hex}#`;
}

/** BP42 — Picture packet acknowledgment */
export function buildBP42(time: string, total: number, current: number, success: boolean): string {
  return `IWBP42,${time},${total},${current},${success ? 1 : 0}#`;
}

/** BP46 — Take picture command */
export function buildBP46(imei: string): string {
  return `IWBP46,${imei},${nextSerial()},1#`;
}

/** BP84 — Whitelist switch (1=on, 0=off) */
export function buildBP84(imei: string, enable: boolean): string {
  return `IWBP84,${imei},${nextSerial()},${enable ? 1 : 0}#`;
}

/** BP86 — Health monitoring interval (minutes) */
export function buildBP86(imei: string, enable: boolean, intervalMin: number): string {
  return `IWBP86,${imei},${nextSerial()},${enable ? 1 : 0},${intervalMin}#`;
}

/** BPMC — Motion detection switch */
export function buildBPMC(imei: string, flag: 0 | 1 | 2): string {
  return `IWBPMC,${imei},${nextSerial()},${flag}#`;
}

/** BPPH — Phone call switch */
export function buildBPPH(imei: string, enable: boolean): string {
  return `IWBPPH,${imei},${nextSerial()},${enable ? 1 : 0}#`;
}

/** BPSM — GPRS command wrapper (content is raw @...@ formatted command) */
export function buildBPSM(imei: string, content: string): string {
  return `IWBPSM,${imei},${nextSerial()},${content}#`;
}

/** BPXL — Detect heart rate now */
export function buildBPXL(imei: string): string {
  return `IWBPXL,${imei},${nextSerial()}#`;
}

/** BPXY — Detect blood pressure now */
export function buildBPXY(imei: string): string {
  return `IWBPXY,${imei},${nextSerial()}#`;
}

/** BPXZ — Detect blood oxygen now */
export function buildBPXZ(imei: string): string {
  return `IWBPXZ,${imei},${nextSerial()}#`;
}

// ── Convenience BP40 shortcuts ─────────────────────────────────────────────────

export const bp40 = {
  fallOn:     (imei: string) => buildBP40(imei, '>*fall@1*<'),
  fallOff:    (imei: string) => buildBP40(imei, '>*fall@0*<'),
  bleOn:      (imei: string, secs = 3600) => buildBP40(imei, `>*ble@${secs}*<`),
  bleOff:     (imei: string) => buildBP40(imei, '>*ble@0*<'),
  wearOn:     (imei: string) => buildBP40(imei, '>*wearconfig@1*<'),
  wearOff:    (imei: string) => buildBP40(imei, '>*wearconfig@0*<'),
  photo:      (imei: string) => buildBP40(imei, '>*photo@1*<'),
  setTitle:   (imei: string, name: string) => buildBP40(imei, `>*settitle@${name}*<`),
  sedentary:  (imei: string, secs: number) => buildBP40(imei, `>*still@${secs}*<`),
  returnHome: (imei: string, secs: number) => buildBP40(imei, `>*returnhome@${secs}*<`),
  networkLoc: (imei: string, on: boolean) => buildBP40(imei, `>*networkloc@${on ? 1 : 0}*<`),
};
