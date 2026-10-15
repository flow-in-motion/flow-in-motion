import { Injectable } from '@nestjs/common';
import { analyticsEvents } from '@research-tracker/migrations';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { DrizzleService } from '../../../db/drizzle.service';

@Injectable()
export class AnalyticsRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async create(values: {
    tenantId: string;
    userId: string;
    name: string;
    path?: string;
    sessionId?: string;
    pageKey?: string;
    featureKey?: string;
    properties?: Record<string, unknown>;
  }) {
    const [row] = await this.drizzle.db
      .insert(analyticsEvents)
      .values(values)
      .returning();

    return row;
  }

  /** Counts per event name since `since`, most frequent first. */
  async countsByName(tenantId: string, since: Date) {
    return this.drizzle.db
      .select({
        name: analyticsEvents.name,
        count: sql<number>`count(*)::int`,
      })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.tenantId, tenantId),
          gte(analyticsEvents.createdAt, since),
        ),
      )
      .groupBy(analyticsEvents.name)
      .orderBy(desc(sql`count(*)`));
  }

  /** Total events per calendar day since `since`, oldest first. */
  async dailyTotals(tenantId: string, since: Date) {
    const day = sql<string>`to_char(${analyticsEvents.createdAt}, 'YYYY-MM-DD')`;
    return this.drizzle.db
      .select({
        day,
        count: sql<number>`count(*)::int`,
      })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.tenantId, tenantId),
          gte(analyticsEvents.createdAt, since),
        ),
      )
      .groupBy(day)
      .orderBy(day);
  }
}
