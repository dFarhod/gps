import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { LiveMap } from './pages/LiveMap';
import { Devices } from './pages/Devices';
import { DeviceDetail } from './pages/DeviceDetail';
import { Alarms } from './pages/Alarms';
import { HealthData } from './pages/HealthData';
import { Persons } from './pages/Persons';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/"              element={<Dashboard />} />
            <Route path="/map"           element={<LiveMap />} />
            <Route path="/devices"       element={<Devices />} />
            <Route path="/devices/:imei" element={<DeviceDetail />} />
            <Route path="/alarms"        element={<Alarms />} />
            <Route path="/health"        element={<HealthData />} />
            <Route path="/persons"       element={<Persons />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
