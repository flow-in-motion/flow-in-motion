import { lazy, Suspense, type ReactNode } from "react";
import { Route, Routes } from "react-router-dom";

import { RequireAuth } from "@/auth/require-auth";
import { RequireApiSession } from "@/auth/require-api-session";
import { RequireWorkspace } from "@/auth/require-workspace";
import { AppLayout } from "@/components/layout/app-layout";
import { CookieNotice } from "@/components/shared/cookie-notice";
import { LoadingState } from "@/components/shared/loading-state";

const DashboardPage = lazy(() => import("@/pages/dashboard"));
const ProjectsPage = lazy(() => import("@/pages/projects"));
const ModulesPage = lazy(() => import("@/pages/modules"));
const ModuleDetailPage = lazy(() => import("@/pages/module-detail"));
const ProjectDetailPage = lazy(() => import("@/pages/project-detail"));
const TasksPage = lazy(() => import("@/pages/tasks"));
const CalendarPage = lazy(() => import("@/pages/calendar"));
const MindMapPage = lazy(() => import("@/pages/mind-map"));
const ConferencesPage = lazy(() => import("@/pages/conferences"));
const ConferenceDetailPage = lazy(() => import("@/pages/conference-detail"));
const TaskDetailPage = lazy(() => import("@/pages/task-detail"));
const DailyNotesPage = lazy(() => import("@/pages/daily-notes"));
const DailyNoteDetailPage = lazy(() => import("@/pages/daily-note-detail"));
const PipelinePage = lazy(() => import("@/pages/pipeline"));
const AccountAuditPage = lazy(() => import("@/pages/account-audit"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const FutureFeaturePage = lazy(() => import("@/pages/future-feature"));
const SignInPage = lazy(() => import("@/pages/sign-in"));
const AuthCallbackPage = lazy(() => import("@/pages/auth-callback"));
const WorkspaceOnboardingPage = lazy(() => import("@/pages/workspace-onboarding"));
const SessionExpiredPage = lazy(() => import("@/pages/session-expired"));
const AccessDeniedPage = lazy(() => import("@/pages/access-denied"));
const MembershipStatusPage = lazy(() => import("@/pages/membership-status"));
const NotFoundPage = lazy(() => import("@/pages/not-found"));
const SiteMapPage = lazy(() => import("@/pages/site-map"));
const InvitationPage = lazy(() => import("@/pages/invitation"));
const TermsPage = lazy(() => import("@/pages/terms"));
const PrivacyPage = lazy(() => import("@/pages/privacy"));
const UsagePage = lazy(() => import("@/pages/usage"));

function routePage(page: ReactNode) {
  return (
    <Suspense
      fallback={
        <LoadingState
          title="Loading page"
          description="Please wait while this page is prepared."
          className="min-h-[50vh]"
        />
      }
    >
      {page}
    </Suspense>
  );
}

export default function App() {
  return (
    <>
    <CookieNotice />
    <Routes>
      <Route path="sign-in" element={routePage(<SignInPage />)} />
      <Route path="auth/callback" element={routePage(<AuthCallbackPage />)} />
      <Route path="session-expired" element={routePage(<SessionExpiredPage />)} />
      <Route path="access-denied" element={routePage(<AccessDeniedPage />)} />
      <Route path="invitations/:token" element={routePage(<InvitationPage />)} />
      <Route path="terms" element={routePage(<TermsPage />)} />
      <Route path="privacy" element={routePage(<PrivacyPage />)} />

      <Route element={<RequireAuth />}>
        <Route element={<RequireApiSession />}>
          <Route
            path="membership-status/:status"
            element={routePage(<MembershipStatusPage />)}
          />
          <Route element={<RequireWorkspace shouldExist={false} />}>
            <Route path="onboarding" element={routePage(<WorkspaceOnboardingPage />)} />
          </Route>
          <Route element={<RequireWorkspace shouldExist />}>
            <Route element={<AppLayout />}>
              <Route index element={routePage(<DashboardPage />)} />
              <Route path="projects" element={routePage(<ProjectsPage />)} />
              <Route path="modules" element={routePage(<ModulesPage />)} />
              <Route path="modules/:moduleId" element={routePage(<ModuleDetailPage />)} />
              <Route
                path="projects/:projectId"
                element={routePage(<ProjectDetailPage />)}
              />
              <Route path="tasks" element={routePage(<TasksPage />)} />
              <Route path="calendar" element={routePage(<CalendarPage />)} />
              <Route path="mind-map" element={routePage(<MindMapPage />)} />
              <Route path="conferences" element={routePage(<ConferencesPage />)} />
              <Route path="conferences/:conferenceId" element={routePage(<ConferenceDetailPage />)} />
              <Route path="tasks/:taskId" element={routePage(<TaskDetailPage />)} />
              <Route path="daily-notes" element={routePage(<DailyNotesPage />)} />
              <Route path="daily-notes/:noteId" element={routePage(<DailyNoteDetailPage />)} />
              <Route path="pipeline" element={routePage(<PipelinePage />)} />
              <Route path="settings" element={routePage(<SettingsPage />)} />
              <Route
                path="settings/account-audit"
                element={routePage(<AccountAuditPage />)}
              />
              <Route path="future/:feature" element={routePage(<FutureFeaturePage />)} />
              <Route path="site-map" element={routePage(<SiteMapPage />)} />
              <Route path="usage" element={routePage(<UsagePage />)} />
              <Route path="*" element={routePage(<NotFoundPage />)} />
            </Route>
          </Route>
        </Route>
      </Route>
    </Routes>
    </>
  );
}
