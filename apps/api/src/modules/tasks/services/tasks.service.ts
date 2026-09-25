import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EnumRepository } from '../../enum/repositories/enum.repository';
import { ProjectModulesRepository } from '../../project-modules/repositories/project-modules.repository';
import { TaskMembersRepository } from '../../task-members/repositories/task-members.repository';
import { TenantSequencesRepository } from '../../tenant-sequences/repositories/tenant-sequences.repository';
import { TasksRepository } from '../repositories/tasks.repository';
import {
  assertAllFits,
  listPageSize,
  buildPaginationMeta,
  paginationOffset,
} from '../../../common/pagination';

@Injectable()
export class TasksService {
  constructor(
    private readonly repository: TasksRepository,
    private readonly enumRepository: EnumRepository,
    private readonly sequences: TenantSequencesRepository,
    private readonly taskMembers: TaskMembersRepository,
    private readonly modulesRepository: ProjectModulesRepository,
  ) {}

  /**
   * A task links to at most one of a project or a module, never both
   * independently supplied. When moduleId is given, the project is derived
   * from the module itself (which may be null, for an independent module)
   * rather than trusted from the caller — this is what makes it possible to
   * link a task to an independent module in the first place.
   */
  private async resolveLinkage(
    tenantId: string,
    input: { projectId?: string; moduleId?: string },
  ): Promise<{ projectId: string | null; moduleId: string | null }> {
    if (input.moduleId) {
      const module = await this.modulesRepository.findById(
        tenantId,
        input.moduleId,
      );
      if (!module) {
        throw new BadRequestException('Unknown moduleId');
      }
      return { projectId: module.projectId, moduleId: module.id };
    }
    return { projectId: input.projectId ?? null, moduleId: null };
  }

  /**
   * A task is visible only to its creator or a task_members row for the
   * caller. A Private task's members are always empty (creation/update
   * clears them), and a Shared task always has its creator auto-inserted as
   * a member, so this single check correctly covers both visibility states.
   */
  private async canAccess(
    tenantId: string,
    task: { id: string; createdBy: string },
    callerUserId: string,
  ): Promise<boolean> {
    if (task.createdBy === callerUserId) return true;
    const membership = await this.taskMembers.findByTaskAndUser(
      tenantId,
      task.id,
      callerUserId,
    );
    return Boolean(membership);
  }

  async list(
    tenantId: string,
    callerUserId: string,
    page: number,
    pageSize: number | 'all',
    projectId?: string,
    search?: string,
    projectOnly = false,
  ) {
    const limit = listPageSize(pageSize);
    const requestedPage = pageSize === 'all' ? 1 : page;
    const offset = paginationOffset(requestedPage, limit);

    const { data: rows, totalItems, summary } =
      await this.repository.findVisibleByTenant(
        tenantId,
        callerUserId,
        offset,
        limit,
        projectId,
        search,
        projectOnly,
      );

    assertAllFits(pageSize, totalItems);

    const shaped = await this.withDisplayValues(rows);

    return {
      data: shaped,
      summary,
      meta: buildPaginationMeta(requestedPage, limit, totalItems),
    };
  }

  async findOne(tenantId: string, taskId: string, callerUserId: string) {
    const task = await this.repository.findById(tenantId, taskId);
    if (!task || !(await this.canAccess(tenantId, task, callerUserId))) {
      throw new NotFoundException('Task not found');
    }
    const [shaped] = await this.withDisplayValues([task]);
    return shaped;
  }

  /**
   * Tenant-agnostic: every task the caller can see (creator or explicit
   * task_members row), regardless of which workspace it lives in. Task
   * visibility was never meant to depend on workspace membership — being a
   * project collaborator doesn't grant task access either — so a task
   * shared with someone outside the owning tenant must still be reachable.
   */
  async listForCaller(callerUserId: string) {
    const [ownTasks, memberTaskIds] = await Promise.all([
      this.repository.findByCreator(callerUserId),
      this.taskMembers.findTaskIdsByUser(callerUserId),
    ]);
    const ownIds = new Set(ownTasks.map((task) => task.id));
    const extraIds = memberTaskIds.filter((id) => !ownIds.has(id));
    const memberTasks = await this.repository.findByIds(extraIds);
    return this.withDisplayValues([...ownTasks, ...memberTasks]);
  }

  /** Tenant-agnostic single-task fetch — see listForCaller. */
  async findOneForCaller(taskId: string, callerUserId: string) {
    const task = await this.repository.findByIdGlobal(taskId);
    if (!task || !(await this.canAccess(task.tenantId, task, callerUserId))) {
      throw new NotFoundException('Task not found');
    }
    const [shaped] = await this.withDisplayValues([task]);
    return shaped;
  }

  async create(
    tenantId: string,
    createdBy: string,
    input: {
      projectId?: string;
      moduleId?: string;
      title: string;
      description?: string;
      status?: string;
      priority?: string;
      visibility?: string;
      workingWith?: string;
      estimatedHours?: string;
      dueDate?: string;
    },
  ) {
    const visibilityValue = input.visibility ?? 'Private';
    if (visibilityValue === 'Private' && input.workingWith) {
      throw new BadRequestException(
        'A private task cannot have workingWith set',
      );
    }

    const [
      { projectId, moduleId },
      statusId,
      priorityId,
      visibilityId,
      displayId,
    ] = await Promise.all([
      this.resolveLinkage(tenantId, input),
      this.resolveEnum('task_status', input.status),
      this.resolveEnum('importance', input.priority),
      this.resolveEnum('visibility', visibilityValue),
      this.sequences.nextDisplayId(tenantId, 'task'),
    ]);

    const task = await this.repository.create({
      tenantId,
      projectId: projectId ?? undefined,
      moduleId: moduleId ?? undefined,
      createdBy,
      title: input.title,
      description: input.description,
      statusId,
      priorityId,
      visibilityId,
      workingWith: input.workingWith,
      estimatedHours: input.estimatedHours,
      dueDate: input.dueDate,
      displayId,
    });

    if (!task) {
      throw new NotFoundException('Failed to create task');
    }
    if (visibilityValue === 'Shared') {
      await this.taskMembers.create({
        tenantId,
        taskId: task.id,
        userId: createdBy,
      });
    }

    const [shaped] = await this.withDisplayValues([task]);
    return shaped;
  }

  async update(
    tenantId: string,
    taskId: string,
    callerUserId: string,
    input: Partial<{
      title: string;
      description: string;
      status: string;
      priority: string;
      visibility: string;
      workingWith: string;
      estimatedHours: string;
      dueDate: string;
      projectId: string;
      moduleId: string;
    }>,
  ) {
    const existing = await this.findOne(tenantId, taskId, callerUserId);
    if (!existing) {
      throw new NotFoundException('Task not found');
    }

    if (input.visibility === 'Private' && input.workingWith) {
      throw new BadRequestException(
        'A private task cannot have workingWith set',
      );
    }

    const changesLinkage =
      input.projectId !== undefined || input.moduleId !== undefined;
    const [linkage, statusId, priorityId, visibilityId] = await Promise.all([
      changesLinkage ? this.resolveLinkage(tenantId, input) : undefined,
      input.status ? this.resolveEnum('task_status', input.status) : undefined,
      input.priority
        ? this.resolveEnum('importance', input.priority)
        : undefined,
      input.visibility
        ? this.resolveEnum('visibility', input.visibility)
        : undefined,
    ]);

    const task = await this.repository.update(tenantId, taskId, {
      title: input.title,
      description: input.description,
      statusId,
      priorityId,
      visibilityId,
      workingWith: input.visibility === 'Private' ? null : input.workingWith,
      estimatedHours: input.estimatedHours,
      dueDate: input.dueDate,
      projectId: linkage ? linkage.projectId : undefined,
      moduleId: linkage ? linkage.moduleId : undefined,
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }
    if (input.visibility === 'Private') {
      await this.taskMembers.deleteAllForTask(tenantId, taskId);
    }

    const [shaped] = await this.withDisplayValues([task]);
    return shaped;
  }

  async delete(tenantId: string, taskId: string, callerUserId: string) {
    const existing = await this.repository.findById(tenantId, taskId);
    if (!existing) {
      throw new NotFoundException('Task not found');
    }
    if (existing.createdBy !== callerUserId) {
      throw new ForbiddenException(
        'Only the task creator can delete this task',
      );
    }
    const task = await this.repository.delete(tenantId, taskId);
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  /** Tenant-agnostic update — resolves the task's real tenant first, then
   * delegates to the normal (still access-checked) update flow. */
  async updateForCaller(
    taskId: string,
    callerUserId: string,
    input: Parameters<TasksService['update']>[3],
  ) {
    const task = await this.repository.findByIdGlobal(taskId);
    if (!task || !(await this.canAccess(task.tenantId, task, callerUserId))) {
      throw new NotFoundException('Task not found');
    }
    return this.update(task.tenantId, taskId, callerUserId, input);
  }

  /** Tenant-agnostic delete — see updateForCaller. */
  async deleteForCaller(taskId: string, callerUserId: string) {
    const task = await this.repository.findByIdGlobal(taskId);
    if (!task || !(await this.canAccess(task.tenantId, task, callerUserId))) {
      throw new NotFoundException('Task not found');
    }
    return this.delete(task.tenantId, taskId, callerUserId);
  }

  private async withDisplayValues<
    T extends {
      statusId: string | null;
      priorityId: string | null;
      visibilityId: string | null;
    },
  >(rows: T[]) {
    const ids = rows
      .flatMap((r) => [r.statusId, r.priorityId, r.visibilityId])
      .filter((id): id is string => id !== null);

    const valuesById = await this.enumRepository.findValuesByIds(ids);

    return rows.map(({ statusId, priorityId, visibilityId, ...rest }) => ({
      ...rest,
      status: statusId ? (valuesById.get(statusId) ?? null) : null,
      priority: priorityId ? (valuesById.get(priorityId) ?? null) : null,
      visibility: visibilityId ? (valuesById.get(visibilityId) ?? null) : null,
    }));
  }

  private async resolveEnum(
    category: string,
    value?: string,
  ): Promise<string | undefined> {
    if (!value) return undefined;
    const match = await this.enumRepository.findByCategoryAndValue(
      category,
      value,
    );
    if (!match) {
      throw new NotFoundException(`Unknown ${category} value: "${value}"`);
    }
    return match.id;
  }
}
