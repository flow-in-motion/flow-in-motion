import { searchPattern } from '../../../common/pagination';
import { Injectable } from '@nestjs/common';
import { enumTable, modules, projects, taskMembers, tasks } from '@research-tracker/migrations';
import { and, desc, eq, exists, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { DrizzleService } from '../../../db/drizzle.service';

@Injectable()
export class TasksRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async findById(tenantId: string, taskId: string) {
    const [task] = await this.drizzle.db
      .select()
      .from(tasks)
      .where(and(eq(tasks.tenantId, tenantId), eq(tasks.id, taskId)));
    return task;
  }

  /** Tenant-agnostic lookup — used for "tasks shared with me" access, where the
   * caller may not be a member of the tenant that owns the task at all. */
  async findByIdGlobal(taskId: string) {
    const [task] = await this.drizzle.db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId));
    return task;
  }

  /** All tasks the given user created, across every tenant. */
  async findByCreator(userId: string) {
    return this.drizzle.db
      .select()
      .from(tasks)
      .where(eq(tasks.createdBy, userId));
  }

  async findByIds(ids: string[]) {
    if (ids.length === 0) return [];
    return this.drizzle.db.select().from(tasks).where(inArray(tasks.id, ids));
  }

  async findVisibleByTenant(
    tenantId: string,
    callerUserId: string,
    offset: number,
    limit: number,
    projectId?: string,
    search?: string,
    projectOnly = false,
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

    const conditions = [eq(tasks.tenantId, tenantId), accessCondition];

    if (projectId) {
      conditions.push(eq(tasks.projectId, projectId));
    }
    if (projectOnly) conditions.push(isNull(tasks.moduleId));
    if (search) {
      const pattern = searchPattern(search);
      conditions.push(or(
          ilike(tasks.displayId, pattern),
          ilike(tasks.title, pattern),
          ilike(tasks.description, pattern),
          ilike(tasks.workingWith, pattern),
          exists(
            this.drizzle.db
              .select({ id: projects.id })
              .from(projects)
              .where(and(eq(projects.id, tasks.projectId), ilike(projects.title, pattern))),
          ),
          exists(
            this.drizzle.db
              .select({ id: modules.id })
              .from(modules)
              .where(
                and(
                  eq(modules.id, tasks.moduleId),
                  or(ilike(modules.shortTitle, pattern), ilike(modules.title, pattern)),
                ),
              ),
          ),
        )!);
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
        .select({ count: sql<number>`count(*)::int`,
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
    const [task] = await this.drizzle.db
      .insert(tasks)
      .values(values)
      .returning();
    return task;
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
}
