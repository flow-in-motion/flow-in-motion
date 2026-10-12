// Dumps in-app feedback submissions to the console (and optionally saves any
// attached screenshots to disk), since production email delivery for the
// feedback notification is not relied on. Uses the migration role, which
// owns these tables and so bypasses row-level security -- this script is
// meant to be run by a developer/admin against the whole table, not scoped
// to one tenant or user the way the app itself is.
//
// Usage (from database/migrations):
//   pnpm feedback:export
//   pnpm feedback:export -- --limit 20
//   pnpm feedback:export -- --since 2026-10-01
//   pnpm feedback:export -- --screenshots ./feedback-screenshots
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const { Client } = pg;

function parseArgs(argv) {
  const args = { limit: 50, since: undefined, screenshotsDir: undefined };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--limit') {
      args.limit = Number(argv[++i]);
    } else if (arg === '--since') {
      args.since = argv[++i];
    } else if (arg === '--screenshots') {
      args.screenshotsDir = argv[++i];
    }
  }

  return args;
}

const args = parseArgs(process.argv.slice(2));

const required = [
  'POSTGRES_MIGRATION_HOST',
  'POSTGRES_MIGRATION_PORT',
  'POSTGRES_MIGRATION_USER',
  'POSTGRES_MIGRATION_PASSWORD',
  'POSTGRES_DB',
];
const missingEnvironment = required.filter((name) => !process.env[name]);
if (missingEnvironment.length > 0) {
  throw new Error(`Missing required variables: ${missingEnvironment.join(', ')}`);
}

const sslMode = process.env.POSTGRES_MIGRATION_SSL_MODE ?? 'require';
const ssl =
  sslMode === 'disable'
    ? false
    : sslMode === 'verify-full'
      ? {
          rejectUnauthorized: true,
          ca: process.env.POSTGRES_MIGRATION_SSL_CA?.replace(/\\n/g, '\n'),
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
  application_name: 'flow-in-motion-feedback-export',
});

await client.connect();

try {
  const conditions = [];
  const values = [];

  if (args.since) {
    values.push(args.since);
    conditions.push(`feedback.created_at >= $${values.length}`);
  }

  values.push(Number.isFinite(args.limit) && args.limit > 0 ? args.limit : 50);
  const limitParamIndex = values.length;

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await client.query(
    `
      SELECT
        feedback.id,
        feedback.message,
        feedback.rating,
        feedback.screenshot_data_url IS NOT NULL AS has_screenshot,
        feedback.screenshot_data_url,
        feedback.created_at,
        users.email AS user_email,
        users.full_name AS user_full_name,
        tenants.name AS tenant_name
      FROM feedback
      JOIN users ON users.id = feedback.user_id
      JOIN tenants ON tenants.id = feedback.tenant_id
      ${where}
      ORDER BY feedback.created_at DESC
      LIMIT $${limitParamIndex}
    `,
    values,
  );

  if (rows.length === 0) {
    console.log('No feedback found.');
  }

  let screenshotsSaved = 0;

  if (args.screenshotsDir) {
    await mkdir(args.screenshotsDir, { recursive: true });
  }

  for (const row of rows) {
    console.log('―'.repeat(72));
    console.log(`Feedback ${row.id}`);
    console.log(`  Submitted: ${row.created_at.toISOString()}`);
    console.log(`  By:        ${row.user_full_name ?? '(no name)'} <${row.user_email}>`);
    console.log(`  Tenant:    ${row.tenant_name}`);
    console.log(`  Rating:    ${row.rating ?? 'Not provided'}`);
    console.log(`  Message:`);
    for (const line of row.message.split('\n')) {
      console.log(`    ${line}`);
    }

    if (row.has_screenshot) {
      if (args.screenshotsDir) {
        const match = /^data:image\/(png|jpeg);base64,(.+)$/.exec(
          row.screenshot_data_url,
        );

        if (match) {
          const [, imageType, base64Data] = match;
          const extension = imageType === 'png' ? 'png' : 'jpg';
          const filePath = path.join(
            args.screenshotsDir,
            `${row.id}.${extension}`,
          );

          await writeFile(filePath, Buffer.from(base64Data, 'base64'));
          console.log(`  Screenshot: saved to ${filePath}`);
          screenshotsSaved += 1;
        } else {
          console.log('  Screenshot: present but not a recognizable data URL, skipped');
        }
      } else {
        console.log('  Screenshot: present (pass --screenshots <dir> to save it)');
      }
    }
  }

  console.log('―'.repeat(72));
  console.log(
    `${rows.length} feedback item(s)${
      args.screenshotsDir ? `, ${screenshotsSaved} screenshot(s) saved` : ''
    }.`,
  );
} finally {
  await client.end();
}
