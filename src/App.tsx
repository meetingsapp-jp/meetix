import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Layout from './components/Layout';
import { useAuth } from './auth/AuthContext';
import Button from './components/ui/Button';
import LoginPage from './features/auth/LoginPage';
import ResetPasswordPage from './features/auth/ResetPasswordPage';
import Spinner from './components/ui/Spinner';

// Route-level code splitting: only the page the user is actually on gets
// downloaded, instead of one big bundle with every feature (dashboard,
// coordinator, admin, etc.) loaded upfront.
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage'));
const EventsPage = lazy(() => import('./features/events/EventsPage'));
const PassengersPage = lazy(() => import('./features/passengers/PassengersPage'));
const ChecklistPage = lazy(() => import('./features/checklist/ChecklistPage'));
const AgendaPage = lazy(() => import('./features/agenda/AgendaPage'));
const CoordinatorPage = lazy(() => import('./features/coordinator/CoordinatorPage'));
const TransportPage = lazy(() => import('./features/transport/TransportPage'));
const TeamPage = lazy(() => import('./features/team/TeamPage'));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'));
const AdminPage = lazy(() => import('./features/admin/AdminPage'));

function NotProvisioned() {
  const { t } = useTranslation();
  const { signOut, session } = useAuth();
  return (
    <div className="flex min-h-full items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-sm">
        <h1 className="mb-2 text-lg font-semibold">{t('auth.noAccessTitle')}</h1>
        <p className="mb-4 text-sm text-slate-600">{t('auth.noAccessBody', { email: session?.user.email ?? '' })}</p>
        <Button variant="secondary" onClick={signOut}>{t('auth.signOut')}</Button>
      </div>
    </div>
  );
}

export default function App() {
  const { session, loading, notProvisioned, isPlatformAdmin, appUser } = useAuth();
  const location = useLocation();

  // The reset/invite page must work with or without a full session.
  if (location.pathname === '/reset') {
    return (
      <Routes>
        <Route path="/reset" element={<ResetPasswordPage />} />
      </Routes>
    );
  }

  if (loading) {
    return <div className="flex min-h-full items-center justify-center"><Spinner /></div>;
  }

  if (!session) return <LoginPage />;

  // Platform super-admin at /admin, or with no agency of their own.
  if (isPlatformAdmin && (location.pathname === '/admin' || !appUser)) {
    return (
      <Suspense fallback={<div className="flex min-h-full items-center justify-center"><Spinner /></div>}>
        <AdminPage />
      </Suspense>
    );
  }

  if (notProvisioned) return <NotProvisioned />;

  return (
    <Layout>
      <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center"><Spinner /></div>}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/events/:eventId/passengers" element={<PassengersPage />} />
          <Route path="/events/:eventId/checklist" element={<ChecklistPage />} />
          <Route path="/events/:eventId/agenda" element={<AgendaPage />} />
          <Route path="/transport" element={<TransportPage />} />
          <Route path="/coordinador" element={<CoordinatorPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
