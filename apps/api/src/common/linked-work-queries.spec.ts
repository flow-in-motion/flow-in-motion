import { drizzle } from 'drizzle-orm/pg-proxy';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DrizzleService } from '../db/drizzle.service';
import { LinkedWorkPaginationQueryDto } from './dto/pagination-query.dto';
import { TaskListQueryDto } from '../modules/tasks/dto/task-list-query.dto';
import { TasksRepository } from '../modules/tasks/repositories/tasks.repository';
import { NotesRepository } from '../modules/notes/repositories/notes.repository';

describe('paper-scoped linked-work queries', () => {
  const tenantId = '00000000-0000-4000-8000-000000000001';
  const userId = '00000000-0000-4000-8000-000000000002';
  const paperId = '00000000-0000-4000-8000-000000000024';

  it.each([TaskListQueryDto, LinkedWorkPaginationQueryDto])(
    'validates the optional paper filter and retains the existing list controls',
    async (dtoClass) => {
      const dto = plainToInstance(dtoClass, {
        moduleId: paperId,
        pageSize: 'all',
        search: 'research',
      });
      expect(
        await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
      ).toEqual([]);
      expect(dto.moduleId).toBe(paperId);
      expect(dto.pageSize).toBe('all');
      expect(
        await validate(plainToInstance(dtoClass, { moduleId: 'invalid' })),
      ).not.toHaveLength(0);
    },
  );

  it.each(['tasks', 'notes'] as const)(
    'filters both %s rows and totals before pagination, retaining visibility and archive checks',
    async (table) => {
      const queries: Array<{ sql: string; params: unknown[] }> = [];
      const db = drizzle((sql, params) => {
        queries.push({ sql, params });
        return Promise.resolve({ rows: [] });
      });
      const service = { db } as unknown as DrizzleService;
      if (table === 'tasks') {
        await new TasksRepository(service).findVisibleByTenant(
          tenantId,
          userId,
          0,
          1000,
          undefined,
          undefined,
          false,
          undefined,
          undefined,
          paperId,
        );
      } else {
        await new NotesRepository(service).findVisibleByTenant(
          tenantId,
          userId,
          0,
          1000,
          undefined,
          undefined,
          false,
          paperId,
        );
      }

      expect(queries).toHaveLength(2);
      for (const query of queries) {
        expect(query.sql).toContain(`"${table}"."module_id" = $`);
        expect(query.params).toContain(paperId);
        expect(query.params).toContain(tenantId);
        expect(query.params).toContain(userId);
        expect(query.sql).toContain(`"${table}"."created_by" = $`);
        expect(query.sql).toContain(
          table === 'tasks' ? '"task_members"' : '"note_members"',
        );
        expect(query.sql).toContain('"projects"."archived_at" is null');
        expect(query.sql).toContain('"modules"."archived_at" is null');
      }
      expect(queries.some((query) => query.sql.includes('count(*)'))).toBe(
        true,
      );
    },
  );
});
