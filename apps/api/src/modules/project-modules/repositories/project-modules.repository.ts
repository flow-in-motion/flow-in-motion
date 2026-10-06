import { searchPattern } from '../../../common/pagination';
import { Injectable } from '@nestjs/common';
import {
  enumTable,
  moduleCollaborators,
  modules,
  projectCollaborators,
  projects,
} from '@research-tracker/migrations';
import {
  and,
  asc,
  desc,
  eq,
  exists,
  ilike,
  isNotNull,
  isNull,
  or,
  sql,
} from 'drizzle-orm';
import { DrizzleService } from '../../../db/drizzle.service';
import type {
  ModuleSortField,
  SortDirection,
} from '../dto/list-modules-query.dto';

@Injectable()
export class ProjectModulesRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async findById(tenantId: string, moduleId: string) {
    const [module] = await this.drizzle.db
      .select()
      .from(modules)
      .where(
        and(
          eq(modules.tenantId, tenantId),
          eq(modules.id, moduleId),
          isNull(modules.archivedAt),
          or(
            isNull(modules.projectId),
            exists(
              this.drizzle.db
                .select({ id: projects.id })
                .from(projects)
                .where(
                  and(
                    eq(projects.id, modules.projectId),
                    isNull(projects.archivedAt),
                  ),
                ),
            ),
          ),
        ),
      );
    return module;
  }

  async findByIdGlobal(moduleId: string) {
    const [module] = await this.drizzle.db
      .select()
      .from(modules)
      .where(
        and(
          eq(modules.id, moduleId),
          isNull(modules.archivedAt),
          or(
            isNull(modules.projectId),
            exists(
              this.drizzle.db
                .select({ id: projects.id })
                .from(projects)
                .where(
                  and(
                    eq(projects.id, modules.projectId),
                    isNull(projects.archivedAt),
                  ),
                ),
            ),
          ),
        ),
      );
    return module;
  }

  async findArchivedById(tenantId: string, moduleId: string) {
    const [module] = await this.drizzle.db
      .select()
      .from(modules)
      .where(
        and(
          eq(modules.tenantId, tenantId),
          eq(modules.id, moduleId),
          isNotNull(modules.archivedAt),
        ),
      );
    return module;
  }

  async findArchivedByTenant(tenantId: string, callerUserId: string) {
    return this.drizzle.db
      .select()
      .from(modules)
      .where(
        and(
          eq(modules.tenantId, tenantId),
          isNotNull(modules.archivedAt),
          or(
            isNull(modules.projectId),
            exists(
              this.drizzle.db
                .select({ id: projects.id })
                .from(projects)
                .where(
                  and(
                    eq(projects.id, modules.projectId),
                    isNull(projects.archivedAt),
                  ),
                ),
            ),
          ),
          exists(
            this.drizzle.db
              .select({ id: moduleCollaborators.id })
              .from(moduleCollaborators)
              .innerJoin(
                enumTable,
                eq(enumTable.id, moduleCollaborators.roleId),
              )
              .where(
                and(
                  eq(moduleCollaborators.tenantId, tenantId),
                  eq(moduleCollaborators.moduleId, modules.id),
                  eq(moduleCollaborators.userId, callerUserId),
                  eq(enumTable.category, 'project_role'),
                  eq(enumTable.value, 'Owner'),
                ),
              ),
          ),
        ),
      )
      .orderBy(desc(modules.archivedAt), desc(modules.id));
  }

  async findVisibleActiveByTenant(
    tenantId: string,
    callerUserId: string,
    offset: number,
    limit: number,
    projectId?: string,
    search?: string,
    sortBy: ModuleSortField = 'dateAdded',
    sortDirection: SortDirection = 'desc',
  ) {
    const visibilityCondition = or(
      exists(
        this.drizzle.db
          .select({ id: projectCollaborators.id })
          .from(projectCollaborators)
          .where(
            and(
              eq(projectCollaborators.tenantId, tenantId),
              eq(projectCollaborators.projectId, modules.projectId),
              eq(projectCollaborators.userId, callerUserId),
            ),
          ),
      ),
      and(
        isNull(modules.projectId),
        exists(
          this.drizzle.db
            .select({ id: moduleCollaborators.id })
            .from(moduleCollaborators)
            .where(
              and(
                eq(moduleCollaborators.tenantId, tenantId),
                eq(moduleCollaborators.moduleId, modules.id),
                eq(moduleCollaborators.userId, callerUserId),
              ),
            ),
        ),
      ),
    );

    const conditions = [
      eq(modules.tenantId, tenantId),
      isNull(modules.archivedAt),
      or(
        isNull(modules.projectId),
        exists(
          this.drizzle.db
            .select({ id: projects.id })
            .from(projects)
            .where(
              and(
                eq(projects.id, modules.projectId),
                isNull(projects.archivedAt),
              ),
            ),
        ),
      ),
      visibilityCondition,
    ];

    if (projectId) {
      conditions.push(eq(modules.projectId, projectId));
    }
    if (search) {
      const pattern = searchPattern(search);
      conditions.push(
        or(
          ilike(modules.shortTitle, pattern),
          ilike(modules.title, pattern),
          ilike(modules.description, pattern),
          ilike(modules.abstract, pattern),
          exists(
            this.drizzle.db
              .select({ id: projects.id })
              .from(projects)
              .where(
                and(
                  eq(projects.id, modules.projectId),
                  ilike(projects.title, pattern),
                ),
              ),
          ),
        ),
      );
    }

    const whereCondition = and(...conditions);
    const direction = sortDirection === 'asc' ? asc : desc;
    const paperTitle = sql<string>`lower(coalesce(nullif(btrim(${modules.shortTitle}), ''), nullif(btrim(${modules.title}), ''), 'Untitled paper'))`;
    // A paper can still reference a global stage after the workspace customises
    // its stage order. Resolve by stage value and prefer the tenant's effective
    // row so this order matches the progress percentage shown in the UI.
    const progressOrder = sql<number>`coalesce((
      select case when effective.hidden then -1 else effective.sort_order end
      from "enum" effective
      where effective.category = 'module_pipeline_stage'
        and effective.value = (
          select assigned.value from "enum" assigned
          where assigned.id = ${modules.pipelineStageId}
        )
        and (effective.tenant_id = ${tenantId} or effective.tenant_id is null)
      order by (effective.tenant_id = ${tenantId}) desc
      limit 1
    ), -1)`;
    const orderBy =
      sortBy === 'alphabetical'
        ? [
            direction(paperTitle),
            direction(modules.createdAt),
            direction(modules.id),
          ]
        : sortBy === 'progress'
          ? [
              direction(progressOrder),
              direction(modules.createdAt),
              direction(modules.id),
            ]
          : [direction(modules.createdAt), direction(modules.id)];

    const [data, countResult] = await Promise.all([
      this.drizzle.db
        .select()
        .from(modules)
        .where(whereCondition)
        .orderBy(...orderBy)
        .limit(limit)
        .offset(offset),

      this.drizzle.db
        .select({
          count: sql<number>`count(*)::int`,
          active: sql<number>`count(*) filter (where ${modules.statusId} in (select ${enumTable.id} from ${enumTable} where ${enumTable.category} = 'project_status' and ${enumTable.value} = 'Active'))::int`,
          review: sql<number>`count(*) filter (where ${modules.pipelineStageId} in (select ${enumTable.id} from ${enumTable} where ${enumTable.category} = 'module_pipeline_stage' and ${enumTable.value} = 'Submitted, Under Review' and (${enumTable.tenantId} is null or ${enumTable.tenantId} = ${tenantId})))::int`,
        })
        .from(modules)
        .where(whereCondition),
    ]);

    return {
      data,
      totalItems: countResult[0]?.count ?? 0,
      summary: {
        active: countResult[0]?.active ?? 0,
        review: countResult[0]?.review ?? 0,
      },
    };
  }

  async findAccessiblePageByUser(
    callerUserId: string,
    offset: number,
    limit: number,
  ) {
    const visibilityCondition = or(
      exists(
        this.drizzle.db
          .select({ id: projectCollaborators.id })
          .from(projectCollaborators)
          .where(
            and(
              eq(projectCollaborators.tenantId, modules.tenantId),
              eq(projectCollaborators.projectId, modules.projectId),
              eq(projectCollaborators.userId, callerUserId),
            ),
          ),
      ),
      and(
        isNull(modules.projectId),
        exists(
          this.drizzle.db
            .select({ id: moduleCollaborators.id })
            .from(moduleCollaborators)
            .where(
              and(
                eq(moduleCollaborators.tenantId, modules.tenantId),
                eq(moduleCollaborators.moduleId, modules.id),
                eq(moduleCollaborators.userId, callerUserId),
              ),
            ),
        ),
      ),
    );

    const whereCondition = and(
      isNull(modules.archivedAt),
      or(
        isNull(modules.projectId),
        exists(
          this.drizzle.db
            .select({ id: projects.id })
            .from(projects)
            .where(
              and(
                eq(projects.id, modules.projectId),
                isNull(projects.archivedAt),
              ),
            ),
        ),
      ),
      visibilityCondition,
    );

    const [data, countResult] = await Promise.all([
      this.drizzle.db
        .select()
        .from(modules)
        .where(whereCondition)
        .orderBy(desc(modules.createdAt), desc(modules.id))
        .limit(limit)
        .offset(offset),

      this.drizzle.db
        .select({
          count: sql<number>`count(*)::int`,
        })
        .from(modules)
        .where(whereCondition),
    ]);

    return {
      data,
      totalItems: countResult[0]?.count ?? 0,
    };
  }

  async create(values: {
    projectId?: string;
    tenantId: string;
    shortTitle: string;
    title?: string;
    description?: string;
    abstract?: string;
    targetJournal?: string;
    backupJournal?: string;
    targetConference?: string;
    backupConference?: string;
    statusId?: string;
    pipelineStageId?: string;
    pipelineStageChangedAt?: Date;
    assignedToUserId?: string;
    dueDate?: string;
    displayId?: string;
  }) {
    const [module] = await this.drizzle.db
      .insert(modules)
      .values(values)
      .returning();
    return module;
  }

  /**
   * Pre-context access check for guards. Nest guards execute before the
   * request interceptor establishes app.current_user_id, so ordinary module
   * queries are intentionally hidden by RLS at this point.
   */
  async checkAccessForGuard(
    tenantId: string,
    moduleId: string,
    userId: string,
  ) {
    const result = await this.drizzle.db.execute(
      sql`SELECT check_module_access(${tenantId}::uuid, ${moduleId}::uuid, ${userId}::uuid) AS allowed`,
    );
    return result.rows[0]?.allowed === true;
  }

  async update(
    tenantId: string,
    moduleId: string,
    values: Partial<{
      shortTitle: string;
      title: string;
      description: string;
      abstract: string;
      targetJournal: string;
      backupJournal: string;
      targetConference: string;
      backupConference: string;
      projectId: string | null;
      statusId: string;
      pipelineStageId: string;
      pipelineStageChangedAt: Date;
      assignedToUserId: string;
      dueDate: string;
    }>,
  ) {
    const [module] = await this.drizzle.db
      .update(modules)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(modules.tenantId, tenantId), eq(modules.id, moduleId)))
      .returning();
    return module;
  }

  async archive(tenantId: string, moduleId: string) {
    const [module] = await this.drizzle.db
      .update(modules)
      .set({
        archivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(modules.tenantId, tenantId), eq(modules.id, moduleId)))
      .returning();
    return module;
  }

  async restore(tenantId: string, moduleId: string, statusId: string | null) {
    const [module] = await this.drizzle.db
      .update(modules)
      .set({ statusId, archivedAt: null, updatedAt: new Date() })
      .where(
        and(
          eq(modules.tenantId, tenantId),
          eq(modules.id, moduleId),
          isNotNull(modules.archivedAt),
        ),
      )
      .returning();
    return module;
  }

  async permanentlyDelete(tenantId: string, moduleId: string) {
    const [module] = await this.drizzle.db
      .delete(modules)
      .where(
        and(
          eq(modules.tenantId, tenantId),
          eq(modules.id, moduleId),
          isNotNull(modules.archivedAt),
        ),
      )
      .returning();
    return module;
  }
}
