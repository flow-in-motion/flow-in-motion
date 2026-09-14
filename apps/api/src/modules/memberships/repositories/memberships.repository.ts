import { Injectable } from '@nestjs/common';
import { tenantMemberships, users } from '@research-tracker/migrations';
import { and, asc, eq, sql } from 'drizzle-orm';
import { DrizzleService } from '../../../db/drizzle.service';

@Injectable()
export class MembershipsRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async findActiveMembersPageByTenant(
    tenantId: string,
    offset: number,
    limit: number,
  ) {
    const whereCondition = and(
      eq(tenantMemberships.tenantId, tenantId),
      eq(tenantMemberships.status, 'active'),
    );

    const [data, countResult] = await Promise.all([
      this.drizzle.db
        .select({
          id: tenantMemberships.id,
          tenantId: tenantMemberships.tenantId,
          userId: tenantMemberships.userId,
          email: users.email,
          displayName: users.displayName,
          affiliation: users.institution,
          role: tenantMemberships.role,
          status: tenantMemberships.status,
          invitedAt: tenantMemberships.invitedAt,
          joinedAt: tenantMemberships.joinedAt,
          createdAt: tenantMemberships.createdAt,
          updatedAt: tenantMemberships.updatedAt,
        })
        .from(tenantMemberships)
        .innerJoin(users, eq(users.id, tenantMemberships.userId))
        .where(whereCondition)
        .orderBy(asc(users.displayName), asc(tenantMemberships.id))
        .limit(limit)
        .offset(offset),

      this.drizzle.db
        .select({
          count: sql<number>`count(*)::int`,
        })
        .from(tenantMemberships)
        .innerJoin(users, eq(users.id, tenantMemberships.userId))
        .where(whereCondition),
    ]);

    return {
      data,
      totalItems: countResult[0]?.count ?? 0,
    };
  }

  async findMembershipByTenantAndUser(tenantId: string, userId: string) {
    const result = await this.drizzle.db.execute(
      sql`SELECT * FROM check_tenant_membership(${tenantId}::uuid, ${userId}::uuid)`,
    );
    return result.rows[0] as
      { id: string; role: string; status: string } | undefined;
  }
}
