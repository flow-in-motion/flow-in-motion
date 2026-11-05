import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";

// Use an EMPTY disposable database only. No production database or real people.
export async function verifyHdrDatabase(db, exerciseRepository) {
  assert.equal(
    Number(
      (
        await db.query(
          "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'",
        )
      ).rows[0].count,
    ),
    0,
  );
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE ROLE research_tracker_app;
    CREATE TABLE users(id uuid PRIMARY KEY);
    CREATE TABLE tenants(id uuid PRIMARY KEY);
    CREATE TABLE projects(id uuid PRIMARY KEY, tenant_id uuid, user_id uuid, title text, archived_at timestamptz);
    CREATE TABLE modules(id uuid PRIMARY KEY, tenant_id uuid, project_id uuid, created_by uuid, title text, short_title text, display_id text, archived_at timestamptz);
    CREATE TABLE project_collaborators(project_id uuid,user_id uuid);
    CREATE TABLE module_collaborators(module_id uuid,user_id uuid);
    CREATE TABLE tasks(id uuid PRIMARY KEY,title text);
    CREATE TABLE notes(id uuid PRIMARY KEY,title text);
    CREATE FUNCTION is_project_collaborator(uuid,uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS 'SELECT EXISTS(SELECT 1 FROM project_collaborators WHERE project_id=$1 AND user_id=$2)';
    CREATE FUNCTION check_module_access(uuid,uuid,uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS 'SELECT EXISTS(SELECT 1 FROM modules m WHERE tenant_id=$1 AND id=$2 AND (created_by=$3 OR EXISTS(SELECT 1 FROM module_collaborators c WHERE c.module_id=m.id AND c.user_id=$3)))';
    GRANT USAGE ON SCHEMA public TO research_tracker_app;
    GRANT SELECT ON projects,modules TO research_tracker_app;
  `);
  await db.exec(
    await readFile(
      new URL("../sql/0103_hdr_basics.sql", import.meta.url),
      "utf8",
    ),
  );
  const owner = "11111111-1111-4111-8111-111111111111";
  const other = "22222222-2222-4222-8222-222222222222";
  const tenant = "33333333-3333-4333-8333-333333333333";
  const otherTenant = "44444444-4444-4444-8444-444444444444";
  const project = "55555555-5555-4555-8555-555555555555";
  const paper = "66666666-6666-4666-8666-666666666666";
  const privatePaper = "77777777-7777-4777-8777-777777777777";
  await db.exec(`INSERT INTO users VALUES ('${owner}'),('${other}'); INSERT INTO tenants VALUES ('${tenant}'),('${otherTenant}');
    INSERT INTO projects VALUES ('${project}','${tenant}','${owner}','Existing project',NULL);
    INSERT INTO modules VALUES ('${paper}','${tenant}','${project}','${owner}','Existing paper',NULL,'P-1',NULL),('${privatePaper}','${tenant}',NULL,'${other}','Other person paper',NULL,'P-2',NULL);
    INSERT INTO tasks VALUES (gen_random_uuid(),'Existing task'); INSERT INTO notes VALUES (gen_random_uuid(),'Existing note');
    SET ROLE research_tracker_app;
    SELECT set_config('app.current_user_id','${owner}',false),set_config('app.current_tenant_id','${tenant}',false);`);
  const inserted = (
    await db.query(
      `INSERT INTO hdr_people(tenant_id,owner_user_id,name) VALUES ('${tenant}','${owner}','Sample student') RETURNING id`,
    )
  ).rows[0].id;
  await db.exec(
    `INSERT INTO hdr_projects VALUES ('${inserted}','${tenant}','${project}'); INSERT INTO hdr_papers VALUES ('${inserted}','${tenant}','${paper}');`,
  );
  await assert.rejects(
    db.query(
      `INSERT INTO hdr_papers VALUES ('${inserted}','${tenant}','${privatePaper}')`,
    ),
    /row-level security/,
  );
  await assert.rejects(
    db.query(
      `INSERT INTO hdr_people(tenant_id,owner_user_id,name) VALUES ('${otherTenant}','${owner}','Wrong workspace')`,
    ),
    /row-level security/,
  );
  await assert.rejects(
    db.query(
      `UPDATE hdr_people SET owner_user_id='${other}' WHERE id='${inserted}'`,
    ),
    /permission denied/,
  );
  await assert.rejects(
    db.query(
      `UPDATE hdr_people SET tenant_id='${otherTenant}' WHERE id='${inserted}'`,
    ),
    /permission denied/,
  );
  await assert.rejects(
    db.query(
      `INSERT INTO hdr_people(tenant_id,owner_user_id,name,type) VALUES ('${tenant}','${owner}','Invalid type','Unknown')`,
    ),
    /check constraint/,
  );
  await db.exec(`SELECT set_config('app.current_user_id','${other}',false)`);
  for (const table of ["hdr_people", "hdr_projects", "hdr_papers"])
    assert.equal(
      (await db.query(`SELECT * FROM ${table}`)).rows.length,
      0,
      `Other account cannot read ${table}`,
    );
  assert.equal(
    (
      await db.query(
        `UPDATE hdr_people SET name='Changed' WHERE id='${inserted}' RETURNING id`,
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await db.query(
        `DELETE FROM hdr_people WHERE id='${inserted}' RETURNING id`,
      )
    ).rows.length,
    0,
  );
  await assert.rejects(
    db.query(
      `INSERT INTO hdr_projects VALUES ('${inserted}','${tenant}','${project}')`,
    ),
    /row-level security/,
  );
  await db.exec(
    `SELECT set_config('app.current_user_id','${owner}',false); SELECT set_config('app.current_tenant_id','${otherTenant}',false)`,
  );
  assert.equal(
    (await db.query("SELECT * FROM hdr_people")).rows.length,
    0,
    "Workspace isolation",
  );
  await db.exec(`SELECT set_config('app.current_tenant_id','${tenant}',false)`);
  if (exerciseRepository)
    await exerciseRepository({
      owner,
      other,
      tenant,
      otherTenant,
      project,
      paper,
      privatePaper,
      personId: inserted,
    });
  await db.exec(
    `RESET ROLE; UPDATE projects SET archived_at=now() WHERE id='${project}'; SET ROLE research_tracker_app`,
  );
  assert.equal(
    (await db.query("SELECT * FROM hdr_projects")).rows.length,
    0,
    "Archived projects hidden",
  );
  assert.equal(
    (await db.query("SELECT * FROM hdr_papers")).rows.length,
    0,
    "Paper with archived parent hidden",
  );
  await db.exec(
    `RESET ROLE; UPDATE projects SET archived_at=NULL WHERE id='${project}'; UPDATE modules SET archived_at=now() WHERE id='${paper}'; SET ROLE research_tracker_app`,
  );
  assert.equal(
    (await db.query("SELECT * FROM hdr_papers")).rows.length,
    0,
    "Archived paper hidden",
  );
  await db.exec(
    `RESET ROLE; UPDATE modules SET archived_at=NULL WHERE id='${paper}'; UPDATE projects SET user_id='${other}' WHERE id='${project}'; UPDATE modules SET created_by='${other}' WHERE id='${paper}'; SET ROLE research_tracker_app`,
  );
  assert.equal(
    (await db.query("SELECT * FROM hdr_projects")).rows.length,
    0,
    "Lost project access hides link",
  );
  assert.equal(
    (await db.query("SELECT * FROM hdr_papers")).rows.length,
    0,
    "Lost paper access hides link",
  );
  await db.exec("RESET ROLE");
  const snapshot = async () =>
    Promise.all(
      ["projects", "modules", "tasks", "notes"].map(async (table) => [
        table,
        (await db.query(`SELECT * FROM ${table} ORDER BY id`)).rows,
      ]),
    );
  const workBefore = await snapshot();
  await db.exec(
    `SET ROLE research_tracker_app; DELETE FROM hdr_people WHERE id='${inserted}'; RESET ROLE`,
  );
  assert.deepEqual(
    await snapshot(),
    workBefore,
    "Deleting HDR must not change existing work",
  );
  assert.equal(
    Number((await db.query("SELECT count(*) FROM hdr_projects")).rows[0].count),
    0,
  );
  assert.equal(
    Number((await db.query("SELECT count(*) FROM hdr_papers")).rows[0].count),
    0,
  );
  for (const role of ["anon", "authenticated", "service_role"])
    for (const table of ["hdr_people", "hdr_projects", "hdr_papers"])
      assert.equal(
        (
          await db.query(
            `SELECT has_table_privilege('${role}','${table}','SELECT') AS allowed`,
          )
        ).rows[0].allowed,
        false,
        `${role} has no direct data access`,
      );
  assert.equal(
    Number(
      (
        await db.query(
          "SELECT count(*) FROM pg_class WHERE relname IN ('hdr_people','hdr_projects','hdr_papers') AND relrowsecurity",
        )
      ).rows[0].count,
    ),
    3,
  );
}

test(
  "HDR owner isolation, link access, archives and unchanged existing work",
  { skip: !process.env.FLOW_HDR_TEST_DATABASE_URL },
  async () => {
    const client = new pg.Client({
      connectionString: process.env.FLOW_HDR_TEST_DATABASE_URL,
    });
    await client.connect();
    try {
      await verifyHdrDatabase({
        query: (...args) => client.query(...args),
        exec: (sql) => client.query(sql),
      });
    } finally {
      await client.end();
    }
  },
);
