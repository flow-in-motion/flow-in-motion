import assert from "node:assert/strict";
import test from "node:test";

import {
  buildUsageReport,
  escapeHtml,
  pageLabel,
  participantLabel,
  toCsv,
} from "./usage-report.mjs";

test("escapes report and CSV values", () => {
  assert.equal(escapeHtml("<script>"), "&lt;script&gt;");
  assert.equal(
    toCsv([{ name: 'Ada, "A"' }], [{ key: "name", label: "Name" }]),
    '"Name"\n"Ada, ""A"""',
  );
});

test("deidentified participant labels are stable and omit identifying fields", () => {
  const row = {
    user_id: "user-1",
    display_name: "Ada",
    email: "ada@example.test",
  };
  const first = participantLabel(row, true);
  assert.equal(first, participantLabel(row, true));
  assert.doesNotMatch(first, /Ada|example/);
});

test("labels future features clearly", () => {
  assert.equal(
    pageLabel("future_features", "document_builder"),
    "Future features: document builder",
  );
});

test("builds a readable report without raw identifiers", () => {
  const report = buildUsageReport({
    generatedAt: "2026-10-15T00:00:00.000Z",
    weeks: 4,
    totals: {
      registered_users: 1,
      ever_active_users: 1,
      current_week: "2026-10-12",
    },
    weeklyActivity: [
      {
        tenant_id: "tenant-secret",
        user_id: "user-secret",
        tenant_name: "Research",
        display_name: "Ada",
        email: "ada@example.test",
        week_start: "2026-10-12",
        sessions: 2,
        active_days: 2,
        page_views: 7,
      },
    ],
    pageVisits: [
      {
        tenant_id: "tenant-secret",
        user_id: "user-secret",
        tenant_name: "Research",
        display_name: "Ada",
        email: "ada@example.test",
        week_start: "2026-10-12",
        page_key: "pipeline",
        feature_key: null,
        visits: 4,
      },
    ],
    snapshots: [],
    unattributedPapers: [{ paper_count: 3 }],
  });

  assert.match(report.html, /Ada/);
  assert.match(report.html, /Not captured/);
  assert.deepEqual(report.platformPageRows, [{ page: "Pipeline", visits: 4 }]);
  assert.doesNotMatch(report.html, /tenant-secret|user-secret/);
});
