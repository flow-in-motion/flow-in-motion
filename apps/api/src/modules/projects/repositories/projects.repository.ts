import { Injectable } from '@nestjs/common';
import {
  modules,
  notes,
  projectCollaborators,
  projects,
  tasks,
} from '@research-tracker/migrations';
import { and, desc, eq, ilike, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { DrizzleService } from '../../../db/drizzle.service';
import { searchPattern } from '../../../common/pagination';

@Injectable()
export class ProjectsRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async findById(tenantId: string, projectId: string) {
    const [project] = await this.drizzle.db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.tenantId, tenantId),
          eq(projects.id, projectId),
          isNull(projects.archivedAt),
        ),
      );
    return project;
  }

  /** Tenant-agnostic single-project fetch, used to resolve a project's own tenant. */
  async findByIdGlobal(projectId: string) {
    const [project] = await this.drizzle.db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), isNull(projects.archivedAt)));
    return project;
  }

  async findArchivedById(tenantId: string, projectId: string) {
    const [project] = await this.drizzle.db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.tenantId, tenantId),
          eq(projects.id, projectId),
          isNotNull(projects.archivedAt),
        ),
      );
    return project;
  }

  async findArchivedByTenant(tenantId: string, ownerUserId: string) {
    return this.drizzle.db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.tenantId, tenantId),
          eq(projects.userId, ownerUserId),
          isNotNull(projects.archivedAt),
        ),
      )
      .orderBy(desc(projects.archivedAt), desc(projects.id));
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

  async findActiveByTenant(
    tenantId: string,
    offset: number,
    limit: number,
    search?: string,
  ) {
    const conditions = [
      eq(projects.tenantId, tenantId),
      isNull(projects.archivedAt),
      sql`lower(btrim(${projects.title})) <> 'general'`,
    ];

    if (search) {
      const pattern = searchPattern(search);
      conditions.push(
        or(
          ilike(projects.title, pattern),
          ilike(projects.description, pattern),
          ilike(projects.researchArea, pattern),
        )!,
      );
    }

    const whereCondition = and(...conditions);

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

  async archive(tenantId: string, projectId: string) {
    const [project] = await this.drizzle.db
      .update(projects)
      .set({
        archivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(projects.tenantId, tenantId), eq(projects.id, projectId)))
      .returning();
    return project;
  }

  async restore(tenantId: string, projectId: string, statusId: string | null) {
    const [project] = await this.drizzle.db
      .update(projects)
      .set({
        statusId,
        archivedAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(projects.tenantId, tenantId),
          eq(projects.id, projectId),
          isNotNull(projects.archivedAt),
        ),
      )
      .returning();
    return project;
  }

  async permanentlyDelete(tenantId: string, projectId: string) {
    const [project] = await this.drizzle.db
      .delete(projects)
      .where(
        and(
          eq(projects.tenantId, tenantId),
          eq(projects.id, projectId),
          isNotNull(projects.archivedAt),
        ),
      )
      .returning();
    return project;
  }

  async archiveImpact(tenantId: string, projectId: string) {
    const [paperCount, taskCount, noteCount] = await Promise.all([
      this.drizzle.db
        .select({ count: sql<number>`count(*)::int` })
        .from(modules)
        .where(
          and(eq(modules.tenantId, tenantId), eq(modules.projectId, projectId)),
        ),
      this.drizzle.db
        .select({ count: sql<number>`count(*)::int` })
        .from(tasks)
        .where(
          and(eq(tasks.tenantId, tenantId), eq(tasks.projectId, projectId)),
        ),
      this.drizzle.db
        .select({ count: sql<number>`count(*)::int` })
        .from(notes)
        .where(
          and(eq(notes.tenantId, tenantId), eq(notes.projectId, projectId)),
        ),
    ]);

    return {
      papers: paperCount[0]?.count ?? 0,
      tasks: taskCount[0]?.count ?? 0,
      notes: noteCount[0]?.count ?? 0,
    };
  }

  async moveContents(
    tenantId: string,
    sourceProjectId: string,
    destinationProjectId: string,
  ) {
    const now = new Date();
    await this.drizzle.db
      .update(modules)
      .set({ projectId: destinationProjectId, updatedAt: now })
      .where(
        and(
          eq(modules.tenantId, tenantId),
          eq(modules.projectId, sourceProjectId),
        ),
      );
    await this.drizzle.db
      .update(tasks)
      .set({ projectId: destinationProjectId, updatedAt: now })
      .where(
        and(eq(tasks.tenantId, tenantId), eq(tasks.projectId, sourceProjectId)),
      );
    await this.drizzle.db
      .update(notes)
      .set({ projectId: destinationProjectId, updatedAt: now })
      .where(
        and(eq(notes.tenantId, tenantId), eq(notes.projectId, sourceProjectId)),
      );
  }
}
