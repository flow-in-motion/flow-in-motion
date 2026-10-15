import { createHash } from "node:crypto";

const PAGE_LABELS = {
  dashboard: "Dashboard",
  projects: "Projects",
  project_archive: "Project archive",
  papers: "Papers",
  tasks: "Tasks",
  notes: "Notes",
  pipeline: "Pipeline",
  calendar: "Calendar",
  conferences: "Conferences / events",
  funding: "Funding",
  mind_map: "Mind Map",
  future_features: "Future features",
  settings: "Settings",
  usage: "Usage",
  site_map: "Site map",
  legacy_unclassified: "Older activity (unclassified)",
  other: "Other",
};

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function toCsv(rows, columns) {
  const cell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [
    columns.map(({ label }) => cell(label)).join(","),
    ...rows.map((row) => columns.map(({ key }) => cell(row[key])).join(",")),
  ].join("\n");
}

export function participantLabel(row, deidentified = false) {
  if (deidentified) {
    const code = createHash("sha256")
      .update(row.user_id)
      .digest("hex")
      .slice(0, 10);
    return `Participant ${code}`;
  }

  return row.display_name || row.full_name || row.email || "Unnamed user";
}

export function pageLabel(pageKey, featureKey) {
  const label = PAGE_LABELS[pageKey] ?? PAGE_LABELS.other;
  return featureKey ? `${label}: ${featureKey.replaceAll("_", " ")}` : label;
}

function number(value) {
  return Number(value ?? 0);
}

function table(headers, rows) {
  const head = headers
    .map((header) => `<th>${escapeHtml(header.label)}</th>`)
    .join("");
  const body = rows.length
    ? rows
        .map(
          (row) =>
            `<tr>${headers
              .map((header) => `<td>${escapeHtml(row[header.key] ?? "—")}</td>`)
              .join("")}</tr>`,
        )
        .join("")
    : `<tr><td colspan="${headers.length}">No data for this period.</td></tr>`;
  return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

export function buildUsageReport({
  generatedAt,
  weeks,
  totals,
  weeklyActivity,
  pageVisits,
  snapshots,
  unattributedPapers,
  deidentified = false,
}) {
  const snapshotsByUserWeek = new Map(
    snapshots.map((row) => [
      `${row.tenant_id}:${row.user_id}:${row.week_start}`,
      row,
    ]),
  );
  const weeklyRows = weeklyActivity.map((row) => {
    const snapshot = snapshotsByUserWeek.get(
      `${row.tenant_id}:${row.user_id}:${row.week_start}`,
    );
    return {
      week: row.week_start,
      workspace: row.tenant_name,
      participant: participantLabel(row, deidentified),
      sessions: number(row.sessions),
      activeDays: number(row.active_days),
      pageViews: number(row.page_views),
      projects: snapshot ? number(snapshot.project_count) : "Not captured",
      papers: snapshot ? number(snapshot.paper_count) : "Not captured",
      tasks: snapshot ? number(snapshot.task_count) : "Not captured",
      notes: snapshot ? number(snapshot.note_count) : "Not captured",
    };
  });

  const pageRows = pageVisits.map((row) => ({
    week: row.week_start,
    workspace: row.tenant_name,
    participant: participantLabel(row, deidentified),
    page: pageLabel(row.page_key, row.feature_key),
    visits: number(row.visits),
  }));

  const platformPages = new Map();
  for (const row of pageRows) {
    platformPages.set(
      row.page,
      (platformPages.get(row.page) ?? 0) + row.visits,
    );
  }
  const platformPageRows = [...platformPages]
    .map(([page, visits]) => ({ page, visits }))
    .sort(
      (left, right) =>
        right.visits - left.visits || left.page.localeCompare(right.page),
    );

  const platformWeeks = new Map();
  for (const row of weeklyActivity) {
    const current = platformWeeks.get(row.week_start) ?? {
      week: row.week_start,
      participants: new Set(),
      sessions: 0,
      activeDays: 0,
      pageViews: 0,
    };
    current.participants.add(row.user_id);
    current.sessions += number(row.sessions);
    current.activeDays += number(row.active_days);
    current.pageViews += number(row.page_views);
    platformWeeks.set(row.week_start, current);
  }
  const platformWeekRows = [...platformWeeks.values()]
    .map((row) => ({ ...row, activeUsers: row.participants.size }))
    .sort((left, right) => right.week.localeCompare(left.week));

  const snapshotRows = snapshots.map((row) => ({
    week: row.week_start,
    workspace: row.tenant_name,
    participant: participantLabel(row, deidentified),
    projects: number(row.project_count),
    papers: number(row.paper_count),
    tasks: number(row.task_count),
    notes: number(row.note_count),
  }));

  const activeThisWeek = new Set(
    weeklyActivity
      .filter((row) => row.week_start === totals.current_week)
      .map((row) => row.user_id),
  ).size;
  const currentWeekSessions = weeklyActivity
    .filter((row) => row.week_start === totals.current_week)
    .reduce((sum, row) => sum + number(row.sessions), 0);
  const unattributedTotal = unattributedPapers.reduce(
    (sum, row) => sum + number(row.paper_count),
    0,
  );

  const weeklyHeaders = [
    { key: "week", label: "Week starting" },
    { key: "workspace", label: "Workspace" },
    { key: "participant", label: "User" },
    { key: "sessions", label: "Uses (sessions)" },
    { key: "activeDays", label: "Active days" },
    { key: "pageViews", label: "Page visits" },
    { key: "projects", label: "Projects" },
    { key: "papers", label: "Papers" },
    { key: "tasks", label: "Tasks" },
    { key: "notes", label: "Notes" },
  ];
  const pageHeaders = [
    { key: "week", label: "Week starting" },
    { key: "workspace", label: "Workspace" },
    { key: "participant", label: "User" },
    { key: "page", label: "Page" },
    { key: "visits", label: "Visits" },
  ];
  const platformWeekHeaders = [
    { key: "week", label: "Week starting" },
    { key: "activeUsers", label: "Active users" },
    { key: "sessions", label: "Uses (sessions)" },
    { key: "activeDays", label: "Total active-user days" },
    { key: "pageViews", label: "Page visits" },
  ];
  const platformPageHeaders = [
    { key: "page", label: "Page" },
    { key: "visits", label: "Visits" },
  ];
  const inventoryHeaders = weeklyHeaders.filter((header) =>
    [
      "week",
      "workspace",
      "participant",
      "projects",
      "papers",
      "tasks",
      "notes",
    ].includes(header.key),
  );

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Flow usage research report</title>
<style>
body{font:14px/1.45 system-ui,sans-serif;color:#172033;background:#f5f7fa;margin:0;padding:32px}main{max-width:1400px;margin:auto}h1{margin:0 0 4px;font-size:28px}h2{margin:32px 0 10px;font-size:20px}.muted{color:#667085}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:24px 0}.card{background:#fff;border:1px solid #e4e7ec;border-radius:10px;padding:16px}.card strong{display:block;font-size:28px}.table-wrap{overflow:auto;background:#fff;border:1px solid #e4e7ec;border-radius:10px}table{border-collapse:collapse;width:100%;white-space:nowrap}th,td{text-align:left;padding:9px 12px;border-bottom:1px solid #eaecf0}th{background:#f9fafb;position:sticky;top:0}section.note{background:#fff8e7;border:1px solid #f2d58a;border-radius:10px;padding:14px;margin-top:24px}code{font-size:12px}</style></head>
<body><main><h1>Flow usage research report</h1><p class="muted">Generated ${escapeHtml(generatedAt)} · Last ${escapeHtml(weeks)} weeks · Times grouped in Australia/Sydney</p>
<div class="cards"><div class="card"><strong>${number(totals.registered_users)}</strong>Registered users</div><div class="card"><strong>${number(totals.ever_active_users)}</strong>Users who have used Flow</div><div class="card"><strong>${activeThisWeek}</strong>Active users this week</div><div class="card"><strong>${currentWeekSessions}</strong>Uses this week</div></div>
<section class="note"><strong>How to read this report.</strong> A “use” is one session; a new session begins after 30 minutes without activity. Page visits never include record IDs or search text. Counts are private weekly snapshots and are not displayed inside Flow.</section>
<h2>Platform activity by week</h2>${table(platformWeekHeaders, platformWeekRows)}
<h2>Pages visited across the platform</h2>${table(platformPageHeaders, platformPageRows)}
<h2>Weekly activity by user</h2>${table(weeklyHeaders, weeklyRows)}
<h2>Page visits by user</h2>${table(pageHeaders, pageRows)}
<h2>Weekly item counts</h2>${table(inventoryHeaders, snapshotRows)}
<section class="note"><strong>Data note.</strong> ${unattributedTotal} paper(s) created before creator tracking have no reliable individual owner and are excluded from individual paper counts. Session totals begin when this research tracking version is released; older events without page categories appear as “Older activity (unclassified)”. Blank weekly counts mean the snapshot had not yet been captured.</section>
</main></body></html>`;

  return {
    html,
    weeklyRows,
    pageRows,
    snapshotRows,
    platformWeekRows,
    platformPageRows,
  };
}
