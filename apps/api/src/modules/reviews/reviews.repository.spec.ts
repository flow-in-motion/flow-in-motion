import { drizzle } from 'drizzle-orm/pg-proxy';
import { DrizzleService } from '../../db/drizzle.service';
import { ReviewKind } from './dto/review.dto';
import { ReviewsRepository } from './reviews.repository';

describe('Review status persistence', () => {
  const statements: { sql: string; params: unknown[] }[] = [];
  const db = drizzle((query, params) => {
    statements.push({ sql: query, params });
    return Promise.resolve({
      rows: query.startsWith('select count(') ? [[25]] : [],
    });
  });
  const repository = new ReviewsRepository({ db } as unknown as DrizzleService);
  function statement(index: number) {
    const value = statements[index];
    if (!value) throw new Error(`Missing SQL statement ${index}`);
    return value;
  }
  beforeEach(() => {
    statements.length = 0;
  });

  it.each(['active', 'completed'] as const)(
    'filters %s records, ownership and search before counting or pagination',
    async (scope) => {
      await repository.page(
        'tenant',
        'owner',
        ReviewKind.Journal,
        'Rare',
        2,
        20,
        scope,
      );
      expect(statements).toHaveLength(2);
      for (const statement of statements) {
        expect(statement.sql).toContain(
          scope === 'completed'
            ? '"academic_reviews"."status" = $4'
            : '"academic_reviews"."status" <> $4',
        );
        expect(statement.sql).toContain('"academic_reviews"."tenant_id" = $1');
        expect(statement.sql).toContain(
          '"academic_reviews"."owner_user_id" = $2',
        );
        expect(statement.sql).toContain('"academic_reviews"."kind" = $3');
        expect(statement.params.slice(0, 5)).toEqual([
          'tenant',
          'owner',
          'journal',
          'Complete',
          '%Rare%',
        ]);
        expect(statement.sql.indexOf(' ilike ')).toBeGreaterThan(
          statement.sql.indexOf(' where '),
        );
      }
      expect(statement(0).sql).not.toContain('limit');
      expect(statement(1).sql).toContain('limit');
      expect(statement(1).params.slice(-2)).toEqual([20, 20]);
      expect(statement(1).sql).toContain(
        scope === 'completed'
          ? 'order by "academic_reviews"."completed_at" desc'
          : 'order by "academic_reviews"."created_at" desc',
      );
    },
  );

  it('sets completion atomically, preserves an existing completion timestamp, and clears it on reopening', async () => {
    await repository.update(
      'tenant',
      'owner',
      ReviewKind.Examination,
      'record',
      { status: 'Complete' },
    );
    expect(statement(0).sql).toContain(
      '"completed_at" = coalesce("academic_reviews"."completed_at", now())',
    );
    expect(statement(0).params).toEqual(
      expect.arrayContaining([
        'Complete',
        'tenant',
        'owner',
        'examination',
        'record',
      ]),
    );
    statements.length = 0;
    await repository.update(
      'tenant',
      'owner',
      ReviewKind.Examination,
      'record',
      { status: 'Waiting' },
    );
    expect(statement(0).sql).not.toContain('coalesce');
    expect(statement(0).params).toContain(null);
    expect(statement(0).sql).toContain('"completed_at" =');
  });

  it('does not rewrite status or completion when saving other metadata', async () => {
    await repository.update('tenant', 'owner', ReviewKind.Journal, 'record', {
      journalRanking: 'Q1',
    });
    const setClause = statement(0).sql.split(' where ')[0];
    expect(setClause).not.toContain('"status" =');
    expect(setClause).not.toContain('"completed_at" =');
  });
});
