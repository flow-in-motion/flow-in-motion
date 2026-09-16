import { readFile } from 'node:fs/promises';
import pg from 'pg';

const { Client } = pg;

const expectedTables = [
  'analytics_events',
  'calendar_events',
  'conference_projects',
  'conferences',
  'enum',
  'feedback',
  'invitations',
  'module_collaborators',
  'module_invitations',
  'module_submissions',
  'modules',
  'note_invitations',
  'note_members',
  'notes',
  'project_collaborators',
  'project_invitations',
  'projects',
  'task_invitations',
  'task_members',
  'tasks',
  'tenant_memberships',
  'tenant_sequences',
  'tenants',
  'user_preferences',
  'user_workspace_preferences',
  'users',
  'workspace_contexts',
];

const expectedFunctions = [
  'check_module_access',
  'check_module_collaborator',
  'check_project_collaborator',
  'check_tenant_membership',
  'cleanup_archived_modules',
  'cleanup_archived_projects',
  'find_module_invitation_by_token',
  'find_module_titles_for_invitations',
  'find_note_invitation_by_token',
  'find_note_title_for_invitation',
  'find_project_invitation_by_token',
  'find_project_titles_for_invitations',
  'find_task_invitation_by_token',
  'find_task_title_for_invitation',
  'get_owner_role_id',
  'is_conference_project_collaborator',
  'is_module_collaborator',
  'is_note_member',
  'is_project_collaborator',
  'is_task_member',
  'is_tenant_member',
  'shares_module_with',
  'shares_note_with',
  'shares_project_with',
  'shares_task_with',
];

const referenceCategories = [
  'importance',
  'module_pipeline_stage',
  'project_role',
  'project_status',
  'task_status',
  'visibility',
];

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
  application_name: 'flow-in-motion-database-verification',
});

const failures = [];
const quoteIdentifier = (value) => `"${value.replaceAll('"', '""')}"`;

await client.connect();
try {
  const tables = await client.query(`
    SELECT table_class.relname AS table_name,
           table_class.relrowsecurity AS rls_enabled,
           count(policy.policyname)::integer AS policy_count
      FROM pg_class AS table_class
      INNER JOIN pg_namespace AS namespace ON namespace.oid = table_class.relnamespace
      LEFT JOIN pg_policies AS policy
        ON policy.schemaname = namespace.nspname
       AND policy.tablename = table_class.relname
     WHERE namespace.nspname = 'public'
       AND table_class.relkind = 'r'
     GROUP BY table_class.relname, table_class.relrowsecurity
  `);
  const tableState = new Map(tables.rows.map((row) => [row.table_name, row]));

  for (const table of expectedTables) {
    const state = tableState.get(table);
    if (!state) failures.push(`missing table: ${table}`);
    else if (!state.rls_enabled) failures.push(`RLS disabled: ${table}`);
    else if (state.policy_count < 1) failures.push(`no RLS policy: ${table}`);
  }

  const functions = await client.query(`
    SELECT procedure.proname,
           procedure.prosecdef,
           coalesce(array_to_string(procedure.proconfig, ','), '') AS config,
           EXISTS (
             SELECT 1
               FROM aclexplode(coalesce(procedure.proacl, acldefault('f', procedure.proowner))) AS acl
              WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
           ) AS public_execute
      FROM pg_proc AS procedure
      INNER JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
     WHERE namespace.nspname = 'public'
       AND procedure.proowner = current_user::regrole
  `);
  const functionNames = new Set(functions.rows.map((row) => row.proname));
  for (const name of expectedFunctions) {
    if (!functionNames.has(name)) failures.push(`missing function: ${name}`);
  }
  for (const fn of functions.rows.filter((row) => row.prosecdef)) {
    if (!fn.config.includes('search_path=public, pg_temp')) {
      failures.push(`unsafe SECURITY DEFINER search_path: ${fn.proname}`);
    }
    if (fn.public_execute) {
      failures.push(`PUBLIC can execute SECURITY DEFINER function: ${fn.proname}`);
    }
  }

  const journal = JSON.parse(
    await readFile(new URL('../sql/meta/_journal.json', import.meta.url), 'utf8'),
  );
  const history = await client.query(
    'SELECT count(*)::integer AS count FROM drizzle.__drizzle_migrations',
  );
  if (history.rows[0].count !== journal.entries.length) {
    failures.push(
      `migration history has ${history.rows[0].count} entries; expected ${journal.entries.length}`,
    );
  }

  const runtimeRole = await client.query(`
    SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls
      FROM pg_roles
     WHERE rolname = 'research_tracker_app'
  `);
  if (runtimeRole.rowCount !== 1) failures.push('missing role: research_tracker_app');
  else if (
    runtimeRole.rows[0].rolsuper ||
    runtimeRole.rows[0].rolcreatedb ||
    runtimeRole.rows[0].rolcreaterole ||
    runtimeRole.rows[0].rolreplication ||
    runtimeRole.rows[0].rolbypassrls
  ) {
    failures.push('research_tracker_app has elevated role attributes');
  }

  const runtimePrivileges = await client.query(`
    SELECT table_name,
           has_table_privilege('research_tracker_app', format('public.%I', table_name), 'SELECT') AS can_select,
           has_table_privilege('research_tracker_app', format('public.%I', table_name), 'INSERT') AS can_insert,
           has_table_privilege('research_tracker_app', format('public.%I', table_name), 'UPDATE') AS can_update,
           has_table_privilege('research_tracker_app', format('public.%I', table_name), 'DELETE') AS can_delete
      FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `);
  for (const privilege of runtimePrivileges.rows) {
    if (
      !privilege.can_select ||
      !privilege.can_insert ||
      !privilege.can_update ||
      !privilege.can_delete
    ) {
      failures.push(`runtime DML grant incomplete: ${privilege.table_name}`);
    }
  }

  for (const apiRole of ['anon', 'authenticated']) {
    const roleExists = await client.query(
      'SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1) AS exists',
      [apiRole],
    );
    if (!roleExists.rows[0].exists) continue;
    const exposed = await client.query(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
          AND (
            has_table_privilege($1, format('public.%I', table_name), 'SELECT')
            OR has_table_privilege($1, format('public.%I', table_name), 'INSERT')
            OR has_table_privilege($1, format('public.%I', table_name), 'UPDATE')
            OR has_table_privilege($1, format('public.%I', table_name), 'DELETE')
          )`,
      [apiRole],
    );
    for (const row of exposed.rows) {
      failures.push(`${apiRole} can access table: ${row.table_name}`);
    }
  }

  const categories = await client.query(`
    SELECT category, count(*)::integer AS count
      FROM "enum"
     GROUP BY category
     ORDER BY category
  `);
  const actualCategories = categories.rows.map((row) => row.category);
  if (actualCategories.join('|') !== referenceCategories.join('|')) {
    failures.push(`unexpected enum categories: ${actualCategories.join(', ')}`);
  }
  const referenceCount = categories.rows.reduce((sum, row) => sum + row.count, 0);
  if (referenceCount !== 34) {
    failures.push(`reference enum row count is ${referenceCount}; expected 34`);
  }

  for (const table of expectedTables.filter((name) => name !== 'enum')) {
    const count = await client.query(
      `SELECT count(*)::integer AS count FROM public.${quoteIdentifier(table)}`,
    );
    if (count.rows[0].count !== 0) {
      failures.push(`application data is not empty: ${table} has ${count.rows[0].count} rows`);
    }
  }

  const triggers = await client.query(`
    SELECT count(*)::integer AS count
      FROM pg_trigger AS trigger
      INNER JOIN pg_class AS table_class ON table_class.oid = trigger.tgrelid
      INNER JOIN pg_namespace AS namespace ON namespace.oid = table_class.relnamespace
     WHERE namespace.nspname = 'public' AND NOT trigger.tgisinternal
  `);

  if (failures.length > 0) {
    throw new Error(`Database verification failed:\n- ${failures.join('\n- ')}`);
  }

  console.log(`Verified ${expectedTables.length} application tables with RLS.`);
  console.log(`Verified ${journal.entries.length} Drizzle migration entries.`);
  console.log(`Verified ${expectedFunctions.length} required functions.`);
  console.log(`Verified ${referenceCount} reference rows and no application data.`);
  console.log(`Application triggers present: ${triggers.rows[0].count} (none required).`);
  console.log('Database verification passed.');
} finally {
  await client.end();
}
