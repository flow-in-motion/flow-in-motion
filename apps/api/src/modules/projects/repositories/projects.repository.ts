import { Injectable } from '@nestjs/common';
import {
  enumTable,
  moduleCollaborators,
  modules,
  notes,
  projectCollaborators,
  projects,
  tasks,
} from '@research-tracker/migrations';
import { and, desc, eq, getTableColumns, isNotNull, isNull, sql } from 'drizzle-orm';
import { DrizzleService } from '../../../db/drizzle.service';

const projectWithCounts = {
  ...getTableColumns(projects),
  paperCount: sql<number>`(
    select count(*)::int
    from ${modules}
    where ${modules.projectId} = ${projects.id}
      and ${modules.archivedAt} is null
  )`,
  noteCount: sql<number>`(
    select count(*)::int
    from ${notes}
    where ${notes.projectId} = ${projects.id}
      and ${notes.moduleId} is null
  )`,
};

@Injectable()
export class ProjectsRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async findById(tenantId: string, projectId: string) {
    const [project] = await this.drizzle.db
      .select(projectWithCounts)
      .from(projects)
      .where(and(eq(projects.tenantId, tenantId), eq(projects.id, projectId)));
    return project;
  }

  /** Tenant-agnostic single-project fetch, used to resolve a project's own tenant. */
  async findByIdGlobal(projectId: string) {
    const [project] = await this.drizzle.db
      .select(projectWithCounts)
      .from(projects)
      .where(eq(projects.id, projectId));
    return project;
  }
  async findGeneralByTenant(tenantId: string) {
    const [project] = await this.drizzle.db
      .select(projectWithCounts)
      .from(projects)
      .where(
        and(
          eq(projects.tenantId, tenantId),
          isNull(projects.archivedAt),
          eq(projects.isGeneral, true),
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
          project: projectWithCounts,
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
    );

    const [data, countResult] = await Promise.all([
      this.drizzle.db
        .select(projectWithCounts)
        .from(projects)
        .where(whereCondition)
        .orderBy(desc(projects.isGeneral), desc(projects.createdAt), desc(projects.id))
        .limit(limit)
        .offset(offset),

      this.drizzle.db
        .select({
          count: sql<number>`count(*)::int`,
          active: sql<number>`count(*) filter (where ${projects.statusId} in (select ${enumTable.id} from ${enumTable} where ${enumTable.category} = 'project_status' and ${enumTable.value} = 'Active'))::int`,
        })
        .from(projects)
        .where(whereCondition),
    ]);

    return {
      data,
      totalItems: countResult[0]?.count ?? 0,
      summary: { active: countResult[0]?.active ?? 0 },
    };
  }

  async findArchivedByTenant(tenantId: string, ownerUserId: string) {
    return this.drizzle.db
      .select(projectWithCounts)
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
      isGeneral?: boolean;
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

  async restore(tenantId: string, projectId: string) {
    const [project] = await this.drizzle.db
      .update(projects)
      .set({ archivedAt: null, updatedAt: new Date() })
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
    const result = await this.drizzle.db.execute(sql`
      select
        (select count(*)::int from ${modules}
          where ${modules.tenantId} = ${tenantId}
            and ${modules.projectId} = ${projectId}
            and ${modules.archivedAt} is null) as papers,
        (select count(*)::int from ${tasks}
          where ${tasks.tenantId} = ${tenantId}
            and (
              ${tasks.projectId} = ${projectId}
              or ${tasks.moduleId} in (
                select ${modules.id} from ${modules}
                where ${modules.tenantId} = ${tenantId}
                  and ${modules.projectId} = ${projectId}
              )
            )) as tasks,
        (select count(*)::int from ${notes}
          where ${notes.tenantId} = ${tenantId}
            and (
              ${notes.projectId} = ${projectId}
              or ${notes.moduleId} in (
                select ${modules.id} from ${modules}
                where ${modules.tenantId} = ${tenantId}
                  and ${modules.projectId} = ${projectId}
              )
            )) as notes
    `);
    const row = result.rows[0] as
      | { papers?: number | string; tasks?: number | string; notes?: number | string }
      | undefined;
    return {
      papers: Number(row?.papers ?? 0),
      tasks: Number(row?.tasks ?? 0),
      notes: Number(row?.notes ?? 0),
    };
  }

  /** Runs inside the request transaction established by RequestContextInterceptor. */
  async moveContentsToProject(
    tenantId: string,
    sourceProjectId: string,
    destinationProjectId: string,
  ) {
    await this.drizzle.db
      .update(moduleCollaborators)
      .set({ projectId: destinationProjectId, updatedAt: new Date() })
      .where(
        and(
          eq(moduleCollaborators.tenantId, tenantId),
          eq(moduleCollaborators.projectId, sourceProjectId),
        ),
      );

    await this.drizzle.db
      .update(modules)
      .set({ projectId: destinationProjectId, updatedAt: new Date() })
      .where(
        and(
          eq(modules.tenantId, tenantId),
          eq(modules.projectId, sourceProjectId),
        ),
      );

    await this.drizzle.db
      .update(tasks)
      .set({ projectId: destinationProjectId, updatedAt: new Date() })
      .where(
        and(
          eq(tasks.tenantId, tenantId),
          eq(tasks.projectId, sourceProjectId),
        ),
      );

    await this.drizzle.db
      .update(notes)
      .set({ projectId: destinationProjectId, updatedAt: new Date() })
      .where(
        and(
          eq(notes.tenantId, tenantId),
          eq(notes.projectId, sourceProjectId),
        ),
      );
  }
}
