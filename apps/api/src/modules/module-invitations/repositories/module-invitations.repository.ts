import { Injectable } from '@nestjs/common';
import { moduleInvitations } from '@research-tracker/migrations';
import { and, eq, sql } from 'drizzle-orm';
import { DrizzleService } from '../../../db/drizzle.service';

@Injectable()
export class ModuleInvitationsRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async findByModule(moduleId: string) {
    return this.drizzle.db
      .select()
      .from(moduleInvitations)
      .where(eq(moduleInvitations.moduleId, moduleId));
  }

  async findByToken(tokenHash: string) {
    const result = await this.drizzle.db.execute(
      sql`SELECT * FROM find_module_invitation_by_token(${tokenHash})`,
    );
    const row = result.rows[0] as
      | {
          id: string;
          module_id: string;
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
      moduleId: row.module_id,
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

  async findById(moduleId: string, id: string) {
    const [row] = await this.drizzle.db
      .select()
      .from(moduleInvitations)
      .where(
        and(
          eq(moduleInvitations.id, id),
          eq(moduleInvitations.moduleId, moduleId),
        ),
      );
    return row;
  }

  async findByEmail(email: string) {
    return this.drizzle.db
      .select()
      .from(moduleInvitations)
      .where(
        and(
          eq(moduleInvitations.email, email),
          eq(moduleInvitations.status, 'pending'),
        ),
      );
  }

  async create(values: {
    moduleId: string;
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
      .insert(moduleInvitations)
      .values(values)
      .returning();
    return row;
  }

  async markSent(id: string, values: { token: string; expiresAt: Date }) {
    const [row] = await this.drizzle.db
      .update(moduleInvitations)
      .set({ ...values, status: 'pending', updatedAt: new Date() })
      .where(eq(moduleInvitations.id, id))
      .returning();
    return row;
  }

  async markAccepted(id: string) {
    const [row] = await this.drizzle.db
      .update(moduleInvitations)
      .set({ status: 'accepted', updatedAt: new Date() })
      .where(eq(moduleInvitations.id, id))
      .returning();
    return row;
  }

  async delete(moduleId: string, id: string) {
    const [row] = await this.drizzle.db
      .delete(moduleInvitations)
      .where(
        and(
          eq(moduleInvitations.id, id),
          eq(moduleInvitations.moduleId, moduleId),
        ),
      )
      .returning();
    return row;
  }
}
