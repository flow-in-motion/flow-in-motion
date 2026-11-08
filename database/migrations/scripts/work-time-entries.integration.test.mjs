import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";

// EMPTY disposable database only; never production or actual participant data.
export async function verifyWorkTimeDatabase(db, exerciseService) {
  assert.equal(
    Number(
      (
        await db.query(
          "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'",
        )
      ).rows[0].count,
    ),
    0,
    "Requires an empty database",
  );
  const owner = "11111111-1111-4111-8111-111111111111",
    other = "22222222-2222-4222-8222-222222222222";
  const tenant = "33333333-3333-4333-8333-333333333333",
    otherTenant = "44444444-4444-4444-8444-444444444444";
  const project = "55555555-5555-4555-8555-555555555555",
    note = "66666666-6666-4666-8666-666666666666",
    hdr = "77777777-7777-4777-8777-777777777777";
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE ROLE research_tracker_app;
    CREATE TABLE users(id uuid PRIMARY KEY); CREATE TABLE tenants(id uuid PRIMARY KEY);
    CREATE TABLE "enum"(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid, project_id uuid, module_id uuid, category text,value text,sort_order int,hidden boolean);
    CREATE TABLE projects(id uuid PRIMARY KEY,tenant_id uuid,user_id uuid,title text,status_id uuid,archived_at timestamptz);
    CREATE TABLE modules(id uuid PRIMARY KEY,tenant_id uuid,project_id uuid,title text,status_id uuid,archived_at timestamptz);
    CREATE TABLE notes(id uuid PRIMARY KEY,tenant_id uuid,created_by uuid,project_id uuid,module_id uuid,title text);
    CREATE TABLE hdr_people(id uuid PRIMARY KEY,tenant_id uuid,owner_user_id uuid,name text);
    CREATE TABLE project_collaborators(project_id uuid,user_id uuid);
    CREATE FUNCTION is_project_collaborator(uuid,uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS 'SELECT EXISTS(SELECT 1 FROM public.project_collaborators WHERE project_id=$1 AND user_id=$2)';
    CREATE FUNCTION is_note_member(uuid,uuid) RETURNS boolean LANGUAGE sql AS 'SELECT false';
    GRANT USAGE ON SCHEMA public TO research_tracker_app;
    GRANT SELECT ON projects,notes,modules,hdr_people TO research_tracker_app;
    ALTER TABLE projects ENABLE ROW LEVEL SECURITY; ALTER TABLE notes ENABLE ROW LEVEL SECURITY; ALTER TABLE hdr_people ENABLE ROW LEVEL SECURITY;
    CREATE TABLE task_time_entries(id uuid, duration_seconds int); CREATE TABLE paper_time_entries(id uuid, duration_seconds int);
    INSERT INTO task_time_entries VALUES(gen_random_uuid(),123); INSERT INTO paper_time_entries VALUES(gen_random_uuid(),456);
    INSERT INTO users VALUES('${owner}'),('${other}'); INSERT INTO tenants VALUES('${tenant}'),('${otherTenant}');
    INSERT INTO "enum"(category,value,sort_order,hidden) VALUES('project_status','Review',1,false),('project_status','Active',0,false),('project_status','Archived',99,false);
    INSERT INTO projects VALUES('${project}','${tenant}','${owner}','Project',(SELECT id FROM "enum" WHERE value='Review'),NULL);
    INSERT INTO modules VALUES(gen_random_uuid(),'${tenant}',NULL,'Existing paper',(SELECT id FROM "enum" WHERE value='Review'),NULL);
    INSERT INTO notes VALUES('${note}','${tenant}','${owner}',NULL,NULL,'Note');
    INSERT INTO hdr_people VALUES('${hdr}','${tenant}','${owner}','Student');`);
  const baseline = await readFile(
    new URL("../sql/0059_supabase_security_baseline.sql", import.meta.url),
    "utf8",
  );
  for (const policy of ["projects_visibility", "notes_visibility"]) {
    const start = baseline.indexOf(`CREATE POLICY ${policy}`);
    const end = baseline.indexOf(";", start) + 1;
    await db.exec(baseline.slice(start, end));
  }
  const hdrMigration = await readFile(
    new URL("../sql/0103_hdr_basics.sql", import.meta.url),
    "utf8",
  );
  const hdrPolicy = hdrMigration.match(
    /CREATE POLICY hdr_people_select[^;]+;/,
  )[0];
  await db.exec(hdrPolicy);
  const unchanged = async () =>
    Promise.all(
      [
        "modules",
        "notes",
        "hdr_people",
        "task_time_entries",
        "paper_time_entries",
      ].map(async (t) => [
        t,
        (await db.query(`SELECT * FROM ${t} ORDER BY id`)).rows,
      ]),
    );
  const before = await unchanged();
  await db.exec(
    await readFile(
      new URL("../sql/0105_project_note_hdr_timers.sql", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(
    await unchanged(),
    before,
    "Paper statuses, notes, HDR students, Task and Paper timers unchanged",
  );
  assert.equal(
    (
      await db.query(
        `SELECT e.value FROM projects p JOIN "enum" e ON e.id=p.status_id WHERE p.id='${project}'`,
      )
    ).rows[0].value,
    "Active",
  );
  assert.deepEqual(
    (
      await db.query(
        `SELECT value FROM "enum" WHERE category='project_status' AND value<>'Archived' AND hidden=false ORDER BY sort_order,value`,
      )
    ).rows
      .map((r) => r.value)
      .sort(),
    ["Active", "Closed", "Complete", "Parked", "Proposed", "Stalled"],
  );
  assert.equal(
    (await db.query(`SELECT hidden FROM "enum" WHERE value='Review'`)).rows[0]
      .hidden,
    true,
  );
  assert.equal(
    Number(
      (
        await db.query(
          `SELECT count(*) FROM "enum" WHERE value='Archived' AND hidden=false`,
        )
      ).rows[0].count,
    ),
    1,
  );
  await db.exec(
    `SET ROLE research_tracker_app; SELECT set_config('app.current_user_id','${owner}',false),set_config('app.current_tenant_id','',false)`,
  );
  assert.equal(
    (await db.query("SELECT * FROM hdr_people")).rows.length,
    0,
    "Existing HDR tenant policy remains enforced",
  );
  assert.equal(
    (await db.query(`SELECT title FROM work_time_hdr_target('${hdr}')`)).rows[0]
      .title,
    "Student",
    "Timer resolves only an own student across workspaces",
  );
  const insert = (column, id, user = owner, workspace = tenant, extra = "") =>
    `INSERT INTO work_time_entries(tenant_id,user_id,${column},running_since${extra}) VALUES('${workspace}','${user}','${id}',now()-interval '3 minutes'${extra ? ",NULL" : ""}) RETURNING id`;
  const ids = [];
  for (const [column, id] of [
    ["project_id", project],
    ["note_id", note],
    ["hdr_person_id", hdr],
  ]) {
    const entry = (await db.query(insert(column, id))).rows[0].id;
    ids.push(entry);
    await assert.rejects(
      db.query(insert(column, id)),
      /unique constraint/,
      "One open timer per person per item",
    );
    await assert.rejects(
      db.query(insert(column, id, other)),
      /row-level security/,
    );
    await assert.rejects(
      db.query(insert(column, id, owner, otherTenant)),
      /row-level security/,
    );
  }
  await assert.rejects(
    db.query(
      `INSERT INTO work_time_entries(tenant_id,user_id,project_id,note_id) VALUES('${tenant}','${owner}','${project}','${note}')`,
    ),
    /check constraint/,
  );
  for (const change of [
    `user_id='${other}'`,
    `tenant_id='${otherTenant}'`,
    `project_id=NULL,note_id='${note}'`,
    `source='manual'`,
  ])
    await assert.rejects(
      db.query(`UPDATE work_time_entries SET ${change} WHERE id='${ids[0]}'`),
      /permission denied/,
    );
  await assert.rejects(
    db.query(
      `INSERT INTO work_time_entries(tenant_id,user_id,project_id,source,ended_at,duration_seconds) VALUES('${tenant}','${owner}','${project}','manual',now(),0)`,
    ),
    /check constraint/,
  );
  await db.exec(`SELECT set_config('app.current_user_id','${other}',false)`);
  assert.equal(
    (await db.query("SELECT * FROM work_time_entries")).rows.length,
    0,
    "Other users including workspace owners cannot see individual time",
  );
  assert.equal(
    (await db.query(`SELECT * FROM work_time_hdr_target('${hdr}')`)).rows
      .length,
    0,
  );
  assert.equal(
    (
      await db.query(
        `UPDATE work_time_entries SET duration_seconds=999 WHERE id='${ids[0]}' RETURNING id`,
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await db.query(
        `DELETE FROM work_time_entries WHERE id='${ids[0]}' RETURNING id`,
      )
    ).rows.length,
    0,
  );
  await db.exec(`SELECT set_config('app.current_user_id','${owner}',false)`);
  if (exerciseService)
    await exerciseService({
      owner,
      other,
      tenant,
      otherTenant,
      project,
      note,
      hdr,
      ids,
    });
  // Sharing grants access to logging one's own time, never someone else's.
  await db.exec(
    `RESET ROLE; INSERT INTO project_collaborators VALUES('${project}','${other}'); SET ROLE research_tracker_app; SELECT set_config('app.current_user_id','${other}',false)`,
  );
  await db.query(insert("project_id", project, other));
  assert.equal(
    (await db.query("SELECT * FROM work_time_entries")).rows.length,
    1,
  );
  await db.exec(
    `RESET ROLE; DELETE FROM project_collaborators; UPDATE projects SET archived_at=now() WHERE id='${project}'; SET ROLE research_tracker_app; SELECT set_config('app.current_user_id','${owner}',false)`,
  );
  await assert.rejects(
    db.query(
      `INSERT INTO work_time_entries(tenant_id,user_id,project_id,source,ended_at,duration_seconds) VALUES('${tenant}','${owner}','${project}','manual',now(),60)`,
    ),
    /row-level security/,
  );
  await db.query(
    `UPDATE work_time_entries SET running_since=NULL,ended_at=now() WHERE id='${ids[0]}'`,
  );
  await db.exec(`RESET ROLE; DELETE FROM notes WHERE id='${note}'`);
  assert.equal(
    Number(
      (
        await db.query(
          `SELECT count(*) FROM work_time_entries WHERE note_id='${note}'`,
        )
      ).rows[0].count,
    ),
    0,
    "Deleting a note removes its time entries",
  );
  for (const role of ["anon", "authenticated", "service_role"]) {
    assert.equal(
      (
        await db.query(
          `SELECT has_table_privilege('${role}','work_time_entries','SELECT') AS allowed`,
        )
      ).rows[0].allowed,
      false,
    );
    assert.equal(
      (
        await db.query(
          `SELECT has_function_privilege('${role}','work_time_hdr_target(uuid)','EXECUTE') AS allowed`,
        )
      ).rows[0].allowed,
      false,
    );
  }
  await db.exec(`DELETE FROM users WHERE id='${owner}'`);
  assert.equal(
    Number(
      (
        await db.query(
          `SELECT count(*) FROM work_time_entries WHERE user_id='${owner}'`,
        )
      ).rows[0].count,
    ),
    0,
    "Account deletion removes own time entries",
  );
}
test(
  "Project/Note/HDR timer migration, RLS, constraints, cascade and Project status retirement",
  { skip: !process.env.FLOW_WORK_TIME_TEST_DATABASE_URL },
  async () => {
    const client = new pg.Client({
      connectionString: process.env.FLOW_WORK_TIME_TEST_DATABASE_URL,
    });
    await client.connect();
    try {
      await verifyWorkTimeDatabase({
        query: (...args) => client.query(...args),
        exec: (sql) => client.query(sql),
      });
    } finally {
      await client.end();
    }
  },
);
