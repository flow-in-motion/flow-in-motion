import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import pg from "pg";
import { verifyWorkTimeDatabase } from "./work-time-entries.integration.test.mjs";

// Empty disposable database only. No hosted or participant data.
export async function verifyReviewTimersDatabase(db, exerciseService) {
  await verifyWorkTimeDatabase(db, async ({ owner, other, ids }) => {
    // The original timer harness creates its own tenant IDs; read these from the parents.
    await db.exec("RESET ROLE");
    const workspace = (
      await db.query("SELECT id,tenant_id FROM hdr_people ORDER BY id")
    ).rows;
    const home = workspace.find(
      (row) => row.id === "77777777-7777-4777-8777-777777777777",
    ).tenant_id;
    const away = "44444444-4444-4444-8444-444444444444";
    const sqlRoot = new URL("../sql/", import.meta.url);
    const files = await readdir(sqlRoot);
    await db.exec(
      await readFile(
        new URL(
          files.find((file) => file.startsWith("0104_")),
          sqlRoot,
        ),
        "utf8",
      ),
    );
    const supervision = await readFile(
      new URL("0107_hdr_supervision_review_status.sql", sqlRoot),
      "utf8",
    );
    for (const statement of supervision.split("--> statement-breakpoint")) {
      if (/academic_reviews/.test(statement)) await db.exec(statement);
    }
    await db.exec(
      `CREATE TABLE conferences(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), intents text[] NOT NULL DEFAULT '{}', CONSTRAINT conferences_intents_check CHECK(intents <@ ARRAY['Considering','Submitting','Attending']::text[] AND array_position(intents,NULL) IS NULL));`,
    );
    await db.exec(
      await readFile(
        new URL("0108_conference_presented_review_timers.sql", sqlRoot),
        "utf8",
      ),
    );
    const review = "90000000-0000-4000-8000-000000000001";
    const examination = "90000000-0000-4000-8000-000000000002";
    const privateReview = "90000000-0000-4000-8000-000000000003";
    const awayReview = "90000000-0000-4000-8000-000000000004";
    await db.exec(`INSERT INTO academic_reviews(id,tenant_id,owner_user_id,kind,manuscript_title,due_on) VALUES
      ('${review}','${home}','${owner}','journal','Owned review','2027-01-02'),
      ('${privateReview}','${home}','${other}','journal','Other person private review','2027-01-03'),
      ('${awayReview}','${away}','${owner}','journal','Other workspace review','2027-01-04');
      INSERT INTO academic_reviews(id,tenant_id,owner_user_id,kind,student_name,due_on) VALUES ('${examination}','${home}','${owner}','examination','Owned examination','2027-01-01');
      INSERT INTO academic_reviews(tenant_id,owner_user_id,kind,manuscript_title,due_on) SELECT '${home}','${owner}','journal','Review '||n,'2027-01-10' FROM generate_series(1,26) n;
      INSERT INTO conferences(intents) VALUES(ARRAY['Presented','Attending']);`);
    await assert.rejects(
      db.exec("INSERT INTO conferences(intents) VALUES(ARRAY['Invalid'])"),
      /conferences_intents_check/,
    );
    await assert.rejects(
      db.exec(
        "INSERT INTO conferences(intents) VALUES(ARRAY['Presented',NULL])",
      ),
      /conferences_intents_check/,
    );
    for (const role of ["anon", "authenticated", "service_role"]) {
      const result = await db.query(
        `SELECT has_function_privilege('${role}','public.work_time_review_target(uuid,text)','EXECUTE') AS allowed`,
      );
      assert.equal(result.rows[0].allowed, false);
    }
    await db.exec(
      `SET ROLE research_tracker_app; SELECT set_config('app.current_user_id','${owner}',false),set_config('app.current_tenant_id','${home}',false)`,
    );
    assert.equal(
      (
        await db.query(
          `SELECT * FROM work_time_review_target('${review}','journal')`,
        )
      ).rows.length,
      1,
    );
    assert.equal(
      (
        await db.query(
          `SELECT * FROM work_time_review_target('${privateReview}','journal')`,
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (
        await db.query(
          `SELECT * FROM work_time_review_target('${review}','examination')`,
        )
      ).rows.length,
      0,
    );
    const insert = (column, id, who = owner, where = home) =>
      `INSERT INTO work_time_entries(user_id,tenant_id,${column}) VALUES('${who}','${where}','${id}') RETURNING id`;
    const reviewEntry = (await db.query(insert("review_id", review))).rows[0]
      .id;
    const examEntry = (await db.query(insert("examination_id", examination)))
      .rows[0].id;
    await assert.rejects(
      db.exec(insert("review_id", review)),
      /work_time_open_review/,
    );
    await assert.rejects(
      db.exec(insert("examination_id", examination)),
      /work_time_open_examination/,
    );
    await assert.rejects(
      db.exec(insert("review_id", privateReview)),
      /row-level security/,
    );
    await assert.rejects(
      db.exec(insert("review_id", examination)),
      /row-level security/,
    );
    await assert.rejects(
      db.exec(insert("examination_id", review)),
      /row-level security/,
    );
    await assert.rejects(
      db.exec(insert("review_id", review, other)),
      /row-level security/,
    );
    await assert.rejects(
      db.exec(insert("review_id", review, owner, away)),
      /row-level security/,
    );
    await assert.rejects(
      db.exec(
        `INSERT INTO work_time_entries(user_id,tenant_id,review_id,examination_id) VALUES('${owner}','${home}','${review}','${examination}')`,
      ),
      /work_time_one_target/,
    );
    await assert.rejects(
      db.exec(
        `UPDATE work_time_entries SET review_id='${privateReview}' WHERE id='${reviewEntry}'`,
      ),
      /permission denied/,
    );
    if (exerciseService)
      await exerciseService({
        owner,
        other,
        home,
        away,
        review,
        examination,
        privateReview,
        awayReview,
        reviewEntry,
        examEntry,
        ids,
      });
    await db.exec(
      `RESET ROLE; DELETE FROM academic_reviews; SET ROLE research_tracker_app; SELECT set_config('app.current_user_id','${owner}',false)`,
    );
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int AS n FROM work_time_entries WHERE review_id IS NOT NULL OR examination_id IS NOT NULL",
        )
      ).rows[0].n,
      0,
    );
  });
}
test(
  "review timers migration, owner isolation, target constraints and deletion cascade",
  { skip: !process.env.FLOW_REVIEW_TIMER_TEST_DATABASE_URL },
  async () => {
    const client = new pg.Client({
      connectionString: process.env.FLOW_REVIEW_TIMER_TEST_DATABASE_URL,
    });
    await client.connect();
    try {
      await verifyReviewTimersDatabase({
        query: (...args) => client.query(...args),
        exec: (sql) => client.query(sql),
      });
    } finally {
      await client.end();
    }
  },
);
