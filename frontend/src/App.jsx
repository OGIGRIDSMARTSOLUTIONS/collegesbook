import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LoadingState } from './components/loading/Spinner';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { AdminRoute } from './routes/AdminRoute';
import { SuperAdminRoute } from './routes/SuperAdminRoute';
import { MainLayout } from './layouts/MainLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { SuperAdminLayout } from './layouts/SuperAdminLayout';
import { RoleGate } from './components/RoleGate';
import { ADMIN_SECTION_ROLES } from './constants/adminRoles';

const LoginPage = lazy(() => import('./features/auth/LoginPage'));
const ForgotPasswordPage = lazy(() => import('./features/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./features/auth/ResetPasswordPage'));
const RegisterPage = lazy(() => import('./features/auth/RegisterPage'));
const FeedPage = lazy(() => import('./features/feed/FeedPage'));
const NetworkPage = lazy(() => import('./features/network/NetworkPage'));
const MessagesPage = lazy(() => import('./features/messages/MessagesPage'));
const YearbookPage = lazy(() => import('./features/yearbook/YearbookPage'));
const NotificationsPage = lazy(() => import('./features/notifications/NotificationsPage'));
const GroupsPage = lazy(() => import('./features/groups/GroupsPage'));
const ProfilePage = lazy(() => import('./features/profile/ProfilePage'));
const SavedPostsPage = lazy(() => import('./features/saved/SavedPostsPage'));
const InstitutionNewsPage = lazy(() => import('./features/news/InstitutionNewsPage'));
const BirthdaysPage = lazy(() => import('./features/birthdays/BirthdaysPage'));
const InstitutionEventsPage = lazy(() => import('./features/events/InstitutionEventsPage'));
const NewsFeedsPage = lazy(() => import('./features/newsfeeds/NewsFeedsPage'));
const AdminEventsPage = lazy(() => import('./features/admin/AdminEventsPage'));
const AdminStructurePage = lazy(() => import('./features/admin/AdminStructurePage'));
const AdminStudentsPage = lazy(() => import('./features/admin/AdminStudentsPage'));
const AdminBroadcastsPage = lazy(() => import('./features/admin/AdminBroadcastsPage'));
const AdminYearbookPage = lazy(() => import('./features/admin/AdminYearbookPage'));
const AdminModerationPage = lazy(() => import('./features/admin/AdminModerationPage'));
const AdminIndex = lazy(() => import('./features/admin/AdminIndex'));
const SuperAdminDashboardPage = lazy(() => import('./features/superadmin/SuperAdminDashboardPage'));
const NotFound = lazy(() => import('./pages/NotFound'));

export default function App() {
  return (
    <Suspense fallback={<LoadingState message="Loading CollegeBook…" />}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route path="/" element={<NewsFeedsPage />} />
          <Route path="/home" element={<FeedPage />} />
          <Route path="/network" element={<NetworkPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/yearbook" element={<YearbookPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/:id" element={<ProfilePage />} />
          <Route path="/saved" element={<SavedPostsPage />} />
          <Route path="/institution-news" element={<InstitutionNewsPage />} />
          <Route path="/birthdays" element={<BirthdaysPage />} />
          <Route path="/institution-events" element={<InstitutionEventsPage />} />
          <Route path="/news-feeds" element={<NewsFeedsPage />} />
        </Route>

        <Route element={<AdminRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminIndex />} />
            <Route
              path="/admin/structure"
              element={
                <RoleGate allow={ADMIN_SECTION_ROLES.structure}>
                  <AdminStructurePage />
                </RoleGate>
              }
            />
            <Route
              path="/admin/students"
              element={
                <RoleGate allow={ADMIN_SECTION_ROLES.students}>
                  <AdminStudentsPage />
                </RoleGate>
              }
            />
            <Route
              path="/admin/broadcasts"
              element={
                <RoleGate allow={ADMIN_SECTION_ROLES.broadcasts}>
                  <AdminBroadcastsPage />
                </RoleGate>
              }
            />
            <Route
              path="/admin/events"
              element={
                <RoleGate allow={ADMIN_SECTION_ROLES.events}>
                  <AdminEventsPage />
                </RoleGate>
              }
            />
            <Route
              path="/admin/yearbook"
              element={
                <RoleGate allow={ADMIN_SECTION_ROLES.yearbook}>
                  <AdminYearbookPage />
                </RoleGate>
              }
            />
            <Route
              path="/admin/moderation"
              element={
                <RoleGate allow={ADMIN_SECTION_ROLES.moderation}>
                  <AdminModerationPage />
                </RoleGate>
              }
            />
          </Route>
        </Route>

        <Route element={<SuperAdminRoute />}>
          <Route element={<SuperAdminLayout />}>
            <Route path="/super-admin" element={<SuperAdminDashboardPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/404" element={<NotFound />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
    </Suspense>
  );
}
