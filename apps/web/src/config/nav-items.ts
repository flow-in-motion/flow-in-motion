import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  BookOpen,
  Calendar,
  ClipboardCheck,
  ClipboardList,
  DollarSign,
  FileStack,
  FileText,
  Files,
  FolderKanban,
  GraduationCap,
  LayoutDashboard,
  List,
  Megaphone,
  Network,
  NotebookPen,
  Presentation,
  ShieldCheck,
  Users,
  Workflow,
} from "lucide-react";

export interface NavLeaf {
  label: string;
  to: string;
  end?: boolean;
}

export interface NavEntry extends NavLeaf {
  icon?: LucideIcon;
  children?: NavLeaf[];
}

export interface NavGroup {
  label: string;
  items: NavEntry[];
  collapsible?: boolean;
}

/**
 * Single source of truth for both desktop and mobile navigation.
 */
export const navGroups: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { label: "Dashboard", to: "/", icon: LayoutDashboard, end: true },
      { label: "Major Projects", to: "/projects", icon: FolderKanban },
      { label: "Papers", to: "/modules", icon: FileStack },
      { label: "Tasks", to: "/tasks", icon: ClipboardList },
      { label: "Daily Notes", to: "/daily-notes", icon: NotebookPen },
    ],
  },
  {
    label: "Plan & review",
    items: [
      { label: "Pipeline", to: "/pipeline", icon: Workflow },
      { label: "Calendar", to: "/calendar", icon: Calendar },
      { label: "Conferences", to: "/conferences", icon: Presentation },
      { label: "Mind Map", to: "/mind-map", icon: Network },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Usage", to: "/usage", icon: BarChart3 },
    ],
  },
  {
    label: "Roadmap",
    collapsible: true,
    items: [
      {
        label: "Account Audit",
        to: "/settings/account-audit",
        icon: ShieldCheck,
      },
      { label: "Collaborators", to: "/future/collaborators", icon: Users },
      { label: "CV Builder", to: "/future/cv-builder", icon: FileText },
      { label: "Dissemination", to: "/future/dissemination", icon: Megaphone },
      { label: "Documents", to: "/future/documents", icon: Files },
      { label: "Funding", to: "/future/funding", icon: DollarSign },
      {
        label: "HDR students",
        to: "/future/hdr-students",
        icon: GraduationCap,
      },
      {
        label: "Journal rankings & research lists",
        to: "/future/journal-rankings-research-lists",
        icon: List,
      },
      {
        label: "Log real time activity",
        to: "/future/log-real-time-activity",
        icon: Activity,
      },
      {
        label: "Reviews, HDR examinations",
        to: "/future/reviews-hdr-examinations",
        icon: ClipboardCheck,
      },
      { label: "Teaching", to: "/future/teaching", icon: BookOpen },
    ],
  },
];
