import { searchPattern } from '../../../common/pagination';
import { Injectable } from '@nestjs/common';
import {
  enumTable,
  modules,
  projects,
  taskDescriptionEntries,
  taskMembers,
  tasks,
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
import { DrizzleService } from '../../../db/drizzle.service';
import { getRequestContext } from '../../../db/request-context';

@Injectable()
export class TasksRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  private async withinTransaction<T>(
    operation: (
      db: Pick<DrizzleService['db'], 'insert' | 'update'>,
    ) => Promise<T>,
  ): Promise<T> {
    const context = getRequestContext();

    if (context) {
      return operation(context.tx);
    }

    return this.drizzle.db.transaction((tx) => operation(tx));
  }

  private activeParentCondition() {
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

  async findById(tenantId: string, taskId: string) {
    const [task] = await this.drizzle.db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.tenantId, tenantId),
          eq(tasks.id, taskId),
          this.activeParentCondition(),
        ),
      );
    return task;
  }

  /** Tenant-agnostic lookup — used for "tasks shared with me" access, where the
   * caller may not be a member of the tenant that owns the task at all. */
  async findByIdGlobal(taskId: string) {
    const [task] = await this.drizzle.db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), this.activeParentCondition()));
    return task;
  }

  /** All tasks the given user created, across every tenant. */
  async findByCreator(userId: string) {
    return this.drizzle.db
      .select()
      .from(tasks)
      .where(and(eq(tasks.createdBy, userId), this.activeParentCondition()));
  }

  async findByIds(ids: string[]) {
    if (ids.length === 0) return [];
    return this.drizzle.db
      .select()
      .from(tasks)
      .where(and(inArray(tasks.id, ids), this.activeParentCondition()));
  }

  async findVisibleByTenant(
    tenantId: string,
    callerUserId: string,
    offset: number,
    limit: number,
    projectId?: string,
    search?: string,
    projectOnly = false,
    statuses?: string[],
    priorities?: string[],
  ) {
    const accessCondition = or(
      eq(tasks.createdBy, callerUserId),
      exists(
        this.drizzle.db
          .select({ id: taskMembers.id })
          .from(taskMembers)
          .where(
            and(
              eq(taskMembers.tenantId, tenantId),
              eq(taskMembers.taskId, tasks.id),
              eq(taskMembers.userId, callerUserId),
            ),
          ),
      ),
    );

    const conditions = [
      eq(tasks.tenantId, tenantId),
      accessCondition,
      this.activeParentCondition(),
    ];

    if (projectId) {
      conditions.push(eq(tasks.projectId, projectId));
    }
    if (projectOnly) conditions.push(isNull(tasks.moduleId));
    if (search) {
      const pattern = searchPattern(search);
      conditions.push(
        or(
          ilike(tasks.displayId, pattern),
          ilike(tasks.title, pattern),
          ilike(tasks.description, pattern),
          exists(
            this.drizzle.db
              .select({ id: projects.id })
              .from(projects)
              .where(
                and(
                  eq(projects.id, tasks.projectId),
                  ilike(projects.title, pattern),
                ),
              ),
          ),
          exists(
            this.drizzle.db
              .select({ id: modules.id })
              .from(modules)
              .where(
                and(
                  eq(modules.id, tasks.moduleId),
                  or(
                    ilike(modules.shortTitle, pattern),
                    ilike(modules.title, pattern),
                  ),
                ),
              ),
          ),
        ),
      );
    }

    if (statuses?.length) {
      conditions.push(
        inArray(
          tasks.statusId,
          this.drizzle.db
            .select({ id: enumTable.id })
            .from(enumTable)
            .where(
              and(
                eq(enumTable.category, 'task_status'),
                inArray(enumTable.value, statuses),
              ),
            ),
        ),
      );
    }

    if (priorities?.length) {
      conditions.push(
        inArray(
          tasks.priorityId,
          this.drizzle.db
            .select({ id: enumTable.id })
            .from(enumTable)
            .where(
              and(
                eq(enumTable.category, 'importance'),
                inArray(enumTable.value, priorities),
              ),
            ),
        ),
      );
    }
    const whereCondition = and(...conditions);

    const [data, countResult] = await Promise.all([
      this.drizzle.db
        .select()
        .from(tasks)
        .where(whereCondition)
        .orderBy(desc(tasks.createdAt), desc(tasks.id))
        .limit(limit)
        .offset(offset),

      this.drizzle.db
        .select({
          count: sql<number>`count(*)::int`,
          open: sql<number>`count(*) filter (where ${tasks.statusId} is null or ${tasks.statusId} not in (select ${enumTable.id} from ${enumTable} where ${enumTable.category} = 'task_status' and ${enumTable.value} = 'Complete'))::int`,
        })
        .from(tasks)
        .where(whereCondition),
    ]);

    return {
      data,
      totalItems: countResult[0]?.count ?? 0,
      summary: { open: countResult[0]?.open ?? 0 },
    };
  }

  async create(values: {
    tenantId: string;
    projectId?: string;
    moduleId?: string;
    createdBy: string;
    title: string;
    description?: string;
    statusId?: string;
    priorityId?: string;
    visibilityId?: string;
    workingWith?: string;
    estimatedHours?: string;
    dueDate?: string;
    displayId?: string;
  }) {
    return this.withinTransaction(async (tx) => {
      const [task] = await tx.insert(tasks).values(values).returning();

      if (!task) return undefined;

      if (task.description?.trim()) {
        await tx.insert(taskDescriptionEntries).values({
          taskId: task.id,
          content: task.description,
          createdAt: task.createdAt,
        });
      }

      return task;
    });
  }

  async update(
    tenantId: string,
    taskId: string,
    values: Partial<{
      title: string;
      description: string;
      statusId: string;
      priorityId: string;
      visibilityId: string;
      workingWith: string | null;
      estimatedHours: string;
      dueDate: string;
      projectId: string | null;
      moduleId: string | null;
    }>,
  ) {
    const [task] = await this.drizzle.db
      .update(tasks)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(tasks.tenantId, tenantId), eq(tasks.id, taskId)))
      .returning();
    return task;
  }

  async delete(tenantId: string, taskId: string) {
    const [task] = await this.drizzle.db
      .delete(tasks)
      .where(and(eq(tasks.tenantId, tenantId), eq(tasks.id, taskId)))
      .returning();
    return task;
  }

  async findDescriptionEntries(tenantId: string, taskId: string) {
    return this.drizzle.db
      .select({
        id: taskDescriptionEntries.id,
        taskId: taskDescriptionEntries.taskId,
        content: taskDescriptionEntries.content,
        createdAt: taskDescriptionEntries.createdAt,
      })
      .from(taskDescriptionEntries)
      .innerJoin(tasks, eq(tasks.id, taskDescriptionEntries.taskId))
      .where(
        and(
          eq(tasks.tenantId, tenantId),
          eq(tasks.id, taskId),
          this.activeParentCondition(),
        ),
      )
      .orderBy(
        desc(taskDescriptionEntries.createdAt),
        desc(taskDescriptionEntries.id),
      );
  }

  async appendDescriptionEntry(
    tenantId: string,
    taskId: string,
    content: string,
  ) {
    return this.withinTransaction(async (tx) => {
      // Lock the parent row while prepending content, preserving
      // concurrent additions.
      const [task] = await tx
        .update(tasks)
        .set({
          description: sql<string>`
            CASE
              WHEN ${tasks.description} IS NULL
                OR btrim(${tasks.description}) = ''
              THEN ${content}
              ELSE ${content} || E'\n\n' || ${tasks.description}
            END
          `,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(tasks.tenantId, tenantId),
            eq(tasks.id, taskId),
            this.activeParentCondition(),
          ),
        )
        .returning();

      if (!task) return undefined;

      await tx.insert(taskDescriptionEntries).values({
        taskId: task.id,
        content,
      });

      return task;
    });
  }
}
