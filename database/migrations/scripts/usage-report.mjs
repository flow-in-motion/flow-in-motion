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
  days,
  totals,
  dailyActivity,
  pageVisits,
  snapshots,
  unattributedPapers,
  deidentified = false,
}) {
  const snapshotsByUserDate = new Map(
    snapshots.map((row) => [
      `${row.tenant_id}:${row.user_id}:${row.snapshot_date}`,
      row,
    ]),
  );
  const dailyRows = dailyActivity.map((row) => {
    const snapshot = snapshotsByUserDate.get(
      `${row.tenant_id}:${row.user_id}:${row.activity_date}`,
    );
    return {
      date: row.activity_date,
      workspace: row.tenant_name,
      participant: participantLabel(row, deidentified),
      sessions: number(row.sessions),
      pageViews: number(row.page_views),
      projects: snapshot ? number(snapshot.project_count) : "Not captured",
      papers: snapshot ? number(snapshot.paper_count) : "Not captured",
      tasks: snapshot ? number(snapshot.task_count) : "Not captured",
      notes: snapshot ? number(snapshot.note_count) : "Not captured",
    };
  });

  const pageRows = pageVisits.map((row) => ({
    date: row.activity_date,
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

  const platformDays = new Map();
  for (const row of dailyActivity) {
    const current = platformDays.get(row.activity_date) ?? {
      date: row.activity_date,
      participants: new Set(),
      sessions: 0,
      pageViews: 0,
    };
    current.participants.add(row.user_id);
    current.sessions += number(row.sessions);
    current.pageViews += number(row.page_views);
    platformDays.set(row.activity_date, current);
  }
  const platformDayRows = [...platformDays.values()]
    .map((row) => ({ ...row, activeUsers: row.participants.size }))
    .sort((left, right) => right.date.localeCompare(left.date));

  const snapshotRows = snapshots.map((row) => ({
    date: row.snapshot_date,
    workspace: row.tenant_name,
    participant: participantLabel(row, deidentified),
    projects: number(row.project_count),
    papers: number(row.paper_count),
    tasks: number(row.task_count),
    notes: number(row.note_count),
  }));

  const activeToday = new Set(
    dailyActivity
      .filter((row) => row.activity_date === totals.current_day)
      .map((row) => row.user_id),
  ).size;
  const currentDaySessions = dailyActivity
    .filter((row) => row.activity_date === totals.current_day)
    .reduce((sum, row) => sum + number(row.sessions), 0);
  const unattributedTotal = unattributedPapers.reduce(
    (sum, row) => sum + number(row.paper_count),
    0,
  );

  const dailyHeaders = [
    { key: "date", label: "Date" },
    { key: "workspace", label: "Workspace" },
    { key: "participant", label: "User" },
    { key: "sessions", label: "Uses (sessions)" },
    { key: "pageViews", label: "Page visits" },
    { key: "projects", label: "Projects" },
    { key: "papers", label: "Papers" },
    { key: "tasks", label: "Tasks" },
    { key: "notes", label: "Notes" },
  ];
  const pageHeaders = [
    { key: "date", label: "Date" },
    { key: "workspace", label: "Workspace" },
    { key: "participant", label: "User" },
    { key: "page", label: "Page" },
    { key: "visits", label: "Visits" },
  ];
  const platformDayHeaders = [
    { key: "date", label: "Date" },
    { key: "activeUsers", label: "Active users" },
    { key: "sessions", label: "Uses (sessions)" },
    { key: "pageViews", label: "Page visits" },
  ];
  const platformPageHeaders = [
    { key: "page", label: "Page" },
    { key: "visits", label: "Visits" },
  ];
  const inventoryHeaders = dailyHeaders.filter((header) =>
    [
      "date",
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
<body><main><h1>Flow usage research report</h1><p class="muted">Generated ${escapeHtml(generatedAt)} · Last ${escapeHtml(days)} days · Times grouped in Australia/Sydney</p>
<div class="cards"><div class="card"><strong>${number(totals.registered_users)}</strong>Registered users</div><div class="card"><strong>${number(totals.ever_active_users)}</strong>Users who have used Flow</div><div class="card"><strong>${activeToday}</strong>Active users today</div><div class="card"><strong>${currentDaySessions}</strong>Uses today</div></div>
<section class="note"><strong>How to read this report.</strong> A “use” is one session; a new session begins after 30 minutes without activity. Each route visit is counted as a page visit, including returning to Projects, Papers, Tasks or Notes. Page visits never include record IDs or search text. Item totals are private daily snapshots taken by the existing 2:00am Australia/Sydney cleanup run and are not displayed inside Flow.</section>
<h2>Platform activity by day</h2>${table(platformDayHeaders, platformDayRows)}
<h2>Pages visited across the platform</h2>${table(platformPageHeaders, platformPageRows)}
<h2>Daily activity by user</h2>${table(dailyHeaders, dailyRows)}
<h2>Page visits by user</h2>${table(pageHeaders, pageRows)}
<h2>Daily item counts</h2>${table(inventoryHeaders, snapshotRows)}
<section class="note"><strong>Data note.</strong> ${unattributedTotal} paper(s) created before creator tracking have no reliable individual owner and are excluded from individual paper counts. Session totals begin when this research tracking version is released; older events without page categories appear as “Older activity (unclassified)”. Blank daily counts mean the 2:00am snapshot had not yet been captured.</section>
</main></body></html>`;

  return {
    html,
    dailyRows,
    pageRows,
    snapshotRows,
    platformDayRows,
    platformPageRows,
  };
}
