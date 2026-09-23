import { drizzle } from 'drizzle-orm/pg-proxy';
import { DrizzleService } from '../db/drizzle.service';
import { TasksRepository } from '../modules/tasks/repositories/tasks.repository';
import { NotesRepository } from '../modules/notes/repositories/notes.repository';
import { ProjectModulesRepository } from '../modules/project-modules/repositories/project-modules.repository';

// Exercise the real Drizzle query builders with a recording transport, without AWS.
describe('list query scope and summaries', () => {
  function setup() {
    const queries: { sql: string; params: unknown[] }[] = [];
    const db = drizzle((sql, params) => {
      queries.push({ sql, params });
      return Promise.resolve({ rows: [] });
    });
    return { queries, service: { db } as unknown as DrizzleService };
  }

  it.each([TasksRepository, NotesRepository])('filters direct project items before LIMIT and uses the same scope for counts', async (Repository) => {
    const { queries, service } = setup();
    await new Repository(service).findVisibleByTenant('tenant-a', 'user-a', 20, 20, 'project-a', '50%', true);
    expect(queries).toHaveLength(2);
    for (const query of queries) {
      expect(query.sql).toContain('"module_id" is null');
      expect(query.sql).toContain('ilike');
      expect(query.params).toEqual(expect.arrayContaining(['tenant-a', 'user-a', 'project-a', '%50\\%%']));
      expect(query.sql).toContain('exists');
    }
    const page = queries.find((query) => query.sql.includes('limit'))!;
    expect(page.sql.indexOf('"module_id" is null')).toBeLessThan(page.sql.indexOf('limit'));
    expect(page.params.slice(-2)).toEqual([20, 20]);
  });

  it('counts review stages by value across global and tenant stage IDs in the existing count query', async () => {
    const { queries, service } = setup();
    await new ProjectModulesRepository(service).findVisibleActiveByTenant('tenant-a', 'user-a', 0, 20);
    expect(queries).toHaveLength(2);
    const count = queries.find((query) => query.sql.includes('count(*)'))!;
    expect(count.sql).toContain('Submitted, Under Review');
    expect(count.sql).toContain('module_pipeline_stage');
    expect(count.sql).toContain('"tenant_id" is null or');
    expect(count.sql).toContain('"archived_at" is null');
    expect(count.params).toContain('tenant-a');
    expect(count.params).toContain('user-a');
  });

  it('counts open tasks including unset statuses without another query', async () => {
    const { queries, service } = setup();
    await new TasksRepository(service).findVisibleByTenant('tenant-a', 'user-a', 0, 20);
    expect(queries).toHaveLength(2);
    const count = queries.find((query) => query.sql.includes('count(*)'))!;
    expect(count.sql).toContain('"status_id" is null');
    expect(count.sql).toContain('not in');
    expect(count.sql).toContain('Complete');
  });
});
