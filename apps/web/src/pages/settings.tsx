import { useEffect, useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Crown,
  LayoutTemplate,
  Mail,
  Map,
  Moon,
  Palette,
  Plus,
  Save,
  Settings as SettingsIcon,
  ShieldCheck,
  Sun,
  Type as TextSizeIcon,
  Trash2,
  UserRound,
} from "lucide-react";
import { z } from "zod";

import {
  useCreateWorkspace,
  useCurrentWorkspace,
  useDeleteWorkspace,
  useMe,
  useSwitchWorkspace,
  useUpdateMe,
  useWorkspaces,
} from "@/api/hooks";
import { PaperStageSettings } from "@/components/settings/paper-stage-settings";
import { WorkspaceMembers } from "@/components/settings/workspace-members";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeading } from "@/components/typography/heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { COLOR_THEMES, type ColorTheme, useColorTheme } from "@/theme/color-theme";
import { APPEARANCE_THEMES, useAppearanceTheme } from "@/theme/appearance-theme";
import { DESIGN_THEMES, useDesignTheme } from "@/theme/design-theme";
import { TEXT_SIZES, useTextSize } from "@/theme/text-size";

const workspaceSchema = z.object({
  name: z.string().trim().min(2, "Use at least 2 characters.").max(100),
});

type WorkspaceForm = z.infer<typeof workspaceSchema>;

export default function SettingsPage() {
  const me = useMe();
  const workspace = useCurrentWorkspace();
  const workspaces = useWorkspaces();
  const workspaceOptions = workspaces.data?.data ?? [];
  const switchWorkspace = useSwitchWorkspace();
  const createWorkspaceMutation = useCreateWorkspace();
  const deleteWorkspaceMutation = useDeleteWorkspace();
  const workspaceForm = useForm<WorkspaceForm>({ defaultValues: { name: "" } });
  const designTheme = useDesignTheme();
  const colorTheme = useColorTheme();
  const appearanceTheme = useAppearanceTheme();
  const textSize = useTextSize();
  const updateProfile = useUpdateMe();
  const [profile, setProfile] = useState({
    displayName: "",
    jobTitle: "",
    institution: "",
    department: "",
    phone: "",
    researchInterests: "",
  });

  useEffect(() => {
    if (!me.data) return;
    setProfile({
      displayName: me.data.displayName,
      jobTitle: me.data.jobTitle ?? "",
      institution: me.data.institution ?? "",
      department: me.data.department ?? "",
      phone: me.data.phone ?? "",
      researchInterests: me.data.researchInterests ?? "",
    });
  }, [me.data]);

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateProfile.mutate(profile);
  }

  async function submitCreateWorkspace(values: WorkspaceForm) {
    const parsed = workspaceSchema.safeParse(values);
    if (!parsed.success) {
      workspaceForm.setError("name", { message: parsed.error.issues[0]?.message });
      return;
    }

    await createWorkspaceMutation
      .mutateAsync(parsed.data.name)
      .then(() => workspaceForm.reset())
      .catch(() => undefined);
  }

  async function switchToWorkspace(workspaceId: string) {
    await switchWorkspace.mutateAsync(workspaceId);
  }

  async function deleteWorkspace(workspaceId: string, name: string) {
    const confirmed = window.confirm(
      `Permanently delete "${name}"? This deletes every project, module, task, and note in it. This cannot be undone.`,
    );
    if (!confirmed) return;
    await deleteWorkspaceMutation.mutateAsync(workspaceId).catch(() => undefined);
  }

  if (me.isPending || workspace.isPending) {
    return (
      <LoadingState title="Loading your settings" className="min-h-[50vh]" />
    );
  }
  if (me.isError) {
    return (
      <ErrorState
        title="Your profile could not be loaded"
        description={me.error.message}
        onRetry={() => void me.refetch()}
      />
    );
  }

  return (
    <div className="min-h-full pb-12">
      <div className="mx-auto w-full max-w-5xl">
        <PageHeading
          tone="cyan"
          icon={SettingsIcon}
          title="Settings"
          description="Review your authenticated account and manage the active workspace."
          actions={
            <Button variant="outline" asChild>
              <Link to="/site-map">
                <Map className="h-4 w-4" />
                Site map
              </Link>
            </Button>
          }
        />
      </div>

      {me.data.profileComplete ? null : (
        <div
          role="alert"
          className="mx-auto mt-7 flex w-full max-w-5xl items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="font-semibold">Complete your profile</p>
            <p className="mt-1 text-sm">
              Add your job title, institution, and department. The alert beside Settings will
              disappear when these required details are saved.
            </p>
          </div>
        </div>
      )}

      <div className="mx-auto mt-7 grid w-full max-w-5xl gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="h-5 w-5 text-primary" />
              Profile
            </CardTitle>
            <CardDescription>
              Your name and email are collected during registration. Add your professional
              details here after signing in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveProfile} className="grid gap-5">
              <div className="grid gap-2">
                <label htmlFor="display-name" className="text-sm font-medium">
                  Name <span className="text-destructive">*</span>
                </label>
                <Input
                  id="display-name"
                  value={profile.displayName}
                  onChange={(event) =>
                    setProfile((current) => ({ ...current, displayName: event.target.value }))
                  }
                  minLength={2}
                  maxLength={100}
                  required
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="email" className="text-sm font-medium">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={me.data.email}
                    readOnly
                    className="bg-muted/30 pl-9"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <label htmlFor="job-title" className="text-sm font-medium">
                    Job title <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="job-title"
                    value={profile.jobTitle}
                    onChange={(event) =>
                      setProfile((current) => ({ ...current, jobTitle: event.target.value }))
                    }
                    placeholder="Research Fellow"
                    maxLength={120}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="institution" className="text-sm font-medium">
                    Institution <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="institution"
                    value={profile.institution}
                    onChange={(event) =>
                      setProfile((current) => ({ ...current, institution: event.target.value }))
                    }
                    placeholder="University or organisation"
                    maxLength={200}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="department" className="text-sm font-medium">
                    Department <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="department"
                    value={profile.department}
                    onChange={(event) =>
                      setProfile((current) => ({ ...current, department: event.target.value }))
                    }
                    placeholder="School or department"
                    maxLength={200}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="phone" className="text-sm font-medium">Phone</label>
                  <Input
                    id="phone"
                    type="tel"
                    value={profile.phone}
                    onChange={(event) =>
                      setProfile((current) => ({ ...current, phone: event.target.value }))
                    }
                    placeholder="+61 400 000 000"
                    maxLength={40}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <label htmlFor="research-interests" className="text-sm font-medium">
                  Research interests
                </label>
                <Textarea
                  id="research-interests"
                  value={profile.researchInterests}
                  onChange={(event) =>
                    setProfile((current) => ({ ...current, researchInterests: event.target.value }))
                  }
                  placeholder="Research areas, methods, or topics"
                  maxLength={1000}
                  rows={3}
                />
              </div>
              {updateProfile.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  {updateProfile.error.message}
                </p>
              ) : null}
              {updateProfile.isSuccess && me.data.profileComplete ? (
                <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" /> Profile saved.
                </p>
              ) : null}
              <Button type="submit" className="w-fit" disabled={updateProfile.isPending}>
                <Save />
                {updateProfile.isPending ? "Saving…" : "Save Profile"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {appearanceTheme.theme === "dark" ? <Moon className="h-5 w-5 text-primary" /> : <Sun className="h-5 w-5 text-primary" />}
                Appearance
              </CardTitle>
              <CardDescription>
                Choose a light or dark interface. This does not change your layout or accent color.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              {APPEARANCE_THEMES.map((option) => {
                const isSelected = appearanceTheme.theme === option.value;
                const Icon = option.value === "light" ? Sun : Moon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => appearanceTheme.setTheme(option.value)}
                    aria-pressed={isSelected}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-colors hover:bg-accent/50",
                      isSelected && "border-primary bg-primary/5 ring-1 ring-primary",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {option.label}
                  </button>
                );
              })}
              <p className="col-span-2 text-xs leading-5 text-muted-foreground">
                This preference is saved in this browser and applied immediately.
              </p>
              <div className="col-span-2 mt-2 border-t border-border pt-4">
                <div className="mb-3 flex items-center gap-2">
                  <TextSizeIcon className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Text size</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {TEXT_SIZES.map((option) => {
                    const isSelected = textSize.size === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => textSize.setSize(option.value)}
                        aria-pressed={isSelected}
                        className={cn(
                          "rounded-lg border px-2 py-2.5 text-center font-medium transition-colors hover:bg-accent/50",
                          option.value === "small" && "text-xs",
                          option.value === "default" && "text-sm",
                          option.value === "large" && "text-base",
                          isSelected && "border-primary bg-primary/5 ring-1 ring-primary",
                        )}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Account status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline" className="capitalize">
                {me.data.status}
              </Badge>
              <p className="mt-3 break-all font-mono text-xs text-muted-foreground">
                User ID: {me.data.id}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutTemplate className="h-5 w-5 text-primary" />
                Design theme
              </CardTitle>
              <CardDescription>
                Pick the layout, navigation pattern, spacing, and typographic character. Your
                selected colour theme is applied across each design.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {DESIGN_THEMES.map((option) => {
                const isSelected = designTheme.theme === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => designTheme.setTheme(option.value)}
                    aria-pressed={isSelected}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent/50",
                      isSelected && "border-primary ring-1 ring-primary",
                    )}
                  >
                    <div
                      data-design-theme={option.value}
                      aria-hidden="true"
                      className="pointer-events-none flex h-14 w-20 shrink-0 overflow-hidden rounded-[var(--radius)] border bg-background"
                    >
                      {option.layout === "topnav" ? (
                        <div className="flex w-full flex-col">
                          <div className="h-3 w-full bg-primary" />
                          <div className="flex-1 p-1.5">
                            <div className="h-full rounded-[var(--radius)] border bg-card shadow-sm" />
                          </div>
                        </div>
                      ) : option.layout === "sidebar-compact" ? (
                        <div className="flex h-full w-full">
                          <div className="flex h-full w-3.5 flex-col items-center gap-1 bg-primary py-1.5">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground/80" />
                            <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground/50" />
                            <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground/50" />
                          </div>
                          <div className="flex-1 p-1.5">
                            <div className="h-full rounded-[var(--radius)] border bg-card shadow-sm" />
                          </div>
                        </div>
                      ) : (
                        <div className="flex h-full w-full">
                          <div className="h-full w-4 bg-primary" />
                          <div className="flex-1 p-1.5">
                            <div className="h-full rounded-[var(--radius)] border bg-card shadow-sm" />
                          </div>
                        </div>
                      )}
                    </div>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-foreground">
                          {option.label}
                        </span>
                        {isSelected ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                        ) : null}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    </span>
                  </button>
                );
              })}
              <p className="text-xs leading-5 text-muted-foreground">
                This preference is saved in this browser and applied immediately.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                Color theme
              </CardTitle>
              <CardDescription>
                Choose the colour wash used across navigation, the workspace canvas, active states,
                and pipeline accents.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <label htmlFor="color-theme" className="text-sm font-medium">
                Theme
              </label>
              <Select
                value={colorTheme.theme}
                onValueChange={(value) => colorTheme.setTheme(value as ColorTheme)}
              >
                <SelectTrigger id="color-theme">
                  <SelectValue placeholder="Select a color theme" />
                </SelectTrigger>
                <SelectContent>
                  {COLOR_THEMES.map((theme) => (
                    <SelectItem key={theme.value} value={theme.value}>
                      {theme.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs leading-5 text-muted-foreground">
                This preference is saved in this browser and applied immediately.
              </p>
            </CardContent>
          </Card>

        </div>
      </div>

      <div className="mx-auto mt-7 w-full max-w-5xl">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Workspaces
                </CardTitle>
                <CardDescription>
                  Every research workspace you can access, and switching between them.
                </CardDescription>
              </div>
              {workspaces.data ? (
                <Badge variant="outline" className="w-fit px-3 py-1">
                  {workspaceOptions.length}{" "}
                  {workspaceOptions.length === 1 ? "workspace" : "workspaces"}
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="grid gap-6">
            {workspaces.isPending ? (
              <LoadingState title="Loading your workspaces" className="min-h-[30vh]" />
            ) : workspaces.isError ? (
              <ErrorState
                title="Your workspaces could not be loaded"
                description={workspaces.error.message}
                onRetry={() => void workspaces.refetch()}
              />
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {workspaceOptions.map((option) => {
                    const isCurrent = option.id === workspace.data?.id;
                    const isSwitching =
                      switchWorkspace.isPending && switchWorkspace.variables === option.id;
                    const isDeleting =
                      deleteWorkspaceMutation.isPending &&
                      deleteWorkspaceMutation.variables === option.id;

                    return (
                      <Card
                        key={option.id}
                        className={
                          isCurrent
                            ? "border-primary/40 bg-accent/35"
                            : "transition-colors hover:border-primary/20 hover:bg-muted/35"
                        }
                      >
                        <CardHeader>
                          <div className="flex items-start justify-between gap-4">
                            <span className="rounded-xl bg-primary/10 p-3 text-primary">
                              <Building2 className="h-5 w-5" />
                            </span>
                            {isCurrent ? (
                              <Badge className="gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Current
                              </Badge>
                            ) : null}
                          </div>
                          <CardTitle className="pt-2">{option.name}</CardTitle>
                          <CardDescription className="truncate">{option.slug}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="mb-5 flex items-center gap-2 text-sm text-muted-foreground">
                            <Crown className="h-4 w-4 text-amber-500" />
                            <span>Owner</span>
                          </div>
                          <Button
                            className="w-full"
                            variant={isCurrent ? "outline" : "default"}
                            disabled={
                              isCurrent || switchWorkspace.isPending || deleteWorkspaceMutation.isPending
                            }
                            onClick={() => void switchToWorkspace(option.id)}
                          >
                            {isCurrent
                              ? "Active workspace"
                              : isSwitching
                                ? "Switching…"
                                : "Switch workspace"}
                            {!isCurrent && !isSwitching ? <ArrowRight className="h-4 w-4" /> : null}
                          </Button>
                          <Button
                            className="mt-2 w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                            variant="ghost"
                            disabled={switchWorkspace.isPending || deleteWorkspaceMutation.isPending}
                            onClick={() => void deleteWorkspace(option.id, option.name)}
                          >
                            <Trash2 className="h-4 w-4" />
                            {isDeleting ? "Deleting…" : "Delete workspace"}
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                {switchWorkspace.isError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {switchWorkspace.error.message}
                  </p>
                ) : null}
                {deleteWorkspaceMutation.isError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {deleteWorkspaceMutation.error.message}
                  </p>
                ) : null}

                <div className="border-t pt-6">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Plus className="h-4 w-4 text-primary" />
                    Create another workspace
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    You will become the owner and the new workspace will become active.
                  </p>
                  <form
                    className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start"
                    onSubmit={workspaceForm.handleSubmit(submitCreateWorkspace)}
                  >
                    <div className="flex-1">
                      <label htmlFor="new-workspace-name" className="sr-only">
                        Workspace name
                      </label>
                      <Input
                        id="new-workspace-name"
                        placeholder="Workspace name"
                        {...workspaceForm.register("name")}
                      />
                      {workspaceForm.formState.errors.name ? (
                        <p role="alert" className="mt-1 text-xs text-destructive">
                          {workspaceForm.formState.errors.name.message}
                        </p>
                      ) : null}
                    </div>
                    <Button type="submit" disabled={createWorkspaceMutation.isPending}>
                      {createWorkspaceMutation.isPending ? "Creating…" : "Create workspace"}
                    </Button>
                  </form>
                  {createWorkspaceMutation.isError ? (
                    <p role="alert" className="mt-3 text-sm text-destructive">
                      {createWorkspaceMutation.error.message}
                    </p>
                  ) : null}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {workspace.data?.id ? (
        <div className="mx-auto mt-7 w-full max-w-5xl">
          <PaperStageSettings tenantId={workspace.data.id} />
        </div>
      ) : null}

      <WorkspaceMembers />

      <p className="mx-auto mt-2 flex w-full max-w-5xl flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <Link to="/terms" className="underline underline-offset-2 hover:text-foreground">
          Terms of Service
        </Link>
        <Link to="/privacy" className="underline underline-offset-2 hover:text-foreground">
          Privacy Policy
        </Link>
      </p>
    </div>
  );
}
