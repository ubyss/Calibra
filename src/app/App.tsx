import { MotionConfig } from 'motion/react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { WorklogEditorProvider } from '@/components/worklog/WorklogEditorProvider';
import { useStoredValue } from '@/hooks/useStoredValue';
import { useTheme } from '@/hooks/useTheme';
import { BookmarksPage } from '@/pages/bookmarks/BookmarksPage';
import { CalendarPage } from '@/pages/calendar/CalendarPage';
import { ConnectPage } from '@/pages/connect/ConnectPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { GroupsPage } from '@/pages/groups/GroupsPage';
import { ImportPage } from '@/pages/import/ImportPage';
import { EstimateReportPage } from '@/pages/reports/EstimateReportPage';
import { SprintReportPage } from '@/pages/reports/SprintReportPage';
import { TeamHoursReportPage } from '@/pages/reports/TeamHoursReportPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { WorklogsPage } from '@/pages/worklogs/WorklogsPage';

function ConnectedRoutes() {
  const location = useLocation();
  const { value: account, isLoaded } = useStoredValue('account');

  if (!isLoaded) {
    return null;
  }
  if (location.pathname === '/conectar') {
    return <ConnectPage />;
  }
  if (!account) {
    return <Navigate to="/conectar" replace />;
  }

  return (
    <AppShell>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/calendario" element={<CalendarPage />} />
        <Route path="/worklogs" element={<WorklogsPage />} />
        <Route path="/importar" element={<ImportPage />} />
        <Route path="/relatorios/horas" element={<TeamHoursReportPage />} />
        <Route path="/relatorios/sprint" element={<SprintReportPage />} />
        <Route path="/relatorios/estimativas" element={<EstimateReportPage />} />
        <Route path="/favoritos" element={<BookmarksPage />} />
        <Route path="/grupos" element={<GroupsPage />} />
        <Route path="/configuracoes" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

export function App() {
  useTheme();

  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <HashRouter>
          <WorklogEditorProvider>
            <ConnectedRoutes />
          </WorklogEditorProvider>
        </HashRouter>
      </ToastProvider>
    </MotionConfig>
  );
}
