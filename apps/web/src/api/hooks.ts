import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import {
  ApiError,
  apiClient,
  apiJson,
  authenticatedJson,
  responseData,
} from "@/api/client";

/**
 * None of the API's controllers annotate their response bodies with
 * @ApiResponse({ type }) (nest-cli.json also has no swagger plugin
 * configured to infer them), so the generated OpenAPI schema has no typed
 * response shape for any endpoint (`content?: never`) — these interfaces
 * are hand-written to match what each service actually returns.
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface Me {
  id: string;
  email: string;
  displayName: string;
  jobTitle: string | null;
  institution: string | null;
  department: string | null;
  phone: string | null;
  researchInterests: string | null;
  status: string;
  profileComplete: boolean;
  missingProfileFields: ("jobTitle" | "institution" | "department")[];
}
export interface UpdateProfile {
  displayName?: string;
  jobTitle?: string;
  institution?: string;
  department?: string;
  phone?: string;
  researchInterests?: string;
}
export interface AccountPreferences {
  appearanceTheme?: "light" | "dark";
  designTheme?: "modern" | "minimal" | "executive";
  colorTheme?: "ocean" | "violet" | "emerald" | "rose";
  textSize?: "small" | "default" | "large";
}
export interface DashboardLayoutPreference {
  order: string[];
  hidden: string[];
}
export interface WorkspacePreferences {
  dashboardLayout?: DashboardLayoutPreference;
  tableColumns?: Record<string, string[]>;
  pipelineHiddenStages?: Record<string, string[]>;
}
export interface WorkspacePreferencesPatch {
  dashboardLayout?: DashboardLayoutPreference;
  tableColumns?: Record<string, string[]>;
  pipelineHiddenStages?: Record<string, string[]>;
}
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  status: string;
  ownerUserId: string;
  membershipRole: "owner" | "limited_member";
  createdAt: string;
  updatedAt: string;
}
export interface Membership {
  id: string;
  tenantId: string;
  userId: string;
  email: string;
  displayName: string;
  role: "owner" | "limited_member";
  status: "active" | "revoked";
  invitedAt: string;
  joinedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// See apps/api/src/modules/{projects,project-modules,tasks,notes} for the source of truth.
export interface ApiProject {
  id: string;
  displayId: string | null;
  userId: string;
  tenantId: string;
  title: string;
  description: string | null;
  researchArea: string | null;
  status: string | null;
  importance: string | null;
  scheduledFor: string | null;
  dueDate: string | null;
  totalBudget: string | null;
  targetJournals: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** The calling user's collaborator role on this project, if any. */
  role: string | null;
}

export interface ApiCollaborator {
  id: string;
  tenantId: string;
  userId: string;
  roleId?: string | null;
  role: string | null;
  displayName?: string | null;
  email?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiModule {
  id: string;
  displayId: string | null;
  tenantId: string;
  projectId: string | null;
  /** The working name used day-to-day, often before a formal title exists. Prefer this for display. */
  shortTitle: string | null;
  /** The formal title, often added later in the process. */
  title: string | null;
  description: string | null;
  abstract: string | null;
  tag: string | null;
  status: string | null;
  pipelineStage: string | null;
  pipelineStageChangedAt: string | null;
  dueDate: string | null;
  assignedToUserId: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiTask {
  id: string;
  displayId: string | null;
  tenantId: string;
  projectId: string | null;
  moduleId: string | null;
  createdBy: string;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  visibility: string | null;
  workingWith: string | null;
  estimatedHours: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiNote {
  id: string;
  displayId: string | null;
  tenantId: string;
  projectId: string | null;
  moduleId: string | null;
  createdBy: string;
  title: string;
  content: string | null;
  visibility: string | null;
  /** A follow-up date shown on the Calendar page as a reminder for this note. */
  followUpDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiConferenceProject {
  id: string;
  displayId: string | null;
  title: string;
}

export interface ApiConference {
  id: string;
  tenantId: string;
  ownerUserId: string;
  acronym: string;
  name: string;
  location: string;
  submissionDue: string;
  startDate: string;
  endDate: string;
  submissionType: string | null;
  daysRemaining: number;
  projects: ApiConferenceProject[];
  createdAt: string;
  updatedAt: string;
}

export interface ConferenceInput {
  acronym: string;
  name: string;
  location: string;
  submissionDue: string;
  startDate: string;
  endDate: string;
  submissionType?: string;
  projectIds: string[];
}

export interface ApiCalendarEvent {
  id: string;
  tenantId: string;
  createdBy: string;
  title: string;
  eventDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEventInput {
  title: string;
  eventDate: string;
}

export interface ApiMember {
  id: string;
  tenantId: string;
  userId: string;
  displayName?: string | null;
  email?: string | null;
  createdAt: string;
}

export type InvitationTarget = "project" | "module";

export interface ApiInvitation {
  id: string;
  projectId?: string;
  moduleId?: string;
  email: string;
  role: string;
  invitedBy: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatedInvitation {
  invitation: ApiInvitation;
  acceptanceToken: string;
  emailSent?: boolean;
}

export interface InvitationPreview extends ApiInvitation {
  type: InvitationTarget;
  projectTitle?: string | null;
  moduleTitle?: string | null;
}

export const apiKeys = {
  me: ["api", "me"] as const,
  workspaces: ["api", "workspaces"] as const,
  workspacesPage: (page = 1) =>
    ["api", "workspaces", page] as const,
  currentWorkspace: ["api", "workspace", "current"] as const,
  members: (
    tenantId: string,
    page = 1,
  ) =>
    [
      "api",
      "tenant",
      tenantId,
      "members",
      page,
    ] as const,
  projects: (tenantId: string) =>
    ["api", "tenant", tenantId, "projects"] as const,
  projectsPage: (tenantId: string, page = 1) =>
    ["api", "tenant", tenantId, "projects", page] as const,
  project: (tenantId: string, projectId: string) =>
    ["api", "tenant", tenantId, "projects", projectId] as const,
  projectCollaborators: (tenantId: string, projectId: string) =>
    [
      "api",
      "tenant",
      tenantId,
      "projects",
      projectId,
      "collaborators",
    ] as const,
  projectInvitations: (tenantId: string, projectId: string) =>
    ["api", "tenant", tenantId, "projects", projectId, "invitations"] as const,
  modules: (
    tenantId: string,
    projectId?: string,
    page = 1,
  ) =>
    [
      "api",
      "tenant",
      tenantId,
      "modules",
      projectId ?? "all",
      page,
    ] as const,
  module: (tenantId: string, moduleId: string) =>
    ["api", "tenant", tenantId, "modules", "detail", moduleId] as const,
  moduleCollaborators: (tenantId: string, moduleId: string) =>
    ["api", "tenant", tenantId, "modules", moduleId, "collaborators"] as const,
  moduleInvitations: (tenantId: string, moduleId: string) =>
    ["api", "tenant", tenantId, "modules", moduleId, "invitations"] as const,
  modulePipelineStages: (tenantId: string) =>
    ["api", "tenant", tenantId, "module-pipeline-stages"] as const,
  invitation: (token: string) => ["api", "invitations", token] as const,
  tasks: (
    tenantId: string,
    projectId?: string,
    page = 1,
  ) =>
    [
      "api",
      "tenant",
      tenantId,
      "tasks",
      projectId ?? "all",
      page,
    ] as const,
  task: (tenantId: string, taskId: string) =>
    ["api", "tenant", tenantId, "tasks", "detail", taskId] as const,
  taskMembers: (tenantId: string, taskId: string) =>
    ["api", "tenant", tenantId, "tasks", taskId, "members"] as const,
  notes: (
    tenantId: string,
    projectId?: string,
    page = 1,
  ) =>
    [
      "api",
      "tenant",
      tenantId,
      "notes",
      projectId ?? "all",
      page,
    ] as const,
  note: (tenantId: string, noteId: string) =>
    ["api", "tenant", tenantId, "notes", "detail", noteId] as const,
  noteMembers: (tenantId: string, noteId: string) =>
    ["api", "tenant", tenantId, "notes", noteId, "members"] as const,
  conferences: (
    tenantId: string,
    page = 1,
  ) =>
    [
      "api",
      "tenant",
      tenantId,
      "conferences",
      page,
    ] as const,
  conference: (tenantId: string, conferenceId: string) =>
    ["api", "tenant", tenantId, "conferences", conferenceId] as const,
  calendarEvents: (
    tenantId: string,
    page = 1,
  ) =>
    [
      "api",
      "tenant",
      tenantId,
      "calendar-events",
      page,
    ] as const,
  accountPreferences: ["api", "me", "preferences"] as const,
  workspacePreferences: (tenantId: string) =>
    ["api", "tenant", tenantId, "me", "preferences"] as const,
};

export function useMe(enabled = true) {
  return useQuery({
    queryKey: apiKeys.me,
    enabled,
    queryFn: async () => responseData<Me>(await apiClient.GET("/api/v1/me")),
  });
}

export function useUpdateMe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (profile: UpdateProfile) =>
      responseData<Me>(
        await apiClient.PATCH("/api/v1/me", {
          body: profile,
        }),
      ),
    onSuccess(profile) {
      queryClient.setQueryData(apiKeys.me, profile);
    },
  });
}

export function useAccountPreferences(enabled = true) {
  return useQuery({
    queryKey: apiKeys.accountPreferences,
    enabled,
    queryFn: async () =>
      (
        await authenticatedJson<{ preferences: AccountPreferences | null }>(
          "/api/v1/me/preferences",
        )
      ).preferences,
  });
}

export function useUpdateAccountPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (preferences: AccountPreferences) =>
      (
        await authenticatedJson<{ preferences: AccountPreferences }>(
          "/api/v1/me/preferences",
          { method: "PATCH", body: JSON.stringify(preferences) },
        )
      ).preferences,
    retry: 2,
    async onMutate(patch) {
      await queryClient.cancelQueries({ queryKey: apiKeys.accountPreferences });
      const previous = queryClient.getQueryData<AccountPreferences>(
        apiKeys.accountPreferences,
      );
      queryClient.setQueryData<AccountPreferences>(apiKeys.accountPreferences, {
        ...(previous ?? {}),
        ...patch,
      });
      return { previous };
    },
    onError(_error, _patch, context) {
      queryClient.setQueryData(apiKeys.accountPreferences, context?.previous);
    },
    onSuccess(preferences, patch) {
      queryClient.setQueryData<AccountPreferences>(
        apiKeys.accountPreferences,
        (current) => ({
          ...(current ?? preferences),
          ...patch,
        }),
      );
    },
  });
}

export function useWorkspacePreferences(tenantId: string, enabled = true) {
  return useQuery({
    queryKey: apiKeys.workspacePreferences(tenantId),
    enabled: Boolean(tenantId) && enabled,
    queryFn: async () =>
      (
        await authenticatedJson<{ preferences: WorkspacePreferences | null }>(
          `/api/v1/tenant/${tenantId}/me/preferences`,
        )
      ).preferences,
  });
}

export function useUpdateWorkspacePreferences(tenantId: string) {
  const queryClient = useQueryClient();
  const queryKey = apiKeys.workspacePreferences(tenantId);

  const mergePatch = (
    current: WorkspacePreferences | null | undefined,
    patch: WorkspacePreferencesPatch,
  ): WorkspacePreferences => ({
    ...(current ?? {}),
    ...(patch.dashboardLayout
      ? { dashboardLayout: patch.dashboardLayout }
      : {}),
    tableColumns: {
      ...(current?.tableColumns ?? {}),
      ...(patch.tableColumns ?? {}),
    },
    pipelineHiddenStages: {
      ...(current?.pipelineHiddenStages ?? {}),
      ...(patch.pipelineHiddenStages ?? {}),
    },
  });

  return useMutation({
    mutationFn: async (patch: WorkspacePreferencesPatch) =>
      (
        await authenticatedJson<{ preferences: WorkspacePreferences }>(
          `/api/v1/tenant/${tenantId}/me/preferences`,
          { method: "PATCH", body: JSON.stringify(patch) },
        )
      ).preferences,
    retry: 2,
    async onMutate(patch) {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<WorkspacePreferences | null>(
        queryKey,
      );
      queryClient.setQueryData<WorkspacePreferences>(
        queryKey,
        mergePatch(previous, patch),
      );
      return { previous };
    },
    onError(_error, _patch, context) {
      queryClient.setQueryData(queryKey, context?.previous);
    },
    onSuccess(preferences, patch) {
      queryClient.setQueryData<WorkspacePreferences>(queryKey, (current) =>
        mergePatch(current ?? preferences, patch),
      );
    },
  });
}

export function useCurrentWorkspace(enabled = true) {
  return useQuery({
    queryKey: apiKeys.currentWorkspace,
    enabled,
    queryFn: async () => {
      const result = await apiClient.GET("/api/v1/workspaces/current");
      if (result.response.status === 404) return null;
      return responseData<Workspace>(result);
    },
    retry(failureCount, error) {
      return (
        !(error instanceof ApiError && error.status < 500) && failureCount < 2
      );
    },
  });
}

export function useWorkspaces(page = 1) {
  return useQuery({
    queryKey: apiKeys.workspacesPage(page),
    queryFn: async () =>
      responseData<PaginatedResponse<Workspace>>(
        await apiClient.GET("/api/v1/workspaces", {
          params: {
            query: { page },
          } as never,
        }),
      ),
  });
}

export function useSwitchWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (workspaceId: string) => {
      const result = await apiClient.PUT("/api/v1/workspaces/current", {
        body: { workspaceId },
      });

      if (result.response.status !== 200) {
        await responseData(result);
        throw new ApiError(
          result.response.status,
          `Workspace switch returned unexpected status ${result.response.status}`,
        );
      }

      return responseData<Workspace>(result);
    },
    async onSuccess(workspace) {
      queryClient.setQueryData(apiKeys.currentWorkspace, workspace);
      await queryClient.invalidateQueries({ queryKey: ["api", "tenant"] });
    },
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const result = await apiClient.POST("/api/v1/workspaces", {
        body: { name },
      });

      if (result.response.status !== 201) {
        throw new ApiError(
          result.response.status,
          `Workspace creation returned unexpected status ${result.response.status}`,
        );
      }

      return responseData<Workspace>(result);
    },
    async onSuccess(workspace) {
      queryClient.setQueryData(apiKeys.currentWorkspace, workspace);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: apiKeys.me }),
        queryClient.invalidateQueries({ queryKey: apiKeys.workspaces }),
      ]);
    },
  });
}

export function useDeleteWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (workspaceId: string) => {
      const result = await apiClient.DELETE(
        "/api/v1/workspaces/{workspaceId}",
        {
          params: { path: { workspaceId } },
        },
      );

      if (result.response.status !== 200) {
        await responseData(result);
        throw new ApiError(
          result.response.status,
          `Workspace deletion returned unexpected status ${result.response.status}`,
        );
      }

      return responseData<Workspace>(result);
    },
    async onSuccess() {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: apiKeys.workspaces }),
        queryClient.invalidateQueries({ queryKey: apiKeys.currentWorkspace }),
        queryClient.invalidateQueries({ queryKey: ["api", "tenant"] }),
      ]);
    },
  });
}

export function useMembers(
  tenantId: string,
  page = 1,
  enabled = true,
) {
  return useQuery({
    queryKey: apiKeys.members(tenantId, page),
    enabled: Boolean(tenantId) && enabled,
    queryFn: async () => {
      const result = await apiClient.GET(
        "/api/v1/tenant/{tenantId}/members",
        {
          params: {
            path: { tenantId },
            query: { page },
          } as never,
        },
      );

      // The generated MembershipResponseDto mis-describes `joinedAt` as `{}`
      // because the backend DTO lacks an explicit Swagger type hint.
      return responseData<PaginatedResponse<Membership>>(
        result as never,
      );
    },
  });
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export interface CreateProjectInput {
  title: string;
  description?: string;
  researchArea?: string;
  status?: string;
  importance?: string;
  scheduledFor?: string;
  dueDate?: string;
  totalBudget?: string;
  targetJournals?: string;
}
export type UpdateProjectInput = Partial<CreateProjectInput>;

export function useProjects(
  tenantId: string,
  page = 1,
  enabled = true,
) {
  return useQuery({
    queryKey: apiKeys.projectsPage(tenantId, page),
    enabled: Boolean(tenantId) && enabled,
    queryFn: async () =>
      responseData<PaginatedResponse<ApiProject>>(
        await apiClient.GET("/api/v1/tenant/{tenantId}/projects", {
          params: {
            path: { tenantId },
            query: { page } as never,
          },
        }),
      ),
  });
}

export function useProject(
  tenantId: string,
  projectId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: apiKeys.project(tenantId, projectId),
    enabled: Boolean(tenantId) && Boolean(projectId) && enabled,
    queryFn: async () =>
      responseData<ApiProject>(
        await apiClient.GET("/api/v1/tenant/{tenantId}/projects/{projectId}", {
          params: { path: { tenantId, projectId } },
        }),
      ),
  });
}

export function useCreateProject(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateProjectInput) =>
      responseData<ApiProject>(
        await apiClient.POST("/api/v1/tenant/{tenantId}/projects", {
          params: { path: { tenantId } },
          body: input,
        }),
      ),
    async onSuccess(project) {
      // The tenant-scoped list is paginated (`{ data, meta }`), so a new
      // project's page/position depends on server-side sort order — just
      // invalidate and let it refetch instead of guessing where to splice it
      // in. The "my projects" list is a plain array, so it can be patched
      // directly.
      queryClient.setQueryData<ApiProject[]>(["api", "me", "projects"], (current) => {
        if (!current) return [project];
        return current.some((item) => item.id === project.id)
          ? current
          : [project, ...current];
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: apiKeys.projects(tenantId) }),
        queryClient.invalidateQueries({ queryKey: ["api", "me", "projects"] }),
      ]);
    },
  });
}

export function useUpdateProject(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      input,
    }: {
      projectId: string;
      input: UpdateProjectInput;
    }) =>
      responseData<ApiProject>(
        await apiClient.PATCH(
          "/api/v1/tenant/{tenantId}/projects/{projectId}",
          {
            params: { path: { tenantId, projectId } },
            body: input,
          },
        ),
      ),
    async onSuccess(project) {
      queryClient.setQueryData(apiKeys.project(tenantId, project.id), project);
      await queryClient.invalidateQueries({
        queryKey: apiKeys.projects(tenantId),
      });
    },
  });
}

export function useArchiveProject(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (projectId: string) =>
      responseData<{ project: ApiProject; warning: string }>(
        await apiClient.DELETE(
          "/api/v1/tenant/{tenantId}/projects/{projectId}",
          {
            params: { path: { tenantId, projectId } },
          },
        ),
      ),
    async onSuccess() {
      await queryClient.invalidateQueries({
        queryKey: apiKeys.projects(tenantId),
      });
    },
  });
}

const myProjectsKey = [
  "api",
  "me",
  "projects",
] as const;

const myProjectsPageKey = (page = 1) =>
  [
    ...myProjectsKey,
    page,
  ] as const;

const myProjectKey = (projectId: string) =>
  ["api", "me", "projects", projectId] as const;

/**
 * "My*" mutations act on a resource without knowing which tenant it
 * belongs to, so they can't target a specific `apiKeys.projects(tenantId)`
 * key. Instead this invalidates every cached query for the resource across
 * all workspaces — otherwise a tenant-scoped list (e.g. the Projects page)
 * keeps showing pre-edit data until the tab is reloaded, since editing via
 * a "My*" endpoint never touches that list's cache entry.
 */
function invalidateResourceEverywhere(queryClient: QueryClient, resource: string) {
  return queryClient.invalidateQueries({
    predicate: (query) => query.queryKey.includes(resource),
  });
}

/**
 * Tenant-agnostic: every project the caller owns or collaborates on,
 * regardless of which workspace it lives in — see MyProjectsController on
 * the backend.
 */
export function useMyProjects(
  page = 1,
  enabled = true,
) {
  return useQuery({
    queryKey: myProjectsPageKey(page),
    enabled,
    queryFn: async () =>
      responseData<PaginatedResponse<ApiProject>>(
        await apiClient.GET("/api/v1/me/projects", {
          params: {
            query: { page },
          } as never,
        }),
      ),
  });
}

export function useMyProject(projectId: string, enabled = true) {
  return useQuery({
    queryKey: myProjectKey(projectId),
    enabled: Boolean(projectId) && enabled,
    queryFn: async () =>
      responseData<ApiProject>(
        await apiClient.GET("/api/v1/me/projects/{projectId}", {
          params: { path: { projectId } },
        }),
      ),
  });
}

export function useUpdateMyProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      input,
    }: {
      projectId: string;
      input: UpdateProjectInput;
    }) =>
      responseData<ApiProject>(
        await apiClient.PATCH("/api/v1/me/projects/{projectId}", {
          params: { path: { projectId } },
          body: input,
        }),
      ),
    async onSuccess(project) {
      queryClient.setQueryData(myProjectKey(project.id), project);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: myProjectsKey }),
        invalidateResourceEverywhere(queryClient, "projects"),
      ]);
    },
  });
}

export function useArchiveMyProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (projectId: string) =>
      responseData<{ project: ApiProject; warning: string }>(
        await apiClient.DELETE("/api/v1/me/projects/{projectId}", {
          params: { path: { projectId } },
        }),
      ),
    async onSuccess() {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: myProjectsKey }),
        invalidateResourceEverywhere(queryClient, "projects"),
      ]);
    },
  });
}

export function useProjectCollaborators(
  tenantId: string,
  projectId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: apiKeys.projectCollaborators(tenantId, projectId),
    enabled: Boolean(tenantId) && Boolean(projectId) && enabled,
    queryFn: async () =>
      responseData<ApiCollaborator[]>(
        await apiClient.GET(
          "/api/v1/tenant/{tenantId}/projects/{projectId}/collaborators",
          { params: { path: { tenantId, projectId } } },
        ),
      ),
  });
}

export function useAddProjectCollaborator(tenantId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; role: string }) =>
      responseData<ApiCollaborator>(
        await apiClient.POST(
          "/api/v1/tenant/{tenantId}/projects/{projectId}/collaborators",
          { params: { path: { tenantId, projectId } }, body: input },
        ),
      ),
    async onSuccess() {
      await queryClient.invalidateQueries({
        queryKey: apiKeys.projectCollaborators(tenantId, projectId),
      });
    },
  });
}

export function useRemoveProjectCollaborator(
  tenantId: string,
  projectId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) =>
      responseData(
        await apiClient.DELETE(
          "/api/v1/tenant/{tenantId}/projects/{projectId}/collaborators/{userId}",
          { params: { path: { tenantId, projectId, userId } } },
        ),
      ),
    async onSuccess() {
      await queryClient.invalidateQueries({
        queryKey: apiKeys.projectCollaborators(tenantId, projectId),
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------

export interface CreateModuleInput {
  shortTitle: string;
  title?: string;
  description?: string;
  abstract?: string;
  projectId?: string;
  tag?: string;
  status?: string;
  pipelineStage?: string;
  dueDate?: string;
  assignedToUserId?: string;
}
export type UpdateModuleInput = Omit<Partial<CreateModuleInput>, "projectId"> & {
  /** `null` unlinks the module (makes it independent); omit to leave unchanged. */
  projectId?: string | null;
};

export function useModules(
  tenantId: string,
  projectId?: string,
  page = 1,
  enabled = true,
) {
  return useQuery({
    queryKey: apiKeys.modules(tenantId, projectId, page),
    enabled: Boolean(tenantId) && enabled,
    queryFn: async () =>
      responseData<PaginatedResponse<ApiModule>>(
        await apiClient.GET("/api/v1/tenant/{tenantId}/modules", {
          params: {
            path: { tenantId },
            // The generated type marks projectId as required even though
            // it is optional at runtime.
            query: {
              ...(projectId ? { projectId } : {}),
              page,
            } as {
              projectId: string;
              page: number;
            },
          },
        }),
      ),
  });
}

export function useModule(tenantId: string, moduleId: string, enabled = true) {
  return useQuery({
    queryKey: apiKeys.module(tenantId, moduleId),
    enabled: Boolean(tenantId) && Boolean(moduleId) && enabled,
    queryFn: async () =>
      responseData<ApiModule>(
        await apiClient.GET("/api/v1/tenant/{tenantId}/modules/{moduleId}", {
          params: { path: { tenantId, moduleId } },
        }),
      ),
  });
}

export function useCreateModule(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateModuleInput) =>
      responseData<ApiModule>(
        await apiClient.POST("/api/v1/tenant/{tenantId}/modules", {
          params: { path: { tenantId } },
          body: input,
        }),
      ),
    async onSuccess(module) {
      // The tenant-scoped list is paginated (`{ data, meta }`), so a new
      // module's page/position depends on server-side sort order — just
      // invalidate and let it refetch instead of guessing where to splice it
      // in. The "my modules" list is a plain array, so it can be patched
      // directly.
      queryClient.setQueryData<ApiModule[]>(["api", "me", "modules"], (current) => {
        if (!current) return [module];
        return current.some((item) => item.id === module.id)
          ? current
          : [module, ...current];
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["api", "tenant", tenantId, "modules"],
        }),
        queryClient.invalidateQueries({ queryKey: ["api", "me", "modules"] }),
      ]);
    },
  });
}

export function useUpdateModule(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      moduleId,
      input,
    }: {
      moduleId: string;
      input: UpdateModuleInput;
    }) =>
      responseData<ApiModule>(
        await apiClient.PATCH("/api/v1/tenant/{tenantId}/modules/{moduleId}", {
          params: { path: { tenantId, moduleId } },
          // The generated type only allows `string | undefined` for
          // projectId, but the backend accepts an explicit `null` to unlink
          // the module — see ProjectModulesService.update.
          body: input as typeof input & { projectId?: string },
        }),
      ),
    async onSuccess(module) {
      queryClient.setQueryData(apiKeys.module(tenantId, module.id), module);
      await queryClient.invalidateQueries({
        queryKey: ["api", "tenant", tenantId, "modules"],
      });
    },
  });
}

export function useArchiveModule(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (moduleId: string) =>
      responseData<{ module: ApiModule; warning: string }>(
        await apiClient.DELETE("/api/v1/tenant/{tenantId}/modules/{moduleId}", {
          params: { path: { tenantId, moduleId } },
        }),
      ),
    async onSuccess(_result, moduleId) {
      // Both tenant-scoped and cross-workspace module lists are paginated,
      // so invalidate them and let React Query refetch the affected pages.
      queryClient.removeQueries({
        queryKey: apiKeys.module(tenantId, moduleId),
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["api", "tenant", tenantId, "modules"],
        }),
        queryClient.invalidateQueries({ queryKey: myModulesKey }),
      ]);
    },
  });
}

export function useModuleCollaborators(
  tenantId: string,
  moduleId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: apiKeys.moduleCollaborators(tenantId, moduleId),
    enabled: Boolean(tenantId) && Boolean(moduleId) && enabled,
    queryFn: async () =>
      responseData<ApiCollaborator[]>(
        await apiClient.GET(
          "/api/v1/tenant/{tenantId}/modules/{moduleId}/collaborators",
          { params: { path: { tenantId, moduleId } } },
        ),
      ),
  });
}

export function useAddModuleCollaborator(tenantId: string, moduleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; role: string }) =>
      responseData<ApiCollaborator>(
        await apiClient.POST(
          "/api/v1/tenant/{tenantId}/modules/{moduleId}/collaborators",
          { params: { path: { tenantId, moduleId } }, body: input },
        ),
      ),
    async onSuccess() {
      await queryClient.invalidateQueries({
        queryKey: apiKeys.moduleCollaborators(tenantId, moduleId),
      });
    },
  });
}

export function useRemoveModuleCollaborator(
  tenantId: string,
  moduleId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) =>
      responseData(
        await apiClient.DELETE(
          "/api/v1/tenant/{tenantId}/modules/{moduleId}/collaborators/{userId}",
          { params: { path: { tenantId, moduleId, userId } } },
        ),
      ),
    async onSuccess() {
      await queryClient.invalidateQueries({
        queryKey: apiKeys.moduleCollaborators(tenantId, moduleId),
      });
    },
  });
}

const myModulesKey = ["api", "me", "modules"] as const;

const myModulesPageKey = (page = 1) =>
  [...myModulesKey, page] as const;

const myModuleKey = (moduleId: string) =>
  ["api", "me", "modules", moduleId] as const;

/**
 * Tenant-agnostic: every module the caller can access, regardless of which
 * workspace it lives in — see MyModulesController on the backend.
 */
export function useMyModules(page = 1, enabled = true) {
  return useQuery({
    queryKey: myModulesPageKey(page),
    enabled,
    queryFn: async () =>
      responseData<PaginatedResponse<ApiModule>>(
        await apiClient.GET("/api/v1/me/modules", {
          params: {
            query: { page } as never,
          },
        }),
      ),
  });
}

export function useMyModule(moduleId: string, enabled = true) {
  return useQuery({
    queryKey: myModuleKey(moduleId),
    enabled: Boolean(moduleId) && enabled,
    queryFn: async () =>
      responseData<ApiModule>(
        await apiClient.GET("/api/v1/me/modules/{moduleId}", {
          params: { path: { moduleId } },
        }),
      ),
  });
}

export function useUpdateMyModule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      moduleId,
      input,
    }: {
      moduleId: string;
      input: UpdateModuleInput;
    }) =>
      responseData<ApiModule>(
        await apiClient.PATCH("/api/v1/me/modules/{moduleId}", {
          params: { path: { moduleId } },
          // See the tenant-scoped useUpdateModule above — the generated type
          // doesn't know `projectId: null` is valid for unlinking.
          body: input as typeof input & { projectId?: string },
        }),
      ),
    async onSuccess(module) {
      queryClient.setQueryData(myModuleKey(module.id), module);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: myModulesKey }),
        invalidateResourceEverywhere(queryClient, "modules"),
      ]);
    },
  });
}

export function useArchiveMyModule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (moduleId: string) =>
      responseData<{ module: ApiModule; warning: string }>(
        await apiClient.DELETE("/api/v1/me/modules/{moduleId}", {
          params: { path: { moduleId } },
        }),
      ),
    async onSuccess() {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: myModulesKey }),
        invalidateResourceEverywhere(queryClient, "modules"),
      ]);
    },
  });
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export interface CreateTaskInput {
  title: string;
  description?: string;
  projectId?: string;
  moduleId?: string;
  status?: string;
  priority?: string;
  visibility?: string;
  workingWith?: string;
  estimatedHours?: string;
  dueDate?: string;
}
export type UpdateTaskInput = Omit<Partial<CreateTaskInput>, "projectId" | "moduleId"> & {
  /** `null` clears the link (project unset, or unlinked from its module); omit to leave unchanged. */
  projectId?: string | null;
  moduleId?: string | null;
};

export function useTasks(
  tenantId: string,
  projectId?: string,
  page = 1,
  enabled = true,
) {
  return useQuery({
    queryKey: apiKeys.tasks(tenantId, projectId, page),
    enabled: Boolean(tenantId) && enabled,
    queryFn: async () =>
      responseData<PaginatedResponse<ApiTask>>(
        await apiClient.GET("/api/v1/tenant/{tenantId}/tasks", {
          params: {
            path: { tenantId },
            query: {
              ...(projectId ? { projectId } : {}),
              page,
            } as {
              projectId: string;
              page: number;
            },
          },
        }),
      ),
  });
}

export function useTask(tenantId: string, taskId: string, enabled = true) {
  return useQuery({
    queryKey: apiKeys.task(tenantId, taskId),
    enabled: Boolean(tenantId) && Boolean(taskId) && enabled,
    queryFn: async () =>
      responseData<ApiTask>(
        await apiClient.GET("/api/v1/tenant/{tenantId}/tasks/{taskId}", {
          params: { path: { tenantId, taskId } },
        }),
      ),
  });
}

export function useCreateTask(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTaskInput) =>
      responseData<ApiTask>(
        await apiClient.POST("/api/v1/tenant/{tenantId}/tasks", {
          params: { path: { tenantId } },
          body: input,
        }),
      ),
    async onSuccess() {
      await queryClient.invalidateQueries({
        queryKey: ["api", "tenant", tenantId, "tasks"],
      });
    },
  });
}

export function useUpdateTask(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      taskId,
      input,
    }: {
      taskId: string;
      input: UpdateTaskInput;
    }) =>
      responseData<ApiTask>(
        await apiClient.PATCH("/api/v1/tenant/{tenantId}/tasks/{taskId}", {
          params: { path: { tenantId, taskId } },
          // The generated type only allows `string | undefined` for
          // projectId/moduleId, but the backend accepts an explicit `null`
          // to clear either link — see TasksService.resolveLinkage.
          body: input as typeof input & { projectId?: string; moduleId?: string },
        }),
      ),
    async onSuccess(task) {
      queryClient.setQueryData(apiKeys.task(tenantId, task.id), task);
      await queryClient.invalidateQueries({
        queryKey: ["api", "tenant", tenantId, "tasks"],
      });
    },
  });
}

export function useDeleteTask(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) =>
      responseData<ApiTask>(
        await apiClient.DELETE("/api/v1/tenant/{tenantId}/tasks/{taskId}", {
          params: { path: { tenantId, taskId } },
        }),
      ),
    async onSuccess() {
      await queryClient.invalidateQueries({
        queryKey: ["api", "tenant", tenantId, "tasks"],
      });
    },
  });
}

const myTasksKey = ["api", "me", "tasks"] as const;
const myTaskKey = (taskId: string) => ["api", "me", "tasks", taskId] as const;

/**
 * Tenant-agnostic: every task the caller can access (creator or explicit
 * task member), regardless of which workspace it lives in. Task visibility
 * never depended on workspace membership, so a task shared with someone
 * outside the owning tenant still needs to be reachable — see
 * MyTasksController on the backend.
 */
export function useMyTasks(enabled = true) {
  return useQuery({
    queryKey: myTasksKey,
    enabled,
    queryFn: async () =>
      responseData<ApiTask[]>(await apiClient.GET("/api/v1/me/tasks")),
  });
}

export function useMyTask(taskId: string, enabled = true) {
  return useQuery({
    queryKey: myTaskKey(taskId),
    enabled: Boolean(taskId) && enabled,
    queryFn: async () =>
      responseData<ApiTask>(
        await apiClient.GET("/api/v1/me/tasks/{taskId}", {
          params: { path: { taskId } },
        }),
      ),
  });
}

export function useUpdateMyTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      taskId,
      input,
    }: {
      taskId: string;
      input: UpdateTaskInput;
    }) =>
      responseData<ApiTask>(
        await apiClient.PATCH("/api/v1/me/tasks/{taskId}", {
          params: { path: { taskId } },
          // See the tenant-scoped useUpdateTask above.
          body: input as typeof input & { projectId?: string; moduleId?: string },
        }),
      ),
    async onSuccess(task) {
      queryClient.setQueryData(myTaskKey(task.id), task);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: myTasksKey }),
        invalidateResourceEverywhere(queryClient, "tasks"),
      ]);
    },
  });
}

export function useDeleteMyTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) =>
      responseData<ApiTask>(
        await apiClient.DELETE("/api/v1/me/tasks/{taskId}", {
          params: { path: { taskId } },
        }),
      ),
    async onSuccess() {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: myTasksKey }),
        invalidateResourceEverywhere(queryClient, "tasks"),
      ]);
    },
  });
}

export function useTaskMembers(
  tenantId: string,
  taskId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: apiKeys.taskMembers(tenantId, taskId),
    enabled: Boolean(tenantId) && Boolean(taskId) && enabled,
    queryFn: async () =>
      responseData<ApiMember[]>(
        await apiClient.GET(
          "/api/v1/tenant/{tenantId}/tasks/{taskId}/members",
          {
            params: { path: { tenantId, taskId } },
          },
        ),
      ),
  });
}

export function useAddTaskMember(tenantId: string, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) =>
      responseData<ApiMember>(
        await apiClient.POST(
          "/api/v1/tenant/{tenantId}/tasks/{taskId}/members",
          {
            params: { path: { tenantId, taskId } },
            body: { userId },
          },
        ),
      ),
    async onSuccess() {
      await queryClient.invalidateQueries({
        queryKey: apiKeys.taskMembers(tenantId, taskId),
      });
    },
  });
}

export function useRemoveTaskMember(tenantId: string, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) =>
      responseData(
        await apiClient.DELETE(
          "/api/v1/tenant/{tenantId}/tasks/{taskId}/members/{userId}",
          { params: { path: { tenantId, taskId, userId } } },
        ),
      ),
    async onSuccess() {
      await queryClient.invalidateQueries({
        queryKey: apiKeys.taskMembers(tenantId, taskId),
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export interface CreateNoteInput {
  title: string;
  content?: string;
  projectId?: string;
  moduleId?: string;
  visibility?: string;
  followUpDate?: string;
}
export type UpdateNoteInput = Omit<Partial<CreateNoteInput>, "projectId" | "moduleId"> & {
  /** `null` clears the link (project unset, or unlinked from its module); omit to leave unchanged. */
  projectId?: string | null;
  moduleId?: string | null;
};

export function useNotes(
  tenantId: string,
  projectId?: string,
  page = 1,
  enabled = true,
) {
  return useQuery({
    queryKey: apiKeys.notes(tenantId, projectId, page),
    enabled: Boolean(tenantId) && enabled,
    queryFn: async () =>
      responseData<PaginatedResponse<ApiNote>>(
        await apiClient.GET("/api/v1/tenant/{tenantId}/notes", {
          params: {
            path: { tenantId },
            // The generated type marks projectId as required even though
            // it is optional at runtime.
            query: {
              ...(projectId ? { projectId } : {}),
              page,
            } as {
              projectId: string;
              page: number;
            },
          },
        }),
      ),
  });
}

export function useNote(tenantId: string, noteId: string, enabled = true) {
  return useQuery({
    queryKey: apiKeys.note(tenantId, noteId),
    enabled: Boolean(tenantId) && Boolean(noteId) && enabled,
    queryFn: async () =>
      responseData<ApiNote>(
        await apiClient.GET("/api/v1/tenant/{tenantId}/notes/{noteId}", {
          params: { path: { tenantId, noteId } },
        }),
      ),
  });
}

export function useCreateNote(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateNoteInput) =>
      responseData<ApiNote>(
        await apiClient.POST("/api/v1/tenant/{tenantId}/notes", {
          params: { path: { tenantId } },
          body: input,
        }),
      ),
    async onSuccess() {
      await queryClient.invalidateQueries({
        queryKey: ["api", "tenant", tenantId, "notes"],
      });
    },
  });
}

export function useUpdateNote(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      noteId,
      input,
    }: {
      noteId: string;
      input: UpdateNoteInput;
    }) =>
      responseData<ApiNote>(
        await apiClient.PATCH("/api/v1/tenant/{tenantId}/notes/{noteId}", {
          params: { path: { tenantId, noteId } },
          // The generated type only allows `string | undefined` for
          // projectId/moduleId, but the backend accepts an explicit `null`
          // to clear either link — see NotesService.resolveLinkage.
          body: input as typeof input & { projectId?: string; moduleId?: string },
        }),
      ),
    async onSuccess(note) {
      queryClient.setQueryData(apiKeys.note(tenantId, note.id), note);
      await queryClient.invalidateQueries({
        queryKey: ["api", "tenant", tenantId, "notes"],
      });
    },
  });
}

export function useDeleteNote(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (noteId: string) =>
      responseData<ApiNote>(
        await apiClient.DELETE("/api/v1/tenant/{tenantId}/notes/{noteId}", {
          params: { path: { tenantId, noteId } },
        }),
      ),
    async onSuccess() {
      await queryClient.invalidateQueries({
        queryKey: ["api", "tenant", tenantId, "notes"],
      });
    },
  });
}

export function useNoteMembers(
  tenantId: string,
  noteId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: apiKeys.noteMembers(tenantId, noteId),
    enabled: Boolean(tenantId) && Boolean(noteId) && enabled,
    queryFn: async () =>
      responseData<ApiMember[]>(
        await apiClient.GET(
          "/api/v1/tenant/{tenantId}/notes/{noteId}/members",
          {
            params: { path: { tenantId, noteId } },
          },
        ),
      ),
  });
}

export function useAddNoteMember(tenantId: string, noteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) =>
      responseData<ApiMember>(
        await apiClient.POST(
          "/api/v1/tenant/{tenantId}/notes/{noteId}/members",
          {
            params: { path: { tenantId, noteId } },
            body: { userId },
          },
        ),
      ),
    async onSuccess() {
      await queryClient.invalidateQueries({
        queryKey: apiKeys.noteMembers(tenantId, noteId),
      });
    },
  });
}

export function useRemoveNoteMember(tenantId: string, noteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) =>
      responseData(
        await apiClient.DELETE(
          "/api/v1/tenant/{tenantId}/notes/{noteId}/members/{userId}",
          { params: { path: { tenantId, noteId, userId } } },
        ),
      ),
    async onSuccess() {
      await queryClient.invalidateQueries({
        queryKey: apiKeys.noteMembers(tenantId, noteId),
      });
    },
  });
}

const myNotesKey = ["api", "me", "notes"] as const;
const myNoteKey = (noteId: string) => ["api", "me", "notes", noteId] as const;

/**
 * Tenant-agnostic: every note the caller can access, regardless of which
 * workspace it lives in — see MyNotesController on the backend.
 */
export function useMyNotes(enabled = true) {
  return useQuery({
    queryKey: myNotesKey,
    enabled,
    queryFn: async () =>
      responseData<ApiNote[]>(await apiClient.GET("/api/v1/me/notes")),
  });
}

export function useMyNote(noteId: string, enabled = true) {
  return useQuery({
    queryKey: myNoteKey(noteId),
    enabled: Boolean(noteId) && enabled,
    queryFn: async () =>
      responseData<ApiNote>(
        await apiClient.GET("/api/v1/me/notes/{noteId}", {
          params: { path: { noteId } },
        }),
      ),
  });
}

export function useUpdateMyNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      noteId,
      input,
    }: {
      noteId: string;
      input: UpdateNoteInput;
    }) =>
      responseData<ApiNote>(
        await apiClient.PATCH("/api/v1/me/notes/{noteId}", {
          params: { path: { noteId } },
          // See the tenant-scoped useUpdateNote above.
          body: input as typeof input & { projectId?: string; moduleId?: string },
        }),
      ),
    async onSuccess(note) {
      queryClient.setQueryData(myNoteKey(note.id), note);
      await queryClient.invalidateQueries({ queryKey: myNotesKey });
    },
  });
}

export function useDeleteMyNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (noteId: string) =>
      responseData<ApiNote>(
        await apiClient.DELETE("/api/v1/me/notes/{noteId}", {
          params: { path: { noteId } },
        }),
      ),
    async onSuccess() {
      await queryClient.invalidateQueries({ queryKey: myNotesKey });
    },
  });
}

// ---------------------------------------------------------------------------
// Conferences
// ---------------------------------------------------------------------------

export function useConferences(
  tenantId: string,
  page = 1,
  enabled = true,
) {
  return useQuery({
    queryKey: apiKeys.conferences(tenantId, page),
    enabled: Boolean(tenantId) && enabled,
    queryFn: () =>
      authenticatedJson<PaginatedResponse<ApiConference>>(
        `/api/v1/tenant/${encodeURIComponent(
          tenantId,
        )}/conferences?page=${page}`,
      ),
  });
}

export function useConference(
  tenantId: string,
  conferenceId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: apiKeys.conference(tenantId, conferenceId),
    enabled: Boolean(tenantId) && Boolean(conferenceId) && enabled,
    queryFn: () =>
      authenticatedJson<ApiConference>(
        `/api/v1/tenant/${encodeURIComponent(tenantId)}/conferences/${encodeURIComponent(conferenceId)}`,
      ),
  });
}

export function useCreateConference(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ConferenceInput) =>
      apiJson<ApiConference>(
        `/api/v1/tenant/${encodeURIComponent(tenantId)}/conferences`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    async onSuccess() {
      await queryClient.invalidateQueries({
        queryKey: apiKeys.conferences(tenantId),
      });
    },
  });
}

export function useUpdateConference(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      conferenceId,
      input,
    }: {
      conferenceId: string;
      input: ConferenceInput;
    }) =>
      apiJson<ApiConference>(
        `/api/v1/tenant/${encodeURIComponent(tenantId)}/conferences/${encodeURIComponent(conferenceId)}`,
        { method: "PATCH", body: JSON.stringify(input) },
      ),
    async onSuccess(conference) {
      queryClient.setQueryData(
        apiKeys.conference(tenantId, conference.id),
        conference,
      );
      await queryClient.invalidateQueries({
        queryKey: apiKeys.conferences(tenantId),
      });
    },
  });
}

export function useDeleteConference(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conferenceId: string) =>
      apiJson<{ message: string; conference: ApiConference }>(
        `/api/v1/tenant/${encodeURIComponent(tenantId)}/conferences/${encodeURIComponent(conferenceId)}`,
        { method: "DELETE" },
      ),
    async onSuccess(_result, conferenceId) {
      queryClient.removeQueries({
        queryKey: apiKeys.conference(tenantId, conferenceId),
      });
      await queryClient.invalidateQueries({
        queryKey: apiKeys.conferences(tenantId),
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Calendar events
// ---------------------------------------------------------------------------

export function useCalendarEvents(
  tenantId: string,
  page = 1,
  enabled = true,
) {
  return useQuery({
    queryKey: apiKeys.calendarEvents(tenantId, page),
    enabled: Boolean(tenantId) && enabled,
    queryFn: async () =>
      responseData<PaginatedResponse<ApiCalendarEvent>>(
        await apiClient.GET("/api/v1/tenant/{tenantId}/calendar-events", {
          params: { path: { tenantId }, query: { page } },
        }),
      ),
  });
}

export function useCreateCalendarEvent(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CalendarEventInput) =>
      responseData<ApiCalendarEvent>(
        await apiClient.POST("/api/v1/tenant/{tenantId}/calendar-events", {
          params: { path: { tenantId } },
          body: input,
        }),
      ),
    async onSuccess() {
      await queryClient.invalidateQueries({
        queryKey: ["api", "tenant", tenantId, "calendar-events"],
      });
    },
  });
}

export function useUpdateCalendarEvent(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      eventId,
      input,
    }: {
      eventId: string;
      input: CalendarEventInput;
    }) =>
      responseData<ApiCalendarEvent>(
        await apiClient.PATCH(
          "/api/v1/tenant/{tenantId}/calendar-events/{eventId}",
          {
            params: { path: { tenantId, eventId } },
            body: input,
          },
        ),
      ),
    async onSuccess() {
      await queryClient.invalidateQueries({
        queryKey: ["api", "tenant", tenantId, "calendar-events"],
      });
    },
  });
}

export function useDeleteCalendarEvent(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (eventId: string) =>
      responseData<{ message: string }>(
        await apiClient.DELETE(
          "/api/v1/tenant/{tenantId}/calendar-events/{eventId}",
          {
            params: { path: { tenantId, eventId } },
          },
        ),
      ),
    async onSuccess() {
      await queryClient.invalidateQueries({
        queryKey: ["api", "tenant", tenantId, "calendar-events"],
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Generic enum values (e.g. module_type)
// ---------------------------------------------------------------------------

export interface ApiEnumValue {
  id: string;
  tenantId: string | null;
  category: string;
  value: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export function useEnumValues(category: string, enabled = true) {
  return useQuery({
    queryKey: ["api", "enum", category] as const,
    enabled: Boolean(category) && enabled,
    queryFn: async () =>
      responseData<ApiEnumValue[]>(
        await apiClient.GET("/api/v1/enum", {
          params: { query: { category } },
        }),
      ),
  });
}

// ---------------------------------------------------------------------------
// User search (platform-wide, not scoped to a tenant)
// ---------------------------------------------------------------------------

export interface ApiUserSearchResult {
  id: string;
  displayName: string;
  email: string;
}

/** Searches all users on the platform by name/email — used to find collaborators to invite, regardless of workspace. */
export function useUserSearch(query: string, enabled = true) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ["api", "users", "search", trimmed] as const,
    enabled: trimmed.length > 0 && enabled,
    queryFn: async () =>
      responseData<ApiUserSearchResult[]>(
        await apiClient.GET("/api/v1/users/search", {
          params: { query: { q: trimmed } },
        }),
      ),
  });
}

// ---------------------------------------------------------------------------
// Pipeline stages
// ---------------------------------------------------------------------------

export interface ApiPipelineStage {
  id: string;
  tenantId: string | null;
  value: string;
  sortOrder: number;
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * The workspace's one shared, ordered paper pipeline stage list — reorder
 * and hide/show only, the 15 stage names themselves are fixed. Returns the
 * tenant's own customized order/visibility if it has one, else the global
 * default list.
 */
export function useModulePipelineStagePool(tenantId: string, enabled = true) {
  return useQuery({
    queryKey: apiKeys.modulePipelineStages(tenantId),
    enabled: Boolean(tenantId) && enabled,
    queryFn: async () =>
      responseData<ApiPipelineStage[]>(
        await apiClient.GET("/api/v1/tenant/{tenantId}/module-pipeline-stages", {
          params: { path: { tenantId } },
        }),
      ),
  });
}

function invitationCollectionPath(
  target: InvitationTarget,
  tenantId: string,
  entityId: string,
) {
  const collection = target === "project" ? "projects" : "modules";
  return `/api/v1/tenant/${encodeURIComponent(tenantId)}/${collection}/${encodeURIComponent(entityId)}/invitations`;
}

function invitationQueryKey(
  target: InvitationTarget,
  tenantId: string,
  entityId: string,
) {
  return target === "project"
    ? apiKeys.projectInvitations(tenantId, entityId)
    : apiKeys.moduleInvitations(tenantId, entityId);
}

export async function inviteCollaboratorByEmail(
  target: InvitationTarget,
  tenantId: string,
  entityId: string,
  email: string,
) {
  return apiJson<CreatedInvitation>(
    invitationCollectionPath(target, tenantId, entityId),
    {
      method: "POST",
      body: JSON.stringify({ email }),
    },
  );
}

export function useCollaboratorInvitations(
  target: InvitationTarget,
  tenantId: string,
  entityId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: invitationQueryKey(target, tenantId, entityId),
    enabled: enabled && Boolean(tenantId && entityId),
    queryFn: () =>
      apiJson<ApiInvitation[]>(
        invitationCollectionPath(target, tenantId, entityId),
      ),
  });
}

export function useInviteCollaborator(
  target: InvitationTarget,
  tenantId: string,
  entityId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) =>
      inviteCollaboratorByEmail(target, tenantId, entityId, email),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: invitationQueryKey(target, tenantId, entityId),
      });
    },
  });
}

export function useRevokeCollaboratorInvitation(
  target: InvitationTarget,
  tenantId: string,
  entityId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) =>
      apiJson<ApiInvitation>(
        `${invitationCollectionPath(target, tenantId, entityId)}/${encodeURIComponent(invitationId)}`,
        { method: "DELETE" },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: invitationQueryKey(target, tenantId, entityId),
      });
    },
  });
}

export function useInvitationPreview(token: string) {
  return useQuery({
    queryKey: apiKeys.invitation(token),
    enabled: Boolean(token),
    retry: false,
    queryFn: () =>
      apiJson<InvitationPreview>(
        `/api/v1/invitations/${encodeURIComponent(token)}`,
      ),
  });
}

export function useAcceptInvitation(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiJson<{ type: InvitationTarget; row: ApiInvitation }>(
        `/api/v1/invitations/${encodeURIComponent(token)}/accept`,
        { method: "POST" },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
    },
  });
}

export function useUpdateModulePipelineStage(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { value: string; hidden: boolean }) =>
      responseData<ApiPipelineStage>(
        await apiClient.PATCH(
          "/api/v1/tenant/{tenantId}/module-pipeline-stages/visibility",
          {
            params: { path: { tenantId } },
            body: input,
          },
        ),
      ),
    async onSuccess() {
      await queryClient.invalidateQueries({
        queryKey: apiKeys.modulePipelineStages(tenantId),
      });
    },
  });
}

export function useReorderModulePipelineStages(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (order: string[]) =>
      responseData<ApiPipelineStage[]>(
        await apiClient.PUT(
          "/api/v1/tenant/{tenantId}/module-pipeline-stages/order",
          {
            params: { path: { tenantId } },
            body: { order },
          },
        ),
      ),
    async onSuccess() {
      await queryClient.invalidateQueries({
        queryKey: apiKeys.modulePipelineStages(tenantId),
      });
    },
  });
}

export function useResetModulePipelineStages(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      responseData<ApiPipelineStage[]>(
        await apiClient.POST(
          "/api/v1/tenant/{tenantId}/module-pipeline-stages/reset",
          {
            params: { path: { tenantId } },
          },
        ),
      ),
    async onSuccess() {
      await queryClient.invalidateQueries({
        queryKey: apiKeys.modulePipelineStages(tenantId),
      });
    },
  });
}

export interface ApiAnalyticsEventInput {
  name: string;
  path?: string;
  properties?: Record<string, string | number | boolean | null>;
}

export interface ApiAnalyticsSummary {
  windowDays: number;
  totalEvents: number;
  byName: { name: string; count: number }[];
  byDay: { day: string; count: number }[];
}

/**
 * Fire-and-forget: analytics must never disrupt the UI, so failures are
 * swallowed rather than surfaced through `isError`/`error`.
 */
export function useTrackEvent(tenantId: string) {
  const mutation = useMutation({
    mutationFn: (input: ApiAnalyticsEventInput) =>
      apiJson<unknown>(
        `/api/v1/tenant/${encodeURIComponent(tenantId)}/analytics/events`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    retry: 0,
  });

  return (input: ApiAnalyticsEventInput) => {
    if (!tenantId) return;
    mutation.mutate(input, { onError: () => undefined });
  };
}

export function useAnalyticsSummary(tenantId: string, days?: number, enabled = true) {
  return useQuery({
    queryKey: ["api", "tenant", tenantId, "analytics", "summary", days ?? 30] as const,
    enabled: Boolean(tenantId) && enabled,
    queryFn: async () =>
      responseData<ApiAnalyticsSummary>(
        await apiClient.GET("/api/v1/tenant/{tenantId}/analytics/summary", {
          params: { path: { tenantId }, query: days ? { days } : {} },
        }),
      ),
  });
}
