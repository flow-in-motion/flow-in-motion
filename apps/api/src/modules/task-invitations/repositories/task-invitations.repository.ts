// apps/api/src/modules/task-invitations/repositories/task-invitations.repository.ts
import { Injectable } from '@nestjs/common';
import { taskInvitations } from '@research-tracker/migrations';
import { and, eq, sql } from 'drizzle-orm';
import { DrizzleService } from '../../../db/drizzle.service';

@Injectable()
export class TaskInvitationsRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async findByTask(taskId: string) {
    return this.drizzle.db
      .select()
      .from(taskInvitations)
      .where(eq(taskInvitations.taskId, taskId));
  }

  async findByToken(tokenHash: string) {
    const result = await this.drizzle.db.execute(
      sql`SELECT * FROM find_task_invitation_by_token(${tokenHash})`,
    );
    const row = result.rows[0] as
      | {
          id: string;
          task_id: string;
          email: string;
          name: string | null;
          affiliation: string | null;
          invited_by: string;
          token: string | null;
          status: string;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        }
      | undefined;

    if (!row?.id) return undefined;

    return {
      id: row.id,
      taskId: row.task_id,
      email: row.email,
      name: row.name,
      affiliation: row.affiliation,
      invitedBy: row.invited_by,
      token: row.token,
      status: row.status,
      expiresAt: row.expires_at ? new Date(row.expires_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async findById(taskId: string, id: string) {
    const [row] = await this.drizzle.db
      .select()
      .from(taskInvitations)
      .where(
        and(eq(taskInvitations.id, id), eq(taskInvitations.taskId, taskId)),
      );
    return row;
  }

  async create(values: {
    taskId: string;
    email: string;
    name?: string;
    affiliation?: string;
    invitedBy: string;
    token?: string;
    status?: string;
    expiresAt?: Date;
  }) {
    const [row] = await this.drizzle.db
      .insert(taskInvitations)
      .values(values)
      .returning();
    return row;
  }

  async markSent(id: string, values: { token: string; expiresAt: Date }) {
    const [row] = await this.drizzle.db
      .update(taskInvitations)
      .set({ ...values, status: 'pending', updatedAt: new Date() })
      .where(eq(taskInvitations.id, id))
      .returning();
    return row;
  }

  async markAccepted(id: string) {
    const [row] = await this.drizzle.db
      .update(taskInvitations)
      .set({ status: 'accepted', updatedAt: new Date() })
      .where(eq(taskInvitations.id, id))
      .returning();
    return row;
  }

  async delete(taskId: string, id: string) {
    const [row] = await this.drizzle.db
      .delete(taskInvitations)
      .where(
        and(eq(taskInvitations.id, id), eq(taskInvitations.taskId, taskId)),
      )
      .returning();
    return row;
  }
}
