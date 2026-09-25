import { Injectable } from '@nestjs/common';
import { projectCollaborators, projects } from '@research-tracker/migrations';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { DrizzleService } from '../../../db/drizzle.service';

@Injectable()
export class ProjectsRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async findById(tenantId: string, projectId: string) {
    const [project] = await this.drizzle.db
      .select()
      .from(projects)
      .where(and(eq(projects.tenantId, tenantId), eq(projects.id, projectId)));
    return project;
  }

  /** Tenant-agnostic single-project fetch, used to resolve a project's own tenant. */
  async findByIdGlobal(projectId: string) {
    const [project] = await this.drizzle.db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));
    return project;
  }
  async findGeneralByTenant(tenantId: string) {
    const [project] = await this.drizzle.db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.tenantId, tenantId),
          isNull(projects.archivedAt),
          sql`lower(btrim(${projects.title})) = 'general'`,
        ),
      )
      .limit(1);

    return project;
  }

  /** Tenant-agnostic multi-project fetch, for listing across a caller's collaborations. */
  async findAccessiblePageByUser(
    userId: string,
    offset: number,
    limit: number,
  ) {
    const whereCondition = and(
      eq(projectCollaborators.userId, userId),
      isNull(projects.archivedAt),
    );

    const [rows, countResult] = await Promise.all([
      this.drizzle.db
        .selectDistinct({
          project: projects,
        })
        .from(projectCollaborators)
        .innerJoin(
          projects,
          and(
            eq(projects.id, projectCollaborators.projectId),
            eq(projects.tenantId, projectCollaborators.tenantId),
          ),
        )
        .where(whereCondition)
        .orderBy(desc(projects.createdAt), desc(projects.id))
        .limit(limit)
        .offset(offset),

      this.drizzle.db
        .select({
          count: sql<number>`
            count(distinct ${projects.id})::int
          `,
        })
        .from(projectCollaborators)
        .innerJoin(
          projects,
          and(
            eq(projects.id, projectCollaborators.projectId),
            eq(projects.tenantId, projectCollaborators.tenantId),
          ),
        )
        .where(whereCondition),
    ]);

    return {
      data: rows.map((row) => row.project),
      totalItems: countResult[0]?.count ?? 0,
    };
  }

  async findActiveByTenant(tenantId: string, offset: number, limit: number) {
    const whereCondition = and(
      eq(projects.tenantId, tenantId),
      isNull(projects.archivedAt),
      sql`lower(btrim(${projects.title})) <> 'general'`,
    );

    const [data, countResult] = await Promise.all([
      this.drizzle.db
        .select()
        .from(projects)
        .where(whereCondition)
        .limit(limit)
        .offset(offset),

      this.drizzle.db
        .select({ count: sql<number>`count(*)::int` })
        .from(projects)
        .where(whereCondition),
    ]);

    return {
      data,
      totalItems: countResult[0]?.count ?? 0,
    };
  }

  async create(
    values: {
      userId: string;
      tenantId: string;
      title: string;
      description?: string;
      researchArea?: string;
      statusId?: string;
      importanceId?: string;
      scheduledFor?: string;
      dueDate?: string;
      totalBudget?: string;
      targetJournals?: string;
      displayId?: string;
    },
    ownerRoleId: string,
  ) {
    const [project] = await this.drizzle.db
      .insert(projects)
      .values(values)
      .returning();

    if (!project) {
      return undefined;
    }

    await this.drizzle.db.insert(projectCollaborators).values({
      tenantId: values.tenantId,
      projectId: project.id,
      userId: values.userId,
      roleId: ownerRoleId,
    });

    return project;
  }

  async update(
    tenantId: string,
    projectId: string,
    values: Partial<{
      title: string;
      description: string;
      researchArea: string;
      statusId: string;
      importanceId: string;
      scheduledFor: string;
      dueDate: string;
      totalBudget: string;
      targetJournals: string;
    }>,
  ) {
    const [project] = await this.drizzle.db
      .update(projects)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(projects.tenantId, tenantId), eq(projects.id, projectId)))
      .returning();
    return project;
  }

  async archive(tenantId: string, projectId: string, archivedStatusId: string) {
    const [project] = await this.drizzle.db
      .update(projects)
      .set({
        statusId: archivedStatusId,
        archivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(projects.tenantId, tenantId), eq(projects.id, projectId)))
      .returning();
    return project;
  }
}
