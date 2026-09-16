import { readFile } from 'node:fs/promises';
import pg from 'pg';

const { Client } = pg;

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
  application_name: 'flow-in-motion-migration-dry-run',
});

const journal = JSON.parse(
  await readFile(new URL('../sql/meta/_journal.json', import.meta.url), 'utf8'),
);

await client.connect();
await client.query('BEGIN');
try {
  for (const entry of journal.entries) {
    const sql = await readFile(
      new URL(`../sql/${entry.tag}.sql`, import.meta.url),
      'utf8',
    );
    try {
      await client.query(sql);
      console.log(`OK ${entry.tag}`);
    } catch (error) {
      throw new Error(`${entry.tag}: ${error.message}`, { cause: error });
    }
  }
  console.log(`Dry-run passed for ${journal.entries.length} migrations.`);
} finally {
  await client.query('ROLLBACK');
  await client.end();
}
