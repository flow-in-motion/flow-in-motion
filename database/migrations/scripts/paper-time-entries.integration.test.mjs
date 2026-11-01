import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";

// Only an EMPTY disposable database, never a real application database.
export async function verifyPaperTimeDatabase(db, exerciseRepository) {
  assert.equal(
    Number(
      (
        await db.query(
          "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'",
        )
      ).rows[0].count,
    ),
    0,
    "Requires an empty disposable database",
  );
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE ROLE research_tracker_app;
    CREATE TABLE users(id uuid PRIMARY KEY);
    CREATE TABLE tenants(id uuid PRIMARY KEY);
    CREATE TABLE projects(id uuid PRIMARY KEY, tenant_id uuid, user_id uuid, archived_at timestamptz);
    CREATE TABLE modules(id uuid PRIMARY KEY, tenant_id uuid REFERENCES tenants(id), project_id uuid REFERENCES projects(id), created_by uuid, short_title text, title text, display_id text, archived_at timestamptz);
    CREATE TABLE module_collaborators(tenant_id uuid, module_id uuid, user_id uuid);
    CREATE TABLE tasks(id uuid PRIMARY KEY, tenant_id uuid, created_by uuid, title text);
    CREATE FUNCTION is_task_member(uuid,uuid) RETURNS boolean LANGUAGE sql AS 'SELECT false';
    CREATE FUNCTION is_module_collaborator(uuid,uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS 'SELECT EXISTS(SELECT 1 FROM module_collaborators WHERE module_id=$1 AND user_id=$2)';
    GRANT USAGE ON SCHEMA public TO research_tracker_app;
    GRANT SELECT ON projects, modules, tasks TO research_tracker_app;
  `);
  const independent = await readFile(
    new URL("../sql/0090_independent_papers.sql", import.meta.url),
    "utf8",
  );
  await db.exec(
    independent.slice(
      independent.indexOf(
        "CREATE OR REPLACE FUNCTION public.check_module_access(",
      ),
      independent.indexOf(
        "CREATE OR REPLACE FUNCTION public.check_module_manage_access(",
      ),
    ),
  );
  const policyStart = independent.indexOf("CREATE POLICY modules_visibility");
  await db.exec("ALTER TABLE modules ENABLE ROW LEVEL SECURITY;");
  await db.exec(
    independent.slice(
      policyStart,
      independent.indexOf("--> statement-breakpoint", policyStart),
    ),
  );
  await db.exec(
    await readFile(
      new URL("../sql/0097_task_time_entries.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL("../sql/0099_paper_time_entries.sql", import.meta.url),
      "utf8",
    ),
  );
  const owner = "11111111-1111-4111-8111-111111111111";
  const reader = "22222222-2222-4222-8222-222222222222";
  const outsider = "33333333-3333-4333-8333-333333333333";
  const tenant = "44444444-4444-4444-8444-444444444444";
  const otherTenant = "55555555-5555-4555-8555-555555555555";
  const paper = "66666666-6666-4666-8666-666666666666";
  const task = "77777777-7777-4777-8777-777777777777";
  await db.exec(`INSERT INTO users VALUES ('${owner}'),('${reader}'),('${outsider}'); INSERT INTO tenants VALUES ('${tenant}'),('${otherTenant}');
    INSERT INTO modules VALUES ('${paper}','${tenant}',NULL,'${owner}','Short title','Formal title','PAP-1',NULL);
    INSERT INTO module_collaborators VALUES ('${tenant}','${paper}','${reader}');
    INSERT INTO tasks VALUES ('${task}','${tenant}','${owner}','Existing task');
    SET ROLE research_tracker_app; SELECT set_config('app.current_user_id','${owner}',false);
    INSERT INTO task_time_entries(tenant_id,task_id,user_id,started_at,running_since,duration_seconds) VALUES ('${tenant}','${task}','${owner}',now(),now(),123);`);
  const taskBefore = (await db.query("SELECT * FROM task_time_entries")).rows;
  const insert = (user, workspace = tenant) =>
    `INSERT INTO paper_time_entries(tenant_id,paper_id,user_id,started_at,running_since) VALUES ('${workspace}','${paper}','${user}',now(),now()) RETURNING id`;
  const entry = (await db.query(insert(owner))).rows[0].id;
  await assert.rejects(db.query(insert(owner)), /unique constraint/);
  assert.equal(
    (await db.query("SELECT * FROM task_time_entries")).rows[0].ended_at,
    null,
  );
  await db.exec(`SELECT set_config('app.current_user_id','${reader}',false)`);
  assert.equal(
    (await db.query("SELECT * FROM paper_time_entries")).rows.length,
    1,
    "Paper collaborator can read totals",
  );
  assert.equal(
    (
      await db.query(
        `UPDATE paper_time_entries SET duration_seconds=999 WHERE id='${entry}' RETURNING id`,
      )
    ).rows.length,
    0,
    "Cannot edit someone else’s time",
  );
  await db.query(insert(reader));
  await assert.rejects(
    db.query(
      `UPDATE paper_time_entries SET user_id='${owner}' WHERE user_id='${reader}'`,
    ),
    /permission denied/,
  );
  await db.exec(`SELECT set_config('app.current_user_id','${outsider}',false)`);
  assert.equal(
    (await db.query("SELECT * FROM paper_time_entries")).rows.length,
    0,
  );
  await assert.rejects(db.query(insert(outsider)), /row-level security/);
  await assert.rejects(db.query(insert(owner)), /row-level security/);
  await db.exec(`SELECT set_config('app.current_user_id','${owner}',false)`);
  await assert.rejects(
    db.query(
      `INSERT INTO paper_time_entries(tenant_id,paper_id,user_id,source,started_at,ended_at,duration_seconds) VALUES ('${otherTenant}','${paper}','${owner}','manual',now()-interval '5 minutes',now(),300)`,
    ),
    /row-level security/,
  );
  if (exerciseRepository)
    await exerciseRepository({ owner, reader, paper, tenant, entry });
  assert.deepEqual(
    (await db.query("SELECT * FROM task_time_entries")).rows,
    taskBefore,
    "Every task timer field remains unchanged",
  );
  await db.exec("RESET ROLE");
  await db.exec(
    `UPDATE modules SET archived_at=now() WHERE id='${paper}'; SET ROLE research_tracker_app; SELECT set_config('app.current_user_id','${owner}',false)`,
  );
  await db.query(
    `UPDATE paper_time_entries SET running_since=NULL,ended_at=now() WHERE id='${entry}'`,
  );
  await assert.rejects(
    db.query(insert(owner)),
    /row-level security/,
    "Archived papers cannot receive new time",
  );
  await db.exec("RESET ROLE");
  for (const role of ["anon", "authenticated", "service_role"]) {
    assert.equal(
      (
        await db.query(
          `SELECT has_table_privilege('${role}','paper_time_entries','SELECT') AS allowed`,
        )
      ).rows[0].allowed,
      false,
    );
  }
  await db.exec(
    `DELETE FROM module_collaborators WHERE module_id='${paper}'; DELETE FROM modules WHERE id='${paper}'`,
  );
  assert.equal(
    Number(
      (await db.query("SELECT count(*) FROM paper_time_entries")).rows[0].count,
    ),
    0,
  );
  assert.deepEqual(
    (await db.query("SELECT * FROM task_time_entries")).rows,
    taskBefore,
  );
}

/** Verifies the production-only legacy column path without editing task rows. */
export async function verifyLegacyPaperTimeCopy(db) {
  const owner = "11111111-1111-4111-8111-111111111111";
  const tenant = "44444444-4444-4444-8444-444444444444";
  const paper = "66666666-6666-4666-8666-666666666666";
  const legacy = "88888888-8888-4888-8888-888888888888";
  await db.exec(`RESET ROLE;
    ALTER TABLE task_time_entries ALTER COLUMN task_id DROP NOT NULL;
    ALTER TABLE task_time_entries ADD COLUMN module_id uuid REFERENCES modules(id);
    INSERT INTO modules VALUES ('${paper}','${tenant}',NULL,'${owner}','Paper',NULL,NULL,NULL);
    INSERT INTO task_time_entries(id,tenant_id,module_id,user_id,source,started_at,ended_at,duration_seconds,note)
      VALUES ('${legacy}','${tenant}','${paper}','${owner}','timer',now()-interval '30 minutes',now(),1800,'Existing paper history');`);
  const before = (await db.query("SELECT * FROM task_time_entries ORDER BY id"))
    .rows;
  const migration = await readFile(
    new URL("../sql/0099_paper_time_entries.sql", import.meta.url),
    "utf8",
  );
  const copy = migration.slice(migration.indexOf("-- Some installations"));
  await db.exec(copy);
  await db.exec(copy); // Repeating the preservation copy must not duplicate history.
  const rows = (
    await db.query(
      "SELECT id,paper_id,duration_seconds,note FROM paper_time_entries",
    )
  ).rows;
  assert.deepEqual(rows, [
    {
      id: legacy,
      paper_id: paper,
      duration_seconds: 1800,
      note: "Existing paper history",
    },
  ]);
  assert.deepEqual(
    (await db.query("SELECT * FROM task_time_entries ORDER BY id")).rows,
    before,
  );
}

test(
  "paper time RLS, constraints and isolation from task time",
  { skip: !process.env.FLOW_PAPER_TIME_TEST_DATABASE_URL },
  async () => {
    const client = new pg.Client({
      connectionString: process.env.FLOW_PAPER_TIME_TEST_DATABASE_URL,
    });
    await client.connect();
    try {
      await verifyPaperTimeDatabase({
        query: (...args) => client.query(...args),
        exec: (sql) => client.query(sql),
      });
      await verifyLegacyPaperTimeCopy({
        query: (...args) => client.query(...args),
        exec: (sql) => client.query(sql),
      });
    } finally {
      await client.end();
    }
  },
);
