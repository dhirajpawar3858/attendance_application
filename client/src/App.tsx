import { Routes, Route, Navigate } from 'react-router-dom';
import { useApp } from './state/AppState.tsx';
import { Loading } from './components/ui.tsx';
import Layout from './components/Layout.tsx';
import Auth from './pages/Auth.tsx';
import Onboarding from './pages/Onboarding.tsx';
import Dashboard from './pages/Dashboard.tsx';
import Attendance from './pages/Attendance.tsx';
import Members from './pages/Members.tsx';
import Calendar from './pages/Calendar.tsx';
import Reports from './pages/Reports.tsx';
import Organisation from './pages/Organisation.tsx';
import Settings from './pages/Settings.tsx';

export default function App() {
  const { user, loading, orgs, currentOrg } = useApp();

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
        <Loading label="Starting up…" />
      </div>
    );
  }

  if (!user) return <Auth />;

  // logged in but no organisation yet → onboarding
  if (orgs.length === 0 || !currentOrg) {
    return <Onboarding />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/members" element={<Members />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/organisation" element={<Organisation />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
