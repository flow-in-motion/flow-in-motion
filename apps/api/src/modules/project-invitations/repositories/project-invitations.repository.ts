import { Injectable } from '@nestjs/common';
import { projectInvitations } from '@research-tracker/migrations';
import { and, eq, sql } from 'drizzle-orm';
import { DrizzleService } from '../../../db/drizzle.service';

@Injectable()
export class ProjectInvitationsRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async findByProject(projectId: string) {
    return this.drizzle.db
      .select()
      .from(projectInvitations)
      .where(eq(projectInvitations.projectId, projectId));
  }

  async findByToken(tokenHash: string) {
    const result = await this.drizzle.db.execute(
      sql`SELECT * FROM find_project_invitation_by_token(${tokenHash})`,
    );
    const row = result.rows[0] as
      | {
          id: string;
          project_id: string;
          email: string;
          name: string | null;
          affiliation: string | null;
          role: string;
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
      projectId: row.project_id,
      email: row.email,
      name: row.name,
      affiliation: row.affiliation,
      role: row.role,
      invitedBy: row.invited_by,
      token: row.token,
      status: row.status,
      expiresAt: row.expires_at ? new Date(row.expires_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async findById(projectId: string, id: string) {
    const [row] = await this.drizzle.db
      .select()
      .from(projectInvitations)
      .where(
        and(
          eq(projectInvitations.id, id),
          eq(projectInvitations.projectId, projectId),
        ),
      );
    return row;
  }

  async findByEmail(email: string) {
    return this.drizzle.db
      .select()
      .from(projectInvitations)
      .where(
        and(
          eq(projectInvitations.email, email),
          eq(projectInvitations.status, 'pending'),
        ),
      );
  }

  async create(values: {
    projectId: string;
    email: string;
    name?: string;
    affiliation?: string;
    role: string;
    invitedBy: string;
    token?: string;
    status?: string;
    expiresAt?: Date;
  }) {
    const [row] = await this.drizzle.db
      .insert(projectInvitations)
      .values(values)
      .returning();
    return row;
  }

  async markSent(id: string, values: { token: string; expiresAt: Date }) {
    const [row] = await this.drizzle.db
      .update(projectInvitations)
      .set({ ...values, status: 'pending', updatedAt: new Date() })
      .where(eq(projectInvitations.id, id))
      .returning();
    return row;
  }

  async markAccepted(id: string) {
    const [row] = await this.drizzle.db
      .update(projectInvitations)
      .set({ status: 'accepted', updatedAt: new Date() })
      .where(eq(projectInvitations.id, id))
      .returning();
    return row;
  }

  async delete(projectId: string, id: string) {
    const [row] = await this.drizzle.db
      .delete(projectInvitations)
      .where(
        and(
          eq(projectInvitations.id, id),
          eq(projectInvitations.projectId, projectId),
        ),
      )
      .returning();
    return row;
  }
}
