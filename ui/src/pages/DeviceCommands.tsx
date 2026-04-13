import { useState } from 'react';
import {
  MapPin, RotateCcw, Power, Camera, Heart, Activity, Wind,
  Clock, Settings, Bell, Bluetooth, Watch, AlertTriangle,
  Zap, ChevronDown, ChevronUp, Send, Navigation, NavigationOff, Wifi, WifiOff,
} from 'lucide-react';

interface Props { imei: string; connected: boolean }

type CommandStatus = { loading: boolean; result: string | null; error: string | null };

const initialStatus: CommandStatus = { loading: false, result: null, error: null };

async function sendCmd(imei: string, cmd: string, params: Record<string, unknown> = {}) {
  const res = await fetch(`/api/devices/${imei}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cmd, params }),
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) throw new Error((data.error as string) || 'Xato');
  return data;
}

function CmdButton({
  label, icon: Icon, cmd, params, disabled, color = 'emerald', confirm,
  onResult,
}: {
  label: string;
  icon: typeof MapPin;
  cmd: string;
  params?: Record<string, unknown>;
  disabled: boolean;
  color?: string;
  confirm?: string;
  onResult: (msg: string, isError: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (confirm && !window.confirm(confirm)) return;
    setLoading(true);
    try {
      await sendCmd((params as { _imei?: string })._imei ?? '', cmd, params);
      onResult(`${label} — yuborildi ✓`, false);
    } catch (e) {
      onResult((e as Error).message, true);
    } finally {
      setLoading(false);
    }
  };

  const colorCls: Record<string, string> = {
    emerald: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25',
    blue:    'bg-blue-500/15 border-blue-500/30 text-blue-400 hover:bg-blue-500/25',
    red:     'bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25',
    amber:   'bg-amber-500/15 border-amber-500/30 text-amber-400 hover:bg-amber-500/25',
    purple:  'bg-purple-500/15 border-purple-500/30 text-purple-400 hover:bg-purple-500/25',
    pink:    'bg-pink-500/15 border-pink-500/30 text-pink-400 hover:bg-pink-500/25',
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${colorCls[color] ?? colorCls.emerald}`}
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <Icon size={16} />
      )}
      {label}
    </button>
  );
}

export function DeviceCommands({ imei, connected }: Props) {
  const [status, setStatus] = useState<CommandStatus>(initialStatus);
  const [intervalVal, setIntervalVal] = useState('60');
  const [gpsInterval, setGpsInterval] = useState('60');
  const [healthMin, setHealthMin] = useState('10');
  const [sos1, setSos1] = useState('');
  const [sos2, setSos2] = useState('');
  const [sos3, setSos3] = useState('');
  const [sedSec, setSedSec] = useState('300');
  const [msgText, setMsgText] = useState('');
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPass, setWifiPass] = useState('');
  const [wifiEnc, setWifiEnc] = useState('psk');
  const [rawCmd, setRawCmd] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const onResult = (msg: string, isError: boolean) => {
    setStatus({ loading: false, result: isError ? null : msg, error: isError ? msg : null });
    setTimeout(() => setStatus(initialStatus), 4000);
  };

  const btn = (cmd: string, params?: Record<string, unknown>) => ({ cmd, params: { ...params }, _imei: imei });

  if (!connected) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
        <AlertTriangle size={32} className="mx-auto mb-3 text-amber-400" />
        <p className="text-slate-300 font-medium">Qurilma offline</p>
        <p className="text-slate-500 text-sm mt-1">Komandalar yuborish uchun qurilma ulanishi kerak</p>
      </div>
    );
  }

  const disabled = !connected;

  return (
    <div className="space-y-5">
      {/* Status */}
      {(status.result || status.error) && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium border ${
          status.error
            ? 'bg-red-500/10 border-red-500/30 text-red-400'
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
        }`}>
          {status.result ?? status.error}
        </div>
      )}

      {/* GPS */}
      <div className="bg-slate-800 border border-emerald-900/40 rounded-xl p-5">
        <h3 className="font-semibold text-slate-200 mb-1 flex items-center gap-2">
          <Navigation size={16} className="text-emerald-400" /> GPS boshqaruv
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          GPS yoqilganda qurilma GPS signalini qidiradi (90s), topilmasa WiFi/LBS ishlatadi.
        </p>
        <div className="flex flex-wrap gap-3 mb-4">
          <CmdButton
            label="GPS Yoq (Mode 8)"
            icon={Navigation}
            cmd="gps_on"
            disabled={disabled}
            color="emerald"
            onResult={onResult}
            params={{ _imei: imei, mode: 8, interval: Number(gpsInterval) }}
          />
          <CmdButton
            label="GPS O'chir"
            icon={NavigationOff}
            cmd="gps_off"
            disabled={disabled}
            color="amber"
            onResult={onResult}
            params={{ _imei: imei, mode: 8, interval: Number(gpsInterval) }}
          />
          <CmdButton
            label="Hozir lokatsiya so'ra"
            icon={MapPin}
            cmd="location"
            disabled={disabled}
            color="blue"
            onResult={onResult}
            params={{ _imei: imei }}
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="text-xs text-slate-500 mb-1 block">GPS yuklash intervali (soniya)</label>
            <input
              type="number" min="10" max="3600"
              value={gpsInterval}
              onChange={e => setGpsInterval(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <button
            onClick={async () => {
              try {
                await sendCmd(imei, 'gps_on', { mode: 8, interval: Number(gpsInterval) });
                onResult(`GPS yoqildi, interval ${gpsInterval}s ✓`, false);
              } catch(e) { onResult((e as Error).message, true); }
            }}
            disabled={disabled}
            className="mt-5 flex items-center gap-2 px-4 py-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/25 disabled:opacity-40"
          >
            <Navigation size={14} /> GPS yoq + Sozla
          </button>
        </div>
      </div>

      {/* Lokatsiya interval */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <MapPin size={16} className="text-blue-400" /> Lokatsiya intervali (BP15)
        </h3>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="text-xs text-slate-500 mb-1 block">Interval (soniya)</label>
            <input
              type="number" min="10" max="3600"
              value={intervalVal}
              onChange={e => setIntervalVal(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <button
            onClick={async () => {
              try {
                await sendCmd(imei, 'interval', { seconds: Number(intervalVal) });
                onResult(`Interval ${intervalVal}s ga o'rnatildi ✓`, false);
              } catch(e) { onResult((e as Error).message, true); }
            }}
            disabled={disabled}
            className="mt-5 flex items-center gap-2 px-4 py-2 bg-blue-500/15 border border-blue-500/30 text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-500/25 disabled:opacity-40"
          >
            <Clock size={14} /> Sozla
          </button>
        </div>
      </div>

      {/* Sog'liq o'lchash */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <Heart size={16} className="text-pink-400" /> Sog'liq o'lchash
        </h3>
        <div className="flex flex-wrap gap-3">
          <CmdButton label="Yurak urishi" icon={Heart} cmd="heartrate" disabled={disabled} color="pink" onResult={onResult} params={{ _imei: imei }} />
          <CmdButton label="Qon bosimi" icon={Activity} cmd="bloodpressure" disabled={disabled} color="red" onResult={onResult} params={{ _imei: imei }} />
          <CmdButton label="Qon kislorodi" icon={Wind} cmd="bloodoxygen" disabled={disabled} color="blue" onResult={onResult} params={{ _imei: imei }} />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1">
            <label className="text-xs text-slate-500 mb-1 block">Avtomatik o&apos;lchash (daqiqa)</label>
            <input
              type="number" min="1" max="60"
              value={healthMin}
              onChange={e => setHealthMin(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <button
            onClick={async () => {
              try {
                await sendCmd(imei, 'healthmonitor', { enable: true, minutes: Number(healthMin) });
                onResult(`Sog'liq monitoring ${healthMin} daqiqaga o'rnatildi ✓`, false);
              } catch(e) { onResult((e as Error).message, true); }
            }}
            disabled={disabled}
            className="mt-5 flex items-center gap-2 px-4 py-2 bg-purple-500/15 border border-purple-500/30 text-purple-400 rounded-lg text-sm font-medium hover:bg-purple-500/25 disabled:opacity-40"
          >
            <Settings size={14} /> Sozla
          </button>
        </div>
      </div>

      {/* Rasm */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <Camera size={16} className="text-amber-400" /> Kamera
        </h3>
        <div className="flex flex-wrap gap-3">
          <CmdButton label="Rasm ol" icon={Camera} cmd="photo" disabled={disabled} color="amber" onResult={onResult} params={{ _imei: imei }} />
        </div>
      </div>

      {/* Xabar yuborish */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <Send size={16} className="text-emerald-400" /> Qurilmaga matn yuborish
        </h3>
        <textarea
          rows={3}
          placeholder="Qurilmaga yuboriladigan matn..."
          value={msgText}
          onChange={e => setMsgText(e.target.value)}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none mb-3"
        />
        <button
          onClick={async () => {
            try {
              await sendCmd(imei, 'message', { text: msgText });
              onResult('Matn yuborildi \u2713', false);
              setMsgText('');
            } catch(e) { onResult((e as Error).message, true); }
          }}
          disabled={disabled || !msgText.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/25 disabled:opacity-40"
        >
          <Send size={14} /> Yuborish
        </button>
      </div>

      {/* WiFi */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <Wifi size={16} className="text-blue-400" /> WiFi boshqaruv
        </h3>
        <div className="flex flex-wrap gap-3 mb-4">
          <CmdButton label="WiFi Yoq" icon={Wifi} cmd="wifi_on" disabled={disabled} color="blue" onResult={onResult} params={{ _imei: imei }} />
          <CmdButton label="WiFi O'chir" icon={WifiOff} cmd="wifi_off" disabled={disabled} color="amber" onResult={onResult} params={{ _imei: imei }} />
          <CmdButton label="WiFi Reset" icon={WifiOff} cmd="wifi_reset" disabled={disabled} color="red" onResult={onResult} params={{ _imei: imei }} />
        </div>
        <div className="space-y-2 mb-3">
          <input
            type="text" placeholder="WiFi nomi (SSID)"
            value={wifiSsid} onChange={e => setWifiSsid(e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          <input
            type="text" placeholder="Parol"
            value={wifiPass} onChange={e => setWifiPass(e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          <select
            value={wifiEnc} onChange={e => setWifiEnc(e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="psk">WPA/WPA2 (psk)</option>
            <option value="aes">WPA2-AES (aes)</option>
            <option value="wep">WEP</option>
            <option value="none">Ochiq (none)</option>
          </select>
        </div>
        <button
          onClick={async () => {
            try {
              await sendCmd(imei, 'wifi_connect', { ssid: wifiSsid, password: wifiPass, encrypt: wifiEnc });
              onResult(`WiFi ulanish yuborildi: ${wifiSsid} \u2713`, false);
            } catch(e) { onResult((e as Error).message, true); }
          }}
          disabled={disabled || !wifiSsid.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500/15 border border-blue-500/30 text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-500/25 disabled:opacity-40"
        >
          <Wifi size={14} /> WiFiga ulash
        </button>
      </div>

      {/* Alarm */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <Bell size={16} className="text-red-400" /> Alarm sozlamalari
        </h3>
        <div className="flex flex-wrap gap-3 mb-4">
          <CmdButton label="Yiqilish ON" icon={AlertTriangle} cmd="fall_on" disabled={disabled} color="red" onResult={onResult} params={{ _imei: imei }} />
          <CmdButton label="Yiqilish OFF" icon={AlertTriangle} cmd="fall_off" disabled={disabled} color="amber" onResult={onResult} params={{ _imei: imei }} />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="text-xs text-slate-500 mb-1 block">Ko&apos;p o&apos;tirish chegarasi (soniya)</label>
            <input
              type="number" min="300" step="60"
              value={sedSec}
              onChange={e => setSedSec(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <button
            onClick={async () => {
              try {
                await sendCmd(imei, 'sedentary', { seconds: Number(sedSec) });
                onResult(`Ko'p o'tirish ${sedSec}s ga o'rnatildi ✓`, false);
              } catch(e) { onResult((e as Error).message, true); }
            }}
            disabled={disabled}
            className="mt-5 flex items-center gap-2 px-4 py-2 bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded-lg text-sm font-medium hover:bg-amber-500/25 disabled:opacity-40"
          >
            <Clock size={14} /> Sozla
          </button>
        </div>
      </div>

      {/* SOS raqamlari */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <Bell size={16} className="text-red-400" /> SOS raqamlar
        </h3>
        <div className="space-y-2 mb-3">
          {[{ val: sos1, set: setSos1, label: 'SOS 1' }, { val: sos2, set: setSos2, label: 'SOS 2' }, { val: sos3, set: setSos3, label: 'SOS 3' }].map(({ val, set, label }) => (
            <input key={label} type="tel" placeholder={label} value={val} onChange={e => set(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500" />
          ))}
        </div>
        <button
          onClick={async () => {
            try {
              await sendCmd(imei, 'sos', { sos1, sos2, sos3 });
              onResult("SOS raqamlar o'rnatildi \u2713", false);
            } catch(e) { onResult((e as Error).message, true); }
          }}
          disabled={disabled || !sos1}
          className="flex items-center gap-2 px-4 py-2 bg-red-500/15 border border-red-500/30 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/25 disabled:opacity-40"
        >
          <Send size={14} /> SOS o&apos;rnating
        </button>
      </div>

      {/* Bluetooth */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <Bluetooth size={16} className="text-blue-400" /> Bluetooth
        </h3>
        <div className="flex flex-wrap gap-3">
          <CmdButton label="BLE yoq (1 soat)" icon={Bluetooth} cmd="ble_on" disabled={disabled} color="blue" onResult={onResult} params={{ _imei: imei, seconds: 3600 }} />
          <CmdButton label="BLE o'chir" icon={Bluetooth} cmd="ble_off" disabled={disabled} color="amber" onResult={onResult} params={{ _imei: imei }} />
        </div>
      </div>

      {/* Kiyish */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <Watch size={16} className="text-emerald-400" /> Kiyish aniqlash
        </h3>
        <div className="flex flex-wrap gap-3">
          <CmdButton label="Kiyish aniqlash ON" icon={Watch} cmd="wear_on" disabled={disabled} color="emerald" onResult={onResult} params={{ _imei: imei }} />
          <CmdButton label="Kiyish aniqlash OFF" icon={Watch} cmd="wear_off" disabled={disabled} color="amber" onResult={onResult} params={{ _imei: imei }} />
        </div>
      </div>

      {/* Xavfli amallar */}
      <div className="bg-slate-800 border border-red-900/30 rounded-xl p-5">
        <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <Zap size={16} className="text-red-400" /> Qurilmani boshqarish
        </h3>
        <div className="flex flex-wrap gap-3">
          <CmdButton label="Qayta ishga tushur" icon={RotateCcw} cmd="restart" disabled={disabled} color="amber"
            confirm="Qurilmani qayta ishga tushirasizmi?" onResult={onResult} params={{ _imei: imei }} />
          <CmdButton label="O'chirish" icon={Power} cmd="poweroff" disabled={disabled} color="red"
            confirm="Qurilmani o'chirasizmi?" onResult={onResult} params={{ _imei: imei }} />
        </div>
      </div>

      {/* Advanced / raw commands */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between px-5 py-4 text-sm font-medium text-slate-400 hover:text-slate-200"
        >
          <span>Qo&apos;shimcha (raw BP40 komandalar)</span>
          {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {showAdvanced && (
          <div className="px-5 pb-5 space-y-3 border-t border-slate-700">
            <p className="text-xs text-slate-500 mt-3">
              BP40 formati: <code className="text-slate-300">{'>'}*fall@1*{'<'}</code>, <code className="text-slate-300">{'>'}*ble@3600*{'<'}</code>, va h.k.
            </p>
            <input
              type="text"
              placeholder=">*fall@1*<"
              value={rawCmd}
              onChange={e => setRawCmd(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={async () => {
                try {
                  await sendCmd(imei, 'raw_bp40', { command: rawCmd });
                  onResult(`BP40 yuborildi: ${rawCmd} ✓`, false);
                  setRawCmd('');
                } catch(e) { onResult((e as Error).message, true); }
              }}
              disabled={disabled || !rawCmd}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 border border-slate-600 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600 disabled:opacity-40"
            >
              <Send size={14} /> Yuborish
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
