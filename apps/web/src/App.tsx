import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { Toaster } from 'sonner';
import { AppShell } from './components/AppShell';
import { Splash } from './components/Splash';
import { useAuth } from './lib/auth';
import { idbPersister, queryClient, QUERY_CACHE_BUSTER } from './lib/query';
import { setSyncGate, startSyncEngine } from './lib/sync';
import { useThemeSync } from './lib/theme';

const Welcome = lazy(() => import('./routes/auth/Welcome'));
const Login = lazy(() => import('./routes/auth/Login'));
const Register = lazy(() => import('./routes/auth/Register'));
const ForgotPassword = lazy(() => import('./routes/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./routes/auth/ResetPassword'));
const VerifyEmail = lazy(() => import('./routes/auth/VerifyEmail'));
const Onboarding = lazy(() => import('./routes/Onboarding'));
const Today = lazy(() => import('./routes/Today'));
const Workout = lazy(() => import('./routes/workout/WorkoutPage'));
const WorkoutSummary = lazy(() => import('./routes/workout/SummaryPage'));
const Plans = lazy(() => import('./routes/plans/PlansPage'));
const PlanEditor = lazy(() => import('./routes/plans/PlanEditorPage'));
const Templates = lazy(() => import('./routes/plans/TemplatesPage'));
const NotesImport = lazy(() => import('./routes/plans/NotesImportPage'));
const Exercises = lazy(() => import('./routes/exercises/ExercisesPage'));
const ExerciseDetail = lazy(() => import('./routes/exercises/ExerciseDetailPage'));
const ExerciseForm = lazy(() => import('./routes/exercises/ExerciseFormPage'));
const Progress = lazy(() => import('./routes/progress/ProgressPage'));
const History = lazy(() => import('./routes/progress/HistoryPage'));
const Profile = lazy(() => import('./routes/profile/ProfilePage'));
const Settings = lazy(() => import('./routes/profile/SettingsPage'));
const Account = lazy(() => import('./routes/profile/AccountPage'));
const DataPage = lazy(() => import('./routes/profile/DataPage'));
const Privacy = lazy(() => import('./routes/profile/PrivacyPage'));
const Achievements = lazy(() => import('./routes/profile/AchievementsPage'));
const BodyPage = lazy(() => import('./routes/profile/BodyPage'));

function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAuth((s) => s.status);
  const onboarded = useAuth((s) => s.user?.profile.onboardingCompleted ?? false);
  const location = useLocation();
  if (status === 'booting') return <Splash />;
  if (status === 'guest') return <Navigate to="/welcome" replace state={{ from: location.pathname }} />;
  if (!onboarded && location.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const status = useAuth((s) => s.status);
  if (status === 'booting') return <Splash />;
  if (status === 'authed') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function App() {
  const bootstrap = useAuth((s) => s.bootstrap);
  const status = useAuth((s) => s.status);
  useThemeSync();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    setSyncGate(() => useAuth.getState().status === 'authed');
    if (status === 'authed') startSyncEngine();
  }, [status]);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: idbPersister, maxAge: 7 * 24 * 3600_000, buster: QUERY_CACHE_BUSTER }}
    >
      <BrowserRouter>
        <Suspense fallback={<Splash />}>
          <Routes>
            <Route path="/welcome" element={<GuestOnly><Welcome /></GuestOnly>} />
            <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
            <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
            <Route element={<RequireAuth><AppShell /></RequireAuth>}>
              <Route index element={<Today />} />
              <Route path="workout/:id" element={<Workout />} />
              <Route path="workout/:id/summary" element={<WorkoutSummary />} />
              <Route path="plans" element={<Plans />} />
              <Route path="plans/templates" element={<Templates />} />
              <Route path="plans/import" element={<NotesImport />} />
              <Route path="plans/:id" element={<PlanEditor />} />
              <Route path="exercises" element={<Exercises />} />
              <Route path="exercises/new" element={<ExerciseForm />} />
              <Route path="exercises/:id" element={<ExerciseDetail />} />
              <Route path="exercises/:id/edit" element={<ExerciseForm />} />
              <Route path="progress" element={<Progress />} />
              <Route path="history" element={<History />} />
              <Route path="profile" element={<Profile />} />
              <Route path="profile/settings" element={<Settings />} />
              <Route path="profile/account" element={<Account />} />
              <Route path="profile/data" element={<DataPage />} />
              <Route path="profile/privacy" element={<Privacy />} />
              <Route path="profile/achievements" element={<Achievements />} />
              <Route path="profile/body" element={<BodyPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster
        position="top-center"
        theme="system"
        toastOptions={{ className: '!bg-surface !text-text !border-border !rounded-2xl' }}
        offset="calc(env(safe-area-inset-top) + 12px)"
      />
    </PersistQueryClientProvider>
  );
}
