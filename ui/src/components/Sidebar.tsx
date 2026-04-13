import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Map,
  Smartphone,
  Bell,
  Heart,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

const navItems = [
  { to: '/',        icon: LayoutDashboard, label: 'Dashboard'    },
  { to: '/map',     icon: Map,             label: 'Jonli Xarita' },
  { to: '/devices', icon: Smartphone,      label: 'Qurilmalar'   },
  { to: '/persons', icon: Users,           label: 'Shaxslar'     },
  { to: '/alarms',  icon: Bell,            label: 'Alarmlar'     },
  { to: '/health',  icon: Heart,           label: "Sog'liq"      },
];

export function Sidebar() {
  const { state } = useApp();

  return (
    <aside className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
            <Map size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-100">GPS Tracker</p>
            <p className="text-xs text-slate-500">IW Protocol v3.03</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Status */}
      <div className="px-4 py-4 border-t border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">WebSocket</span>
          <span className={`flex items-center gap-1 font-medium ${state.connected ? 'text-emerald-400' : 'text-red-400'}`}>
            {state.connected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {state.connected ? 'Ulangan' : 'Uzilgan'}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">TCP ulanishlar</span>
          <span className="text-slate-300 font-mono">{state.activeConnections}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Online qurilmalar</span>
          <span className="text-emerald-400 font-mono">{state.stats.onlineDevices}</span>
        </div>
      </div>
    </aside>
  );
}
