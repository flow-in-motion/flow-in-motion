import { Injectable } from '@nestjs/common';
import { feedback } from '@research-tracker/migrations';
import { and, desc, eq, sql } from 'drizzle-orm';
import { DrizzleService } from '../../../db/drizzle.service';

@Injectable()
export class FeedbackRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async findPageByUser(
    tenantId: string,
    userId: string,
    offset: number,
    limit: number,
  ) {
    const whereCondition = and(
      eq(feedback.tenantId, tenantId),
      eq(feedback.userId, userId),
    );

    const [data, countResult] = await Promise.all([
      this.drizzle.db
        .select()
        .from(feedback)
        .where(whereCondition)
        .orderBy(desc(feedback.createdAt), desc(feedback.id))
        .limit(limit)
        .offset(offset),

      this.drizzle.db
        .select({
          count: sql<number>`count(*)::int`,
        })
        .from(feedback)
        .where(whereCondition),
    ]);

    return {
      data,
      totalItems: countResult[0]?.count ?? 0,
    };
  }

  async findByIdAndUser(tenantId: string, feedbackId: string, userId: string) {
    const [row] = await this.drizzle.db
      .select()
      .from(feedback)
      .where(
        and(
          eq(feedback.id, feedbackId),
          eq(feedback.tenantId, tenantId),
          eq(feedback.userId, userId),
        ),
      );

    return row;
  }

  async create(values: {
    tenantId: string;
    userId: string;
    message: string;
    rating?: number;
    screenshotDataUrl?: string;
  }) {
    const [row] = await this.drizzle.db
      .insert(feedback)
      .values(values)
      .returning();

    return row;
  }

  async update(
    tenantId: string,
    feedbackId: string,
    userId: string,
    values: Partial<{
      message: string;
      rating: number;
      screenshotDataUrl: string;
    }>,
  ) {
    const [row] = await this.drizzle.db
      .update(feedback)
      .set({
        ...values,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(feedback.id, feedbackId),
          eq(feedback.tenantId, tenantId),
          eq(feedback.userId, userId),
        ),
      )
      .returning();

    return row;
  }

  async remove(tenantId: string, feedbackId: string, userId: string) {
    const [row] = await this.drizzle.db
      .delete(feedback)
      .where(
        and(
          eq(feedback.id, feedbackId),
          eq(feedback.tenantId, tenantId),
          eq(feedback.userId, userId),
        ),
      )
      .returning();

    return row;
  }
}
