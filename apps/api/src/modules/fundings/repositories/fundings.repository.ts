import { Injectable } from '@nestjs/common';
import {
  fundingModules,
  fundingNotes,
  fundingProjects,
  fundingTasks,
  fundings,
  moduleCollaborators,
  modules,
  projectCollaborators,
  projects,
  noteMembers,
  notes,
  taskMembers,
  tasks,
} from '@research-tracker/migrations';
import {
  asc,
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
import type {
  FundingSortDirection,
  FundingSortField,
} from '../dto/list-fundings-query.dto';

interface CreateFundingValues {
  tenantId: string;
  ownerUserId: string;
  fundingBody: string;
  scheme: string | null;
  partners: string | null;
  amount: string | null;
  currency: string | null;
  applicationDeadline: string | null;
  followUpDate: string | null;
  status: string | null;
  notes: string | null;
}

type UpdateFundingValues = Partial<
  Omit<CreateFundingValues, 'tenantId' | 'ownerUserId'>
>;

@Injectable()
export class FundingsRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  private activeNoteParentCondition() {
    return and(
      or(
        isNull(notes.projectId),
        exists(
          this.drizzle.db
            .select({ id: projects.id })
            .from(projects)
            .where(
              and(
                eq(projects.id, notes.projectId),
                isNull(projects.archivedAt),
              ),
            ),
        ),
      ),
      or(
        isNull(notes.moduleId),
        exists(
          this.drizzle.db
            .select({ id: modules.id })
            .from(modules)
            .where(
              and(
                eq(modules.id, notes.moduleId),
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
            ),
        ),
      ),
    );
  }

  private activeTaskParentCondition() {
    return and(
      or(
        isNull(tasks.projectId),
        exists(
          this.drizzle.db
            .select({ id: projects.id })
            .from(projects)
            .where(
              and(
                eq(projects.id, tasks.projectId),
                isNull(projects.archivedAt),
              ),
            ),
        ),
      ),
      or(
        isNull(tasks.moduleId),
        exists(
          this.drizzle.db
            .select({ id: modules.id })
            .from(modules)
            .where(
              and(
                eq(modules.id, tasks.moduleId),
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
            ),
        ),
      ),
    );
  }

  async findVisiblePageByUser(
    tenantId: string,
    userId: string,
    offset: number,
    limit: number,
    search?: string,
    sortBy?: FundingSortField,
    sortDirection: FundingSortDirection = 'asc',
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
          ilike(fundings.notes, pattern),
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
    const direction = sortDirection === 'asc' ? asc : desc;
    const linksCount = sql<number>`(
      (select count(*)
       from ${fundingProjects}
       inner join ${projects} on ${projects.id} = ${fundingProjects.projectId}
       where ${fundingProjects.fundingId} = ${fundings.id}
         and ${projects.archivedAt} is null)
      +
      (select count(*)
       from ${fundingModules}
       inner join ${modules} on ${modules.id} = ${fundingModules.moduleId}
       left join ${projects} linked_project on linked_project.id = ${modules.projectId}
       where ${fundingModules.fundingId} = ${fundings.id}
         and ${modules.archivedAt} is null
         and (linked_project.id is null or linked_project.archived_at is null))
    )`;
    const sortExpression = sortBy
      ? {
          fundingBody: sql`lower(${fundings.fundingBody})`,
          scheme: sql`lower(${fundings.scheme})`,
          partners: sql`lower(${fundings.partners})`,
          amount: fundings.amount,
          applicationDeadline: fundings.applicationDeadline,
          followUpDate: fundings.followUpDate,
          status: sql`lower(${fundings.status})`,
          links: linksCount,
        }[sortBy]
      : undefined;
    const sortedExpression = sortExpression
      ? sortDirection === 'asc'
        ? sql`${sortExpression} ASC NULLS LAST`
        : sql`${sortExpression} DESC NULLS LAST`
      : undefined;
    const orderBy = sortedExpression
      ? [
          sortedExpression,
          direction(fundings.createdAt),
          direction(fundings.id),
        ]
      : [
          sql`${fundings.applicationDeadline} ASC NULLS LAST`,
          desc(fundings.createdAt),
          desc(fundings.id),
        ];

    const [data, countResult] = await Promise.all([
      this.drizzle.db
        .select()
        .from(fundings)
        .where(where)
        .orderBy(...orderBy)
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

  async findLinkedNotes(tenantId: string, fundingId: string, userId: string) {
    return this.drizzle.db
      .select({
        id: notes.id,
        displayId: notes.displayId,
        title: notes.title,
        content: notes.content,
        followUpDate: notes.followUpDate,
        createdAt: notes.createdAt,
      })
      .from(fundingNotes)
      .innerJoin(notes, eq(notes.id, fundingNotes.noteId))
      .where(
        and(
          eq(fundingNotes.tenantId, tenantId),
          eq(fundingNotes.fundingId, fundingId),
          eq(notes.tenantId, tenantId),
          this.activeNoteParentCondition(),
          or(
            eq(notes.createdBy, userId),
            exists(
              this.drizzle.db
                .select({ id: noteMembers.id })
                .from(noteMembers)
                .where(
                  and(
                    eq(noteMembers.tenantId, tenantId),
                    eq(noteMembers.noteId, notes.id),
                    eq(noteMembers.userId, userId),
                  ),
                ),
            ),
          ),
        ),
      )
      .orderBy(desc(notes.updatedAt), desc(notes.id));
  }

  async findLinkedTasks(tenantId: string, fundingId: string, userId: string) {
    return this.drizzle.db
      .select({
        id: tasks.id,
        displayId: tasks.displayId,
        title: tasks.title,
        description: tasks.description,
        dueDate: tasks.dueDate,
        createdAt: tasks.createdAt,
      })
      .from(fundingTasks)
      .innerJoin(tasks, eq(tasks.id, fundingTasks.taskId))
      .where(
        and(
          eq(fundingTasks.tenantId, tenantId),
          eq(fundingTasks.fundingId, fundingId),
          eq(tasks.tenantId, tenantId),
          this.activeTaskParentCondition(),
          or(
            eq(tasks.createdBy, userId),
            exists(
              this.drizzle.db
                .select({ id: taskMembers.id })
                .from(taskMembers)
                .where(
                  and(
                    eq(taskMembers.tenantId, tenantId),
                    eq(taskMembers.taskId, tasks.id),
                    eq(taskMembers.userId, userId),
                  ),
                ),
            ),
          ),
        ),
      )
      .orderBy(desc(tasks.updatedAt), desc(tasks.id));
  }

  async findAccessibleNoteById(
    tenantId: string,
    noteId: string,
    userId: string,
  ) {
    const [note] = await this.drizzle.db
      .select({ id: notes.id })
      .from(notes)
      .where(
        and(
          eq(notes.tenantId, tenantId),
          eq(notes.id, noteId),
          this.activeNoteParentCondition(),
          or(
            eq(notes.createdBy, userId),
            exists(
              this.drizzle.db
                .select({ id: noteMembers.id })
                .from(noteMembers)
                .where(
                  and(
                    eq(noteMembers.tenantId, tenantId),
                    eq(noteMembers.noteId, notes.id),
                    eq(noteMembers.userId, userId),
                  ),
                ),
            ),
          ),
        ),
      );
    return note;
  }

  async findAccessibleTaskById(
    tenantId: string,
    taskId: string,
    userId: string,
  ) {
    const [task] = await this.drizzle.db
      .select({ id: tasks.id })
      .from(tasks)
      .where(
        and(
          eq(tasks.tenantId, tenantId),
          eq(tasks.id, taskId),
          this.activeTaskParentCondition(),
          or(
            eq(tasks.createdBy, userId),
            exists(
              this.drizzle.db
                .select({ id: taskMembers.id })
                .from(taskMembers)
                .where(
                  and(
                    eq(taskMembers.tenantId, tenantId),
                    eq(taskMembers.taskId, tasks.id),
                    eq(taskMembers.userId, userId),
                  ),
                ),
            ),
          ),
        ),
      );
    return task;
  }

  async attachNote(tenantId: string, fundingId: string, noteId: string) {
    await this.drizzle.db
      .insert(fundingNotes)
      .values({ tenantId, fundingId, noteId })
      .onConflictDoNothing();
  }

  async detachNote(tenantId: string, fundingId: string, noteId: string) {
    await this.drizzle.db
      .delete(fundingNotes)
      .where(
        and(
          eq(fundingNotes.tenantId, tenantId),
          eq(fundingNotes.fundingId, fundingId),
          eq(fundingNotes.noteId, noteId),
        ),
      );
  }

  async attachTask(tenantId: string, fundingId: string, taskId: string) {
    await this.drizzle.db
      .insert(fundingTasks)
      .values({ tenantId, fundingId, taskId })
      .onConflictDoNothing();
  }

  async detachTask(tenantId: string, fundingId: string, taskId: string) {
    await this.drizzle.db
      .delete(fundingTasks)
      .where(
        and(
          eq(fundingTasks.tenantId, tenantId),
          eq(fundingTasks.fundingId, fundingId),
          eq(fundingTasks.taskId, taskId),
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
