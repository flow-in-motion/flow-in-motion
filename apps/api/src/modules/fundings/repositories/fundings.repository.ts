import { Injectable } from '@nestjs/common';
import {
  fundingModules,
  fundingProjects,
  fundings,
  moduleCollaborators,
  modules,
  projectCollaborators,
  projects,
} from '@research-tracker/migrations';
import {
  and,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from 'drizzle-orm';
import { searchPattern } from '../../../common/pagination';
import { DrizzleService } from '../../../db/drizzle.service';

interface CreateFundingValues {
  tenantId: string;
  ownerUserId: string;
  fundingBody: string;
  scheme: string | null;
  partners: string | null;
  amount: string | null;
  currency: string | null;
  applicationDeadline: string | null;
  status: string | null;
  notes: string | null;
}

type UpdateFundingValues = Partial<
  Omit<CreateFundingValues, 'tenantId' | 'ownerUserId'>
>;

@Injectable()
export class FundingsRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async findVisiblePageByUser(
    tenantId: string,
    userId: string,
    offset: number,
    limit: number,
    search?: string,
  ) {
    const visibility = or(
      eq(fundings.ownerUserId, userId),
      sql<boolean>`can_access_funding(${fundings.id}, ${userId}::uuid)`,
    );
    const pattern = search ? searchPattern(search) : undefined;
    const searchFilter = pattern
      ? or(
          ilike(fundings.fundingBody, pattern),
          ilike(fundings.scheme, pattern),
          ilike(fundings.partners, pattern),
          ilike(fundings.status, pattern),
          exists(
            this.drizzle.db
              .select({ id: fundingProjects.id })
              .from(fundingProjects)
              .innerJoin(projects, eq(projects.id, fundingProjects.projectId))
              .where(
                and(
                  eq(fundingProjects.fundingId, fundings.id),
                  ilike(projects.title, pattern),
                ),
              ),
          ),
          exists(
            this.drizzle.db
              .select({ id: fundingModules.id })
              .from(fundingModules)
              .innerJoin(modules, eq(modules.id, fundingModules.moduleId))
              .where(
                and(
                  eq(fundingModules.fundingId, fundings.id),
                  or(
                    ilike(modules.shortTitle, pattern),
                    ilike(modules.title, pattern),
                  ),
                ),
              ),
          ),
        )
      : undefined;
    const where = and(
      eq(fundings.tenantId, tenantId),
      visibility,
      searchFilter,
    );

    const [data, countResult] = await Promise.all([
      this.drizzle.db
        .select()
        .from(fundings)
        .where(where)
        .orderBy(
          sql`${fundings.applicationDeadline} ASC NULLS LAST`,
          desc(fundings.createdAt),
        )
        .limit(limit)
        .offset(offset),
      this.drizzle.db
        .select({ count: sql<number>`count(*)::int` })
        .from(fundings)
        .where(where),
    ]);

    return { data, totalItems: countResult[0]?.count ?? 0 };
  }

  async findVisibleById(tenantId: string, fundingId: string, userId: string) {
    const [funding] = await this.drizzle.db
      .select()
      .from(fundings)
      .where(
        and(
          eq(fundings.tenantId, tenantId),
          eq(fundings.id, fundingId),
          or(
            eq(fundings.ownerUserId, userId),
            sql<boolean>`can_access_funding(${fundings.id}, ${userId}::uuid)`,
          ),
        ),
      );
    return funding;
  }

  async findAccessibleProjectsByIds(
    tenantId: string,
    projectIds: string[],
    userId: string,
  ) {
    if (projectIds.length === 0) return [];
    return this.drizzle.db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.tenantId, tenantId),
          inArray(projects.id, projectIds),
          isNull(projects.archivedAt),
          or(
            eq(projects.userId, userId),
            exists(
              this.drizzle.db
                .select({ id: projectCollaborators.id })
                .from(projectCollaborators)
                .where(
                  and(
                    eq(projectCollaborators.projectId, projects.id),
                    eq(projectCollaborators.userId, userId),
                  ),
                ),
            ),
          ),
        ),
      );
  }

  async findAccessibleModulesByIds(
    tenantId: string,
    moduleIds: string[],
    userId: string,
  ) {
    if (moduleIds.length === 0) return [];
    return this.drizzle.db
      .select({ id: modules.id })
      .from(modules)
      .leftJoin(projects, eq(projects.id, modules.projectId))
      .where(
        and(
          eq(modules.tenantId, tenantId),
          inArray(modules.id, moduleIds),
          isNull(modules.archivedAt),
          or(isNull(projects.id), isNull(projects.archivedAt)),
          or(
            exists(
              this.drizzle.db
                .select({ id: moduleCollaborators.id })
                .from(moduleCollaborators)
                .where(
                  and(
                    eq(moduleCollaborators.moduleId, modules.id),
                    eq(moduleCollaborators.userId, userId),
                  ),
                ),
            ),
            eq(projects.userId, userId),
            exists(
              this.drizzle.db
                .select({ id: projectCollaborators.id })
                .from(projectCollaborators)
                .where(
                  and(
                    eq(projectCollaborators.projectId, projects.id),
                    eq(projectCollaborators.userId, userId),
                  ),
                ),
            ),
          ),
        ),
      );
  }

  async findLinkedProjects(tenantId: string, fundingId: string) {
    return this.drizzle.db
      .select({
        id: projects.id,
        displayId: projects.displayId,
        title: projects.title,
      })
      .from(fundingProjects)
      .innerJoin(projects, eq(projects.id, fundingProjects.projectId))
      .where(
        and(
          eq(fundingProjects.tenantId, tenantId),
          eq(fundingProjects.fundingId, fundingId),
          isNull(projects.archivedAt),
        ),
      );
  }

  async findLinkedModules(tenantId: string, fundingId: string) {
    return this.drizzle.db
      .select({
        id: modules.id,
        displayId: modules.displayId,
        shortTitle: modules.shortTitle,
        title: modules.title,
        projectId: modules.projectId,
      })
      .from(fundingModules)
      .innerJoin(modules, eq(modules.id, fundingModules.moduleId))
      .leftJoin(projects, eq(projects.id, modules.projectId))
      .where(
        and(
          eq(fundingModules.tenantId, tenantId),
          eq(fundingModules.fundingId, fundingId),
          isNull(modules.archivedAt),
          or(isNull(projects.id), isNull(projects.archivedAt)),
        ),
      );
  }

  async findLinksForFundings(tenantId: string, fundingIds: string[]) {
    const projectsByFunding = new Map<
      string,
      { id: string; displayId: string | null; title: string }[]
    >();
    const modulesByFunding = new Map<
      string,
      {
        id: string;
        displayId: string | null;
        shortTitle: string | null;
        title: string | null;
        projectId: string | null;
      }[]
    >();
    if (fundingIds.length === 0) return { projectsByFunding, modulesByFunding };

    const [projectRows, moduleRows] = await Promise.all([
      this.drizzle.db
        .select({
          fundingId: fundingProjects.fundingId,
          id: projects.id,
          displayId: projects.displayId,
          title: projects.title,
        })
        .from(fundingProjects)
        .innerJoin(projects, eq(projects.id, fundingProjects.projectId))
        .where(
          and(
            eq(fundingProjects.tenantId, tenantId),
            inArray(fundingProjects.fundingId, fundingIds),
            isNull(projects.archivedAt),
          ),
        ),
      this.drizzle.db
        .select({
          fundingId: fundingModules.fundingId,
          id: modules.id,
          displayId: modules.displayId,
          shortTitle: modules.shortTitle,
          title: modules.title,
          projectId: modules.projectId,
        })
        .from(fundingModules)
        .innerJoin(modules, eq(modules.id, fundingModules.moduleId))
        .leftJoin(projects, eq(projects.id, modules.projectId))
        .where(
          and(
            eq(fundingModules.tenantId, tenantId),
            inArray(fundingModules.fundingId, fundingIds),
            isNull(modules.archivedAt),
            or(isNull(projects.id), isNull(projects.archivedAt)),
          ),
        ),
    ]);

    for (const { fundingId, ...project } of projectRows) {
      projectsByFunding.set(fundingId, [
        ...(projectsByFunding.get(fundingId) ?? []),
        project,
      ]);
    }
    for (const { fundingId, ...module } of moduleRows) {
      modulesByFunding.set(fundingId, [
        ...(modulesByFunding.get(fundingId) ?? []),
        module,
      ]);
    }
    return { projectsByFunding, modulesByFunding };
  }

  async create(
    values: CreateFundingValues,
    projectIds: string[],
    moduleIds: string[],
  ) {
    const [funding] = await this.drizzle.db
      .insert(fundings)
      .values(values)
      .returning();
    if (!funding) return undefined;
    await this.replaceLinks(values.tenantId, funding.id, projectIds, moduleIds);
    return funding;
  }

  async update(
    tenantId: string,
    fundingId: string,
    values: UpdateFundingValues,
    projectIds?: string[],
    moduleIds?: string[],
  ) {
    const [funding] = await this.drizzle.db
      .update(fundings)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(fundings.tenantId, tenantId), eq(fundings.id, fundingId)))
      .returning();
    if (!funding) return undefined;

    if (projectIds !== undefined) {
      await this.drizzle.db
        .delete(fundingProjects)
        .where(
          and(
            eq(fundingProjects.tenantId, tenantId),
            eq(fundingProjects.fundingId, fundingId),
          ),
        );
      if (projectIds.length > 0) {
        await this.drizzle.db
          .insert(fundingProjects)
          .values(
            projectIds.map((projectId) => ({ tenantId, fundingId, projectId })),
          );
      }
    }
    if (moduleIds !== undefined) {
      await this.drizzle.db
        .delete(fundingModules)
        .where(
          and(
            eq(fundingModules.tenantId, tenantId),
            eq(fundingModules.fundingId, fundingId),
          ),
        );
      if (moduleIds.length > 0) {
        await this.drizzle.db
          .insert(fundingModules)
          .values(
            moduleIds.map((moduleId) => ({ tenantId, fundingId, moduleId })),
          );
      }
    }
    return funding;
  }

  async remove(tenantId: string, fundingId: string) {
    const [funding] = await this.drizzle.db
      .delete(fundings)
      .where(and(eq(fundings.tenantId, tenantId), eq(fundings.id, fundingId)))
      .returning();
    return funding;
  }

  private async replaceLinks(
    tenantId: string,
    fundingId: string,
    projectIds: string[],
    moduleIds: string[],
  ) {
    if (projectIds.length > 0) {
      await this.drizzle.db
        .insert(fundingProjects)
        .values(
          projectIds.map((projectId) => ({ tenantId, fundingId, projectId })),
        );
    }
    if (moduleIds.length > 0) {
      await this.drizzle.db
        .insert(fundingModules)
        .values(
          moduleIds.map((moduleId) => ({ tenantId, fundingId, moduleId })),
        );
    }
  }
}
