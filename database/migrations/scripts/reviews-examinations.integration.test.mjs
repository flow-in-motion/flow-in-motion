import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";

// EMPTY disposable database only. No production connection or real people.
export async function verifyReviewsDatabase(db, exerciseService) {
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
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE ROLE research_tracker_app;
    CREATE TABLE users(id uuid PRIMARY KEY); CREATE TABLE tenants(id uuid PRIMARY KEY);
    CREATE TABLE hdr_people(id uuid PRIMARY KEY,name text);
    CREATE TABLE projects(id uuid PRIMARY KEY,title text);
    CREATE TABLE modules(id uuid PRIMARY KEY,title text);
    CREATE TABLE tasks(id uuid PRIMARY KEY,title text);
    CREATE TABLE notes(id uuid PRIMARY KEY,title text);
    CREATE TABLE conferences(id uuid PRIMARY KEY,title text);
    GRANT USAGE ON SCHEMA public TO research_tracker_app;`);
  await db.exec(
    await readFile(
      new URL("../sql/0104_reviews_examinations.sql", import.meta.url),
      "utf8",
    ),
  );
  const owner = "11111111-1111-4111-8111-111111111111";
  const other = "22222222-2222-4222-8222-222222222222";
  const tenant = "33333333-3333-4333-8333-333333333333";
  const otherTenant = "44444444-4444-4444-8444-444444444444";
  await db.exec(`INSERT INTO users VALUES ('${owner}'),('${other}'); INSERT INTO tenants VALUES ('${tenant}'),('${otherTenant}');
    INSERT INTO hdr_people VALUES (gen_random_uuid(),'Existing student');
    INSERT INTO projects VALUES (gen_random_uuid(),'Existing project'); INSERT INTO modules VALUES (gen_random_uuid(),'Existing paper');
    INSERT INTO tasks VALUES (gen_random_uuid(),'Existing task'); INSERT INTO notes VALUES (gen_random_uuid(),'Existing note'); INSERT INTO conferences VALUES (gen_random_uuid(),'Existing conference');`);
  const work = async () =>
    Promise.all(
      [
        "hdr_people",
        "projects",
        "modules",
        "tasks",
        "notes",
        "conferences",
      ].map(async (t) => [
        t,
        (await db.query(`SELECT * FROM ${t} ORDER BY id`)).rows,
      ]),
    );
  const before = await work();
  await db.exec(
    `SET ROLE research_tracker_app; SELECT set_config('app.current_user_id','${owner}',false),set_config('app.current_tenant_id','${tenant}',false)`,
  );
  const examination = (
    await db.query(
      `INSERT INTO academic_reviews(tenant_id,owner_user_id,kind,student_name,student_number) VALUES ('${tenant}','${owner}','examination','Student','001234') RETURNING id`,
    )
  ).rows[0].id;
  const journal = (
    await db.query(
      `INSERT INTO academic_reviews(tenant_id,owner_user_id,kind,manuscript_title) VALUES ('${tenant}','${owner}','journal','Manuscript') RETURNING id`,
    )
  ).rows[0].id;
  const note = (
    await db.query(
      `INSERT INTO academic_review_notes(tenant_id,review_id,content) VALUES ('${tenant}','${examination}','Private note') RETURNING id`,
    )
  ).rows[0].id;
  assert.equal(
    (
      await db.query(
        `SELECT student_number FROM academic_reviews WHERE id='${examination}'`,
      )
    ).rows[0].student_number,
    "001234",
  );
  for (const query of [
    `INSERT INTO academic_reviews(tenant_id,owner_user_id,kind,student_name) VALUES ('${tenant}','${other}','examination','Other owner')`,
    `INSERT INTO academic_reviews(tenant_id,owner_user_id,kind,student_name) VALUES ('${otherTenant}','${owner}','examination','Other workspace')`,
    `INSERT INTO academic_review_notes(tenant_id,review_id,content) VALUES ('${otherTenant}','${examination}','Cross-workspace note')`,
  ])
    await assert.rejects(db.query(query), /row-level security|foreign key/);
  for (const [column, value] of [
    ["owner_user_id", `'${other}'`],
    ["tenant_id", `'${otherTenant}'`],
    ["kind", "'journal'"],
    ["id", "gen_random_uuid()"],
  ])
    await assert.rejects(
      db.query(
        `UPDATE academic_reviews SET ${column}=${value} WHERE id='${examination}'`,
      ),
      /permission denied/,
    );
  await assert.rejects(
    db.query(
      `UPDATE academic_review_notes SET review_id='${journal}' WHERE id='${note}'`,
    ),
    /permission denied/,
  );
  for (const query of [
    `UPDATE academic_reviews SET student_name='   ' WHERE id='${examination}'`,
    `UPDATE academic_reviews SET degree_type='Unknown' WHERE id='${examination}'`,
    `UPDATE academic_reviews SET manuscript_title='Wrong kind' WHERE id='${examination}'`,
    `UPDATE academic_reviews SET requested_on='2027-02-01',due_on='2027-01-01' WHERE id='${examination}'`,
    `UPDATE academic_review_notes SET content='   ' WHERE id='${note}'`,
  ])
    await assert.rejects(db.query(query), /check constraint/);
  await db.exec(`SELECT set_config('app.current_user_id','${other}',false)`);
  for (const table of ["academic_reviews", "academic_review_notes"])
    assert.equal(
      (await db.query(`SELECT * FROM ${table}`)).rows.length,
      0,
      "Another workspace member cannot read private records",
    );
  assert.equal(
    (
      await db.query(
        `UPDATE academic_reviews SET student_name='Changed' WHERE id='${examination}' RETURNING id`,
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await db.query(
        `DELETE FROM academic_reviews WHERE id='${examination}' RETURNING id`,
      )
    ).rows.length,
    0,
  );
  await assert.rejects(
    db.query(
      `INSERT INTO academic_review_notes(tenant_id,review_id,content) VALUES ('${tenant}','${examination}','Foreign note')`,
    ),
    /row-level security/,
  );
  assert.equal(
    (
      await db.query(
        `UPDATE academic_review_notes SET content='Changed' WHERE id='${note}' RETURNING id`,
      )
    ).rows.length,
    0,
  );
  await db.exec(
    `SELECT set_config('app.current_user_id','${owner}',false),set_config('app.current_tenant_id','${otherTenant}',false)`,
  );
  for (const table of ["academic_reviews", "academic_review_notes"])
    assert.equal(
      (await db.query(`SELECT * FROM ${table}`)).rows.length,
      0,
      "Other workspace cannot read private records",
    );
  await db.exec(`SELECT set_config('app.current_tenant_id','${tenant}',false)`);
  if (exerciseService)
    await exerciseService({
      owner,
      other,
      tenant,
      otherTenant,
      examination,
      journal,
      note,
    });
  await db.exec(`DELETE FROM academic_reviews WHERE id='${examination}'`);
  assert.equal(
    (
      await db.query(
        `SELECT * FROM academic_review_notes WHERE review_id='${examination}'`,
      )
    ).rows.length,
    0,
    "Record deletion cascades to its notes",
  );
  assert.equal(
    (await db.query(`SELECT id FROM academic_reviews WHERE id='${journal}'`))
      .rows.length,
    1,
    "Deleting an examination preserves journal reviews",
  );
  await db.exec("RESET ROLE");
  assert.deepEqual(
    await work(),
    before,
    "HDR students and projects/papers/tasks/notes/conferences unchanged",
  );
  for (const role of ["anon", "authenticated", "service_role"])
    for (const table of ["academic_reviews", "academic_review_notes"])
      assert.equal(
        (
          await db.query(
            `SELECT has_table_privilege('${role}','${table}','SELECT') AS allowed`,
          )
        ).rows[0].allowed,
        false,
      );
  await db.exec(`DELETE FROM users WHERE id='${owner}'`);
  assert.equal(
    Number(
      (await db.query("SELECT count(*) FROM academic_reviews")).rows[0].count,
    ),
    0,
    "Account deletion removes review records",
  );
  assert.equal(
    Number(
      (await db.query("SELECT count(*) FROM academic_review_notes")).rows[0]
        .count,
    ),
    0,
    "Account deletion removes review notes",
  );
}

test(
  "Reviews/examinations private records, notes, validation and unchanged existing work",
  { skip: !process.env.FLOW_REVIEWS_TEST_DATABASE_URL },
  async () => {
    const client = new pg.Client({
      connectionString: process.env.FLOW_REVIEWS_TEST_DATABASE_URL,
    });
    await client.connect();
    try {
      await verifyReviewsDatabase({
        query: (...args) => client.query(...args),
        exec: (sql) => client.query(sql),
      });
    } finally {
      await client.end();
    }
  },
);
