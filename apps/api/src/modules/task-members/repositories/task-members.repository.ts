// apps/api/src/modules/task-members/repositories/task-members.repository.ts
import { Injectable } from '@nestjs/common';
import { taskMembers, users } from '@research-tracker/migrations';
import { and, eq, inArray } from 'drizzle-orm';
import { DrizzleService } from '../../../db/drizzle.service';

@Injectable()
export class TaskMembersRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async findByTask(tenantId: string, taskId: string) {
    return this.drizzle.db
      .select({
        id: taskMembers.id,
        tenantId: taskMembers.tenantId,
        taskId: taskMembers.taskId,
        userId: taskMembers.userId,
        displayName: users.displayName,
        email: users.email,
        affiliation: users.institution,
        createdAt: taskMembers.createdAt,
      })
      .from(taskMembers)
      .innerJoin(users, eq(taskMembers.userId, users.id))
      .where(
        and(eq(taskMembers.tenantId, tenantId), eq(taskMembers.taskId, taskId)),
      );
  }

  /** Every task id this user is an explicit member of, across every tenant. */
  async findTaskIdsByUser(userId: string) {
    const rows = await this.drizzle.db
      .select({ taskId: taskMembers.taskId })
      .from(taskMembers)
      .where(eq(taskMembers.userId, userId));
    return rows.map((row) => row.taskId);
  }

  async findByTaskAndUser(tenantId: string, taskId: string, userId: string) {
    const [row] = await this.drizzle.db
      .select()
      .from(taskMembers)
      .where(
        and(
          eq(taskMembers.tenantId, tenantId),
          eq(taskMembers.taskId, taskId),
          eq(taskMembers.userId, userId),
        ),
      );
    return row;
  }

  async create(values: { tenantId: string; taskId: string; userId: string }) {
    const [row] = await this.drizzle.db
      .insert(taskMembers)
      .values(values)
      .returning();
    return row;
  }

  async deleteAllForTask(tenantId: string, taskId: string) {
    await this.drizzle.db
      .delete(taskMembers)
      .where(
        and(eq(taskMembers.tenantId, tenantId), eq(taskMembers.taskId, taskId)),
      );
  }

  async delete(tenantId: string, taskId: string, userId: string) {
    const [row] = await this.drizzle.db
      .delete(taskMembers)
      .where(
        and(
          eq(taskMembers.tenantId, tenantId),
          eq(taskMembers.taskId, taskId),
          eq(taskMembers.userId, userId),
        ),
      )
      .returning();
    return row;
  }
  /**
   * Batched version of findByTaskAndUser — checks membership across many
   * tasks in a single query, instead of one query per task (avoids the
   * N+1 pattern when listing tasks).
   */
  async findByTaskIdsAndUser(taskIds: string[], userId: string) {
    if (taskIds.length === 0) return new Set<string>();

    const rows = await this.drizzle.db
      .select({ taskId: taskMembers.taskId })
      .from(taskMembers)
      .where(
        and(
          inArray(taskMembers.taskId, taskIds),
          eq(taskMembers.userId, userId),
        ),
      );

    return new Set(rows.map((row) => row.taskId));
  }
}
