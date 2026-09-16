import pg from 'pg';

const { Client } = pg;

const required = [
  'POSTGRES_BOOTSTRAP_HOST',
  'POSTGRES_BOOTSTRAP_PORT',
  'POSTGRES_BOOTSTRAP_USER',
  'POSTGRES_BOOTSTRAP_PASSWORD',
  'POSTGRES_DB',
  'POSTGRES_MIGRATION_PASSWORD',
  'POSTGRES_RUNTIME_PASSWORD',
];

const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  throw new Error(`Missing required variables: ${missing.join(', ')}`);
}

const sslMode = process.env.POSTGRES_BOOTSTRAP_SSL_MODE ?? 'require';
const ssl =
  sslMode === 'disable'
    ? false
    : sslMode === 'verify-full'
      ? {
          rejectUnauthorized: true,
          ca: process.env.POSTGRES_BOOTSTRAP_SSL_CA?.replace(/\\n/g, '\n'),
        }
      : { rejectUnauthorized: false };

if (sslMode === 'verify-full' && !process.env.POSTGRES_BOOTSTRAP_SSL_CA) {
  throw new Error(
    'POSTGRES_BOOTSTRAP_SSL_CA is required when SSL mode is verify-full',
  );
}

const client = new Client({
  host: process.env.POSTGRES_BOOTSTRAP_HOST,
  port: Number(process.env.POSTGRES_BOOTSTRAP_PORT),
  user: process.env.POSTGRES_BOOTSTRAP_USER,
  password: process.env.POSTGRES_BOOTSTRAP_PASSWORD,
  database: process.env.POSTGRES_DB,
  ssl,
  connectionTimeoutMillis: 10_000,
  application_name: 'flow-in-motion-role-bootstrap',
});

const roles = [
  ['research_tracker_migration', process.env.POSTGRES_MIGRATION_PASSWORD],
  ['research_tracker_app', process.env.POSTGRES_RUNTIME_PASSWORD],
];

await client.connect();
try {
  await client.query('BEGIN');

  for (const [role, password] of roles) {
    const exists = await client.query(
      'SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1) AS exists',
      [role],
    );
    const action = exists.rows[0].exists ? 'ALTER' : 'CREATE';
    const statement = await client.query(
      `SELECT format(
         '${action} ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',
         $1::text,
         $2::text
       ) AS sql`,
      [role, password],
    );
    await client.query(statement.rows[0].sql);
  }

  await client.query(
    'GRANT CREATE ON DATABASE postgres TO research_tracker_migration',
  );
  await client.query(
    'GRANT ALL PRIVILEGES ON SCHEMA public TO research_tracker_migration',
  );
  await client.query('GRANT CONNECT ON DATABASE postgres TO research_tracker_app');
  await client.query('GRANT USAGE ON SCHEMA public TO research_tracker_app');

  await client.query('COMMIT');
  console.log('Supabase migration and runtime roles are ready.');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
