export const DASHBOARD_KPIS = [
  { id: "kpi:active-projects", label: "Active Projects" },
  { id: "kpi:active-papers", label: "Active Papers" },
  { id: "kpi:open-tasks", label: "Open Tasks" },
  { id: "kpi:review-stage", label: "In Review Stage" },
  { id: "kpi:current-students", label: "Current Students" },
  { id: "kpi:potential-students", label: "Potential Students" },
] as const;
export type DashboardKpiId = (typeof DASHBOARD_KPIS)[number]["id"];
export function isDashboardKpiId(value: unknown): value is DashboardKpiId {
  return DASHBOARD_KPIS.some((kpi) => kpi.id === value);
}
