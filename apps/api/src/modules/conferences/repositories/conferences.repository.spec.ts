import { drizzle } from 'drizzle-orm/pg-proxy';
import { DrizzleService } from '../../../db/drizzle.service';
import { ConferencesRepository } from './conferences.repository';

describe('ConferencesRepository', () => {
  function setup() {
    const queries: { sql: string; params: unknown[] }[] = [];
    const db = drizzle((sql, params) => {
      queries.push({ sql, params });
      return Promise.resolve({ rows: [] });
    });
    return {
      queries,
      repository: new ConferencesRepository({
        db,
      } as unknown as DrizzleService),
    };
  }

  it('lists owned active link options without a text filter for an empty search', async () => {
    const { queries, repository } = setup();
    const tenantId = '00000000-0000-4000-8000-000000000001';
    const userId = '00000000-0000-4000-8000-000000000002';

    await repository.searchOwnedLinkOptions(tenantId, userId, '');

    expect(queries).toHaveLength(2);
    for (const query of queries) {
      expect(query.sql).not.toContain('ilike');
      expect(query.sql).toContain('"archived_at" is null');
      expect(query.sql).toContain('order by');
      expect(query.params).toContain(tenantId);
      expect(query.params).toContain(userId);
      expect(query.params).toContain('Owner');
    }
  });
  it('searches papers before pagination and also matches their parent project', async () => {
    const { queries, repository } = setup();

    await repository.searchOwnedLinkOptions(
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
      'Genome',
    );

    expect(queries).toHaveLength(2);
    const paperQuery = queries.find((query) =>
      query.sql.includes('"modules"."short_title"'),
    );
    expect(paperQuery).toBeDefined();
    expect(paperQuery!.sql).toContain('"projects"."title" ilike');
    expect(paperQuery!.sql).toContain('"projects"."display_id" ilike');
    expect(paperQuery!.sql).toContain('"modules"."archived_at" is null');
    expect(paperQuery!.sql).toContain('"projects"."archived_at" is null');
    expect(paperQuery!.sql).not.toContain(' limit ');
    expect(paperQuery!.params).toContain('%Genome%');
  });

  it('uses the same ownership rule for the link picker and the save check', async () => {
    const tenantId = '00000000-0000-4000-8000-000000000001';
    const userId = '00000000-0000-4000-8000-000000000002';
    const picker = setup();
    await picker.repository.searchOwnedLinkOptions(tenantId, userId, '');
    const projectCheck = setup();
    await projectCheck.repository.findLinkableProjectIds(
      tenantId,
      ['00000000-0000-4000-8000-000000000003'],
      userId,
    );
    const paperCheck = setup();
    await paperCheck.repository.findLinkableModuleIds(
      tenantId,
      ['00000000-0000-4000-8000-000000000004'],
      userId,
    );

    // The ownership part of each query, ignoring parameter numbers and the
    // picker's sort order.
    const ownershipRule = (sql: string) => {
      const sortStart = sql.indexOf(' order by ');
      return sql
        .slice(
          sql.indexOf('"projects"."user_id" ='),
          sortStart === -1 ? undefined : sortStart,
        )
        .replace(/\$\d+/g, '$');
    };
    const [pickerProjects, pickerPapers] = picker.queries.map((query) =>
      ownershipRule(query.sql),
    );

    // Created the project, or holds its Owner role.
    expect(pickerProjects).toContain('exists (select');
    expect(ownershipRule(projectCheck.queries[0]!.sql)).toBe(pickerProjects);
    // Owns the paper's project, or holds the paper's Owner role.
    expect(pickerPapers).toContain('"module_collaborators"');
    expect(ownershipRule(paperCheck.queries[0]!.sql)).toBe(pickerPapers);
  });

  it('filters visible conferences by name, acronym, location and type when searching', async () => {
    const { queries, repository } = setup();

    await repository.findVisiblePageByUser(
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
      0,
      20,
      'robotics',
    );

    expect(queries).toHaveLength(2);
    for (const query of queries) {
      expect(query.sql).toContain('"conferences"."name" ilike');
      expect(query.sql).toContain('"conferences"."acronym" ilike');
      expect(query.sql).toContain('"conferences"."location" ilike');
      expect(query.params).toContain('%robotics%');
    }
  });

  it('does not filter by text when there is no search term', async () => {
    const { queries, repository } = setup();

    await repository.findVisiblePageByUser(
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
      0,
      20,
    );

    for (const query of queries) {
      expect(query.sql).not.toContain('ilike');
    }
  });
});
