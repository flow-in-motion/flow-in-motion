import { useEffect, useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Crown,
  KeyRound,
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
  useDeleteAccount,
  useDeleteWorkspace,
  useMe,
  useSwitchWorkspace,
  useUpdateMe,
  useWorkspaces,
} from "@/api/hooks";
import { useAuth } from "@/auth/auth-provider";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z
      .string()
      .min(12, "Use at least 12 characters for your new password."),
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "The new passwords do not match.",
  })
  .refine((values) => values.currentPassword !== values.newPassword, {
    path: ["newPassword"],
    message: "Choose a password different from your current password.",
  });

type PasswordForm = z.infer<typeof passwordSchema>;
type PasswordStep = "current" | "new";

export default function SettingsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const me = useMe();
  const workspace = useCurrentWorkspace();
  const workspaces = useWorkspaces();
  const workspaceOptions = workspaces.data?.data ?? [];
  const switchWorkspace = useSwitchWorkspace();
  const createWorkspaceMutation = useCreateWorkspace();
  const deleteWorkspaceMutation = useDeleteWorkspace();
  const deleteAccountMutation = useDeleteAccount();
  const workspaceForm = useForm<WorkspaceForm>({ defaultValues: { name: "" } });
  const passwordForm = useForm<PasswordForm>({
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });
  const designTheme = useDesignTheme();
  const colorTheme = useColorTheme();
  const appearanceTheme = useAppearanceTheme();
  const textSize = useTextSize();
  const updateProfile = useUpdateMe();
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordStep, setPasswordStep] = useState<PasswordStep>("current");
  const [passwordSubmitError, setPasswordSubmitError] = useState<string | null>(null);
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const [deleteAccountDialogOpen, setDeleteAccountDialogOpen] = useState(false);
  const [deleteAccountPassword, setDeleteAccountPassword] = useState("");
  const [deleteAccountConfirmation, setDeleteAccountConfirmation] = useState("");
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);
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

  useEffect(() => {
    if (!location.hash || !workspace.data?.id) return;
    const id = location.hash.slice(1);
    const target = document.getElementById(id);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.hash, workspace.data?.id]);

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

  function resetPasswordDialog() {
    passwordForm.reset();
    passwordForm.clearErrors();
    setPasswordStep("current");
    setPasswordSubmitError(null);
  }

  function openPasswordDialog() {
    resetPasswordDialog();
    setPasswordUpdated(false);
    setPasswordDialogOpen(true);
  }

  function handlePasswordDialogOpenChange(open: boolean) {
    if (!open && isPasswordSubmitting) return;
    setPasswordDialogOpen(open);
    if (!open) resetPasswordDialog();
  }

  async function submitCurrentPassword(values: PasswordForm) {
    passwordForm.clearErrors();
    setPasswordSubmitError(null);

    if (!values.currentPassword) {
      passwordForm.setError("currentPassword", {
        message: "Enter your current password.",
      });
      return;
    }

    setIsPasswordSubmitting(true);
    try {
      await auth.verifyCurrentPassword(values.currentPassword);
      setPasswordStep("new");
    } catch (error) {
      setPasswordSubmitError(
        error instanceof Error ? error.message : "Your current password could not be verified.",
      );
    } finally {
      setIsPasswordSubmitting(false);
    }
  }

  async function submitPasswordChange(values: PasswordForm) {
    passwordForm.clearErrors();
    setPasswordSubmitError(null);

    const parsed = passwordSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof PasswordForm | undefined;
        if (field) passwordForm.setError(field, { message: issue.message });
      }
      return;
    }

    setIsPasswordSubmitting(true);
    try {
      await auth.updatePassword(parsed.data.newPassword);
      setPasswordDialogOpen(false);
      passwordForm.reset();
      setPasswordStep("current");
      setPasswordUpdated(true);
    } catch (error) {
      setPasswordSubmitError(
        error instanceof Error ? error.message : "Your password could not be changed.",
      );
    } finally {
      setIsPasswordSubmitting(false);
    }
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

  function resetDeleteAccountDialog() {
    setDeleteAccountPassword("");
    setDeleteAccountConfirmation("");
    setDeleteAccountError(null);
  }

  function handleDeleteAccountDialogOpenChange(open: boolean) {
    if (!open && deleteAccountMutation.isPending) return;
    setDeleteAccountDialogOpen(open);
    if (!open) resetDeleteAccountDialog();
  }

  async function submitDeleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDeleteAccountError(null);

    if (deleteAccountConfirmation !== "DELETE") {
      setDeleteAccountError('Type "DELETE" exactly to confirm.');
      return;
    }

    try {
      await auth.verifyCurrentPassword(deleteAccountPassword);
      await deleteAccountMutation.mutateAsync();
      await auth.clearLocalSession().catch(() => undefined);
      navigate("/sign-in", {
        replace: true,
        state: { accountDeleted: true },
      });
    } catch (error) {
      setDeleteAccountError(
        error instanceof Error ? error.message : "Your account could not be deleted.",
      );
    }
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
          <Card className="order-1">
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

          <Card className="order-5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                Change password
              </CardTitle>
              <CardDescription>
                Confirm your current password, then choose a new password with at least 12
                characters.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {passwordUpdated ? (
                <p
                  role="status"
                  className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400"
                >
                  <CheckCircle2 className="h-4 w-4" /> Password changed successfully.
                </p>
              ) : null}
              <Button type="button" className="w-fit" onClick={openPasswordDialog}>
                <KeyRound className="h-4 w-4" />
                Change password
              </Button>
            </CardContent>
          </Card>

          <Dialog open={passwordDialogOpen} onOpenChange={handlePasswordDialogOpenChange}>
            <DialogContent className="max-w-sm">
              {passwordStep === "current" ? (
                <form
                  className="grid gap-5"
                  onSubmit={passwordForm.handleSubmit(submitCurrentPassword)}
                >
                  <DialogHeader>
                    <DialogTitle>Confirm current password</DialogTitle>
                    <DialogDescription>
                      Enter your current password before choosing a new one.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-2">
                    <label htmlFor="current-password" className="text-sm font-medium">
                      Current password
                    </label>
                    <Input
                      id="current-password"
                      type="password"
                      autoComplete="current-password"
                      required
                      {...passwordForm.register("currentPassword")}
                    />
                    {passwordForm.formState.errors.currentPassword ? (
                      <p role="alert" className="text-xs text-destructive">
                        {passwordForm.formState.errors.currentPassword.message}
                      </p>
                    ) : null}
                  </div>
                  {passwordSubmitError ? (
                    <p role="alert" className="text-sm text-destructive">
                      {passwordSubmitError}
                    </p>
                  ) : null}
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isPasswordSubmitting}
                      onClick={() => handlePasswordDialogOpenChange(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isPasswordSubmitting}>
                      {isPasswordSubmitting ? "Checking…" : "Continue"}
                    </Button>
                  </DialogFooter>
                </form>
              ) : (
                <form
                  className="grid gap-5"
                  onSubmit={passwordForm.handleSubmit(submitPasswordChange)}
                >
                  <DialogHeader>
                    <DialogTitle>Choose a new password</DialogTitle>
                    <DialogDescription>
                      Use at least 12 characters and enter the same password twice.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-2">
                    <label htmlFor="settings-new-password" className="text-sm font-medium">
                      New password
                    </label>
                    <Input
                      id="settings-new-password"
                      type="password"
                      autoComplete="new-password"
                      minLength={12}
                      required
                      {...passwordForm.register("newPassword")}
                    />
                    {passwordForm.formState.errors.newPassword ? (
                      <p role="alert" className="text-xs text-destructive">
                        {passwordForm.formState.errors.newPassword.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="settings-confirm-password" className="text-sm font-medium">
                      Confirm new password
                    </label>
                    <Input
                      id="settings-confirm-password"
                      type="password"
                      autoComplete="new-password"
                      minLength={12}
                      required
                      {...passwordForm.register("confirmPassword")}
                    />
                    {passwordForm.formState.errors.confirmPassword ? (
                      <p role="alert" className="text-xs text-destructive">
                        {passwordForm.formState.errors.confirmPassword.message}
                      </p>
                    ) : null}
                  </div>
                  {passwordSubmitError ? (
                    <p role="alert" className="text-sm text-destructive">
                      {passwordSubmitError}
                    </p>
                  ) : null}
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isPasswordSubmitting}
                      onClick={() => {
                        passwordForm.clearErrors();
                        setPasswordSubmitError(null);
                        setPasswordStep("current");
                      }}
                    >
                      Back
                    </Button>
                    <Button type="submit" disabled={isPasswordSubmitting}>
                      {isPasswordSubmitting ? "Saving…" : "Save new password"}
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </DialogContent>
          </Dialog>

          <Card className="order-4">
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

          <Card className="order-6 border-destructive/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Delete account
              </CardTitle>
              <CardDescription>
                Permanently remove your account and all data connected to it. This cannot be
                undone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  resetDeleteAccountDialog();
                  setDeleteAccountDialogOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4" />
                Delete account
              </Button>
            </CardContent>
          </Card>

          <Dialog
            open={deleteAccountDialogOpen}
            onOpenChange={handleDeleteAccountDialogOpenChange}
          >
            <DialogContent className="max-w-md">
              <form className="grid gap-5" onSubmit={submitDeleteAccount}>
                <DialogHeader>
                  <DialogTitle className="text-destructive">
                    Permanently delete your account?
                  </DialogTitle>
                  <DialogDescription>
                    This action is irreversible. Your Supabase login and application data will
                    be removed.
                  </DialogDescription>
                </DialogHeader>

                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
                  <p className="font-semibold text-destructive">This permanently deletes:</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                    <li>Your profile, preferences, memberships, and collaborator access</li>
                    <li>Workspaces you own and everything stored in them</li>
                    <li>Projects, papers, tasks, notes, conferences, and invitations you own</li>
                  </ul>
                </div>

                <div className="grid gap-2">
                  <label htmlFor="delete-account-password" className="text-sm font-medium">
                    Current password
                  </label>
                  <Input
                    id="delete-account-password"
                    type="password"
                    autoComplete="current-password"
                    value={deleteAccountPassword}
                    onChange={(event) => setDeleteAccountPassword(event.target.value)}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <label htmlFor="delete-account-confirmation" className="text-sm font-medium">
                    Type DELETE to confirm
                  </label>
                  <Input
                    id="delete-account-confirmation"
                    value={deleteAccountConfirmation}
                    onChange={(event) => setDeleteAccountConfirmation(event.target.value)}
                    autoComplete="off"
                    required
                  />
                </div>

                {deleteAccountError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {deleteAccountError}
                  </p>
                ) : null}

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={deleteAccountMutation.isPending}
                    onClick={() => handleDeleteAccountDialogOpenChange(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="destructive"
                    disabled={!deleteAccountPassword || deleteAccountMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                    {deleteAccountMutation.isPending
                      ? "Deleting account…"
                      : "Permanently delete account"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Card className="order-2">
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

          <Card className="order-3">
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
        <div id="paper-pipeline-stages" className="mx-auto mt-7 w-full max-w-5xl scroll-mt-6">
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
