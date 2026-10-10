// apps/api/src/modules/module-collaborators/repositories/module-collaborators.repository.ts
import { Injectable } from '@nestjs/common';
import {
  moduleCollaborators,
  moduleInvitations,
} from '@research-tracker/migrations';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { DrizzleService } from '../../../db/drizzle.service';

@Injectable()
export class ModuleCollaboratorsRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async findByModule(tenantId: string, moduleId: string) {
    return this.drizzle.db
      .select()
      .from(moduleCollaborators)
      .where(
        and(
          eq(moduleCollaborators.tenantId, tenantId),
          eq(moduleCollaborators.moduleId, moduleId),
        ),
      );
  }

  async findInvitationContactsByModule(moduleId: string) {
    return this.drizzle.db
      .select({
        invitationId: moduleInvitations.id,
        email: moduleInvitations.email,
        displayName: moduleInvitations.name,
        affiliation: moduleInvitations.affiliation,
      })
      .from(moduleInvitations)
      .where(eq(moduleInvitations.moduleId, moduleId));
  }

  async findByModuleAndUser(
    tenantId: string,
    moduleId: string,
    userId: string,
  ) {
    const [row] = await this.drizzle.db
      .select()
      .from(moduleCollaborators)
      .where(
        and(
          eq(moduleCollaborators.tenantId, tenantId),
          eq(moduleCollaborators.moduleId, moduleId),
          eq(moduleCollaborators.userId, userId),
        ),
      );
    return row;
  }

  /** Every independent-module id this user collaborates on, across every tenant. */
  async findModuleIdsByUser(userId: string) {
    const rows = await this.drizzle.db
      .select({ moduleId: moduleCollaborators.moduleId })
      .from(moduleCollaborators)
      .where(eq(moduleCollaborators.userId, userId));
    return rows.map((row) => row.moduleId);
  }

  async create(values: {
    tenantId: string;
    projectId?: string;
    moduleId: string;
    userId: string;
    roleId: string;
  }) {
    const [row] = await this.drizzle.db
      .insert(moduleCollaborators)
      .values(values)
      .returning();
    return row;
  }

  async updateRole(
    tenantId: string,
    moduleId: string,
    userId: string,
    roleId: string,
  ) {
    const [row] = await this.drizzle.db
      .update(moduleCollaborators)
      .set({ roleId, updatedAt: new Date() })
      .where(
        and(
          eq(moduleCollaborators.tenantId, tenantId),
          eq(moduleCollaborators.moduleId, moduleId),
          eq(moduleCollaborators.userId, userId),
        ),
      )
      .returning();
    return row;
  }

  async delete(tenantId: string, moduleId: string, userId: string) {
    const [row] = await this.drizzle.db
        .delete(moduleCollaborators)
        .where(
          and(
            eq(moduleCollaborators.tenantId, tenantId),
            eq(moduleCollaborators.moduleId, moduleId),
            eq(moduleCollaborators.userId, userId),
          ),
        )
        .returning();
    return row;
  }
  /**
   * Pre-context bypass, used only by guards that run before
   * RequestContextInterceptor sets app.current_user_id.
   */
  async checkAccessForGuard(moduleId: string, userId: string) {
    const result = await this.drizzle.db.execute(
      sql`SELECT * FROM check_module_collaborator(${moduleId}::uuid, ${userId}::uuid)`,
    );
    return result.rows[0] as { id: string; roleId: string } | undefined;
  }

  /**
   * Batched version of findByModuleAndUser — checks membership across many
   * modules in a single query, instead of one query per module (avoids the
   * N+1 pattern when listing modules).
   */
  async findByModuleIdsAndUser(moduleIds: string[], userId: string) {
    if (moduleIds.length === 0) return new Set<string>();

    const rows = await this.drizzle.db
      .select({ moduleId: moduleCollaborators.moduleId })
      .from(moduleCollaborators)
      .where(
        and(
          inArray(moduleCollaborators.moduleId, moduleIds),
          eq(moduleCollaborators.userId, userId),
        ),
      );

    return new Set(rows.map((row) => row.moduleId));
  }
}
