// Generates a private, self-contained HTML report plus CSV extracts. It uses
// the migration/admin database role and is intentionally not exposed by the
// application API or user interface.
//
// Usage (from database/migrations):
//   pnpm analytics:report
//   pnpm analytics:report -- --weeks 12 --out ./usage-report
//   pnpm analytics:report -- --deidentified
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

import { buildUsageReport, toCsv } from "./usage-report.mjs";

const { Client } = pg;

function parseArgs(argv) {
  const today = new Date().toISOString().slice(0, 10);
  const args = { weeks: 12, out: `usage-report-${today}`, deidentified: false };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--weeks") args.weeks = Number(argv[++index]);
    else if (argv[index] === "--out") args.out = argv[++index];
    else if (argv[index] === "--deidentified") args.deidentified = true;
  }
  if (!Number.isInteger(args.weeks) || args.weeks < 1 || args.weeks > 260) {
    throw new Error("--weeks must be a whole number from 1 to 260");
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const required = [
  "POSTGRES_MIGRATION_HOST",
  "POSTGRES_MIGRATION_PORT",
  "POSTGRES_MIGRATION_USER",
  "POSTGRES_MIGRATION_PASSWORD",
  "POSTGRES_DB",
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length)
  throw new Error(`Missing required variables: ${missing.join(", ")}`);

const sslMode = process.env.POSTGRES_MIGRATION_SSL_MODE ?? "require";
const ssl =
  sslMode === "disable"
    ? false
    : sslMode === "verify-full"
      ? {
          rejectUnauthorized: true,
          ca: process.env.POSTGRES_MIGRATION_SSL_CA?.replace(/\\n/g, "\n"),
        }
      : { rejectUnauthorized: false };
const client = new Client({
  host: process.env.POSTGRES_MIGRATION_HOST,
  port: Number(process.env.POSTGRES_MIGRATION_PORT),
  user: process.env.POSTGRES_MIGRATION_USER,
  password: process.env.POSTGRES_MIGRATION_PASSWORD,
  database: process.env.POSTGRES_DB,
  ssl,
  connectionTimeoutMillis: 10_000,
  application_name: "flow-in-motion-private-usage-report",
});

await client.connect();
try {
  const sinceSql = `date_trunc('week', timezone('Australia/Sydney', now())) - ($1::int - 1) * interval '1 week'`;
  const [
    totalsResult,
    activityResult,
    pagesResult,
    snapshotsResult,
    unattributedResult,
  ] = await Promise.all([
    client.query(`
      SELECT
        count(DISTINCT membership.user_id)::int AS registered_users,
        count(DISTINCT event.user_id)::int AS ever_active_users,
        date_trunc('week', timezone('Australia/Sydney', now()))::date::text AS current_week
      FROM tenant_memberships membership
      INNER JOIN users app_user ON app_user.id = membership.user_id
      LEFT JOIN analytics_events event ON event.user_id = membership.user_id
        AND event.tenant_id = membership.tenant_id
      WHERE membership.status = 'active'
        AND membership.joined_at IS NOT NULL
        AND app_user.external_auth_id IS NOT NULL
    `),
    client.query(
      `
      SELECT
        event.tenant_id, event.user_id, tenant.name AS tenant_name,
        app_user.display_name, app_user.full_name, app_user.email,
        date_trunc('week', timezone('Australia/Sydney', event.created_at))::date::text AS week_start,
        count(DISTINCT event.session_id)::int AS sessions,
        count(DISTINCT timezone('Australia/Sydney', event.created_at)::date)::int AS active_days,
        count(*) FILTER (WHERE event.name = 'page_view')::int AS page_views
      FROM analytics_events event
      INNER JOIN users app_user ON app_user.id = event.user_id
      INNER JOIN tenants tenant ON tenant.id = event.tenant_id
      WHERE event.created_at >= ${sinceSql}
      GROUP BY event.tenant_id, event.user_id, tenant.name, app_user.display_name,
        app_user.full_name, app_user.email, week_start
      ORDER BY week_start DESC, tenant.name, app_user.display_name, app_user.email
    `,
      [args.weeks],
    ),
    client.query(
      `
      SELECT
        event.tenant_id, event.user_id, tenant.name AS tenant_name,
        app_user.display_name, app_user.full_name, app_user.email,
        date_trunc('week', timezone('Australia/Sydney', event.created_at))::date::text AS week_start,
        coalesce(event.page_key, 'legacy_unclassified') AS page_key,
        event.feature_key,
        count(*)::int AS visits
      FROM analytics_events event
      INNER JOIN users app_user ON app_user.id = event.user_id
      INNER JOIN tenants tenant ON tenant.id = event.tenant_id
      WHERE event.name = 'page_view' AND event.created_at >= ${sinceSql}
      GROUP BY event.tenant_id, event.user_id, tenant.name, app_user.display_name,
        app_user.full_name, app_user.email, week_start, event.page_key, event.feature_key
      ORDER BY week_start DESC, visits DESC
    `,
      [args.weeks],
    ),
    client.query(
      `
      SELECT snapshot.*, tenant.name AS tenant_name, app_user.display_name,
        app_user.full_name, app_user.email, snapshot.week_start::text AS week_start
      FROM usage_weekly_snapshots snapshot
      INNER JOIN users app_user ON app_user.id = snapshot.user_id
      INNER JOIN tenants tenant ON tenant.id = snapshot.tenant_id
      WHERE snapshot.week_start >= (${sinceSql})::date
      ORDER BY snapshot.week_start DESC, tenant.name, app_user.display_name, app_user.email
    `,
      [args.weeks],
    ),
    client.query(`
      SELECT tenant_id, count(*)::int AS paper_count
      FROM modules
      WHERE created_by IS NULL AND archived_at IS NULL
      GROUP BY tenant_id
    `),
  ]);

  const report = buildUsageReport({
    generatedAt: new Date().toISOString(),
    weeks: args.weeks,
    totals: totalsResult.rows[0],
    weeklyActivity: activityResult.rows,
    pageVisits: pagesResult.rows,
    snapshots: snapshotsResult.rows,
    unattributedPapers: unattributedResult.rows,
    deidentified: args.deidentified,
  });
  const out = path.resolve(args.out);
  await mkdir(out, { recursive: true });
  await Promise.all([
    writeFile(path.join(out, "report.html"), report.html),
    writeFile(
      path.join(out, "weekly-users.csv"),
      toCsv(report.weeklyRows, [
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
      ]),
    ),
    writeFile(
      path.join(out, "weekly-pages.csv"),
      toCsv(report.pageRows, [
        { key: "week", label: "Week starting" },
        { key: "workspace", label: "Workspace" },
        { key: "participant", label: "User" },
        { key: "page", label: "Page" },
        { key: "visits", label: "Visits" },
      ]),
    ),
    writeFile(
      path.join(out, "weekly-inventory.csv"),
      toCsv(report.snapshotRows, [
        { key: "week", label: "Week starting" },
        { key: "workspace", label: "Workspace" },
        { key: "participant", label: "User" },
        { key: "projects", label: "Projects" },
        { key: "papers", label: "Papers" },
        { key: "tasks", label: "Tasks" },
        { key: "notes", label: "Notes" },
      ]),
    ),
    writeFile(
      path.join(out, "platform-pages.csv"),
      toCsv(report.platformPageRows, [
        { key: "page", label: "Page" },
        { key: "visits", label: "Visits" },
      ]),
    ),
  ]);
  console.log(`Private usage report written to ${out}`);
  console.log(
    "Open report.html in a browser; CSV files are included for further analysis.",
  );
} finally {
  await client.end();
}
