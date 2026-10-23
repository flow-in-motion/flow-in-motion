import { drizzle } from 'drizzle-orm/pg-proxy';
import { DrizzleService } from '../../../db/drizzle.service';
import { ProjectModulesRepository } from './project-modules.repository';

describe('ProjectModulesRepository submitted journals', () => {
  function setup() {
    const queries: { sql: string; params: unknown[] }[] = [];
    const db = drizzle((sql, params) => {
      queries.push({ sql, params });
      return Promise.resolve({ rows: [] });
    });

    return {
      queries,
      repository: new ProjectModulesRepository({
        db,
      } as unknown as DrizzleService),
    };
  }

  it('selects the latest submission for each requested paper in one query', async () => {
    const { queries, repository } = setup();
    const moduleIds = [
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
    ];

    await repository.findLatestSubmissionsForModules(moduleIds);

    expect(queries).toHaveLength(1);
    const query = queries[0];
    if (!query) throw new Error('Expected a submission query');

    expect(query.sql).toContain(
      'distinct on ("module_submissions"."module_id")',
    );
    expect(query.sql).toContain(
      '"modules"."tenant_id" = "module_submissions"."tenant_id"',
    );
    expect(query.sql).toContain(
      'order by "module_submissions"."module_id" asc, ' +
        '"module_submissions"."submitted_date" desc, ' +
        '"module_submissions"."created_at" desc, ' +
        '"module_submissions"."id" desc',
    );

    for (const id of moduleIds) {
      expect(query.params).toContain(id);
    }

    // Select the latest record regardless of status. The service then
    // decides whether it represents a current submission.
    expect(query.params).not.toContain('Submitted');
    expect(query.params).not.toContain('Under review');
    expect(query.params).not.toContain('Resubmitted');
    expect(query.params).not.toContain('Revision requested');
  });

  it('does not query submissions for an empty paper list', async () => {
    const { queries, repository } = setup();

    expect(await repository.findLatestSubmissionsForModules([])).toEqual([]);
    expect(queries).toHaveLength(0);
  });
});
