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
});
