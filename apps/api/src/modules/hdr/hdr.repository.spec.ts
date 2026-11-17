import { drizzle } from 'drizzle-orm/pg-proxy';
import { DrizzleService } from '../../db/drizzle.service';
import { HdrRepository } from './hdr.repository';

describe('Private dashboard HDR counts', () => {
  it('aggregates the whole owned workspace without loading student details or links', async () => {
    const calls: { query: string; params: unknown[] }[] = [];
    const db = drizzle((query, params) => {
      calls.push({ query, params });
      return Promise.resolve({ rows: [[31, 7, 2]] });
    });
    const repo = new HdrRepository({ db } as unknown as DrizzleService);
    expect(await repo.counts('tenant', 'owner')).toEqual({
      currentStudents: 31,
      potentialStudents: 7,
      visitingScholars: 2,
    });
    expect(calls).toHaveLength(1);
    const sql = calls[0];
    if (!sql) throw new Error('No count statement');
    expect(sql.params).toEqual(['tenant', 'owner']);
    expect(sql.query).toContain('"hdr_people"."tenant_id" = $1');
    expect(sql.query).toContain('"hdr_people"."owner_user_id" = $2');
    expect(sql.query).toContain("<> 'Visiting scholar'");
    expect(sql.query).not.toMatch(
      /limit|offset|join|research_topic|email|"name"/i,
    );
  });
});
