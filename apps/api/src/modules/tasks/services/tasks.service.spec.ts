// apps/api/src/modules/tasks/services/tasks.service.spec.ts
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksRepository } from '../repositories/tasks.repository';
import { EnumRepository } from '../../enum/repositories/enum.repository';
import { TenantSequencesRepository } from '../../tenant-sequences/repositories/tenant-sequences.repository';
import { TaskMembersRepository } from '../../task-members/repositories/task-members.repository';
import { ProjectModulesRepository } from '../../project-modules/repositories/project-modules.repository';
import { ProjectsRepository } from '../../projects/repositories/projects.repository';

describe('TasksService', () => {
  let service: TasksService;
  let repository: {
    findDescriptionEntries: jest.Mock;
    appendDescriptionEntry: jest.Mock;
    findById: jest.Mock;
    findByIdGlobal: jest.Mock;
    findVisibleByTenant: jest.Mock;
    findByCreator: jest.Mock;
    findByIds: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let enumRepository: {
    findByCategoryAndValue: jest.Mock;
    findValuesByIds: jest.Mock;
  };
  let sequences: { nextDisplayId: jest.Mock };
  let taskMembers: {
    create: jest.Mock;
    deleteAllForTask: jest.Mock;
    findByTaskAndUser: jest.Mock;
    findByTaskIdsAndUser: jest.Mock;
    findTaskIdsByUser: jest.Mock;
  };
  let modulesRepository: { findById: jest.Mock };
  let projectsRepository: { findById: jest.Mock };

  beforeEach(() => {
    repository = {
      findDescriptionEntries: jest.fn().mockResolvedValue([]),
      appendDescriptionEntry: jest.fn(),
      findById: jest.fn(),
      findByIdGlobal: jest.fn(),
      findVisibleByTenant: jest.fn(),
      findByCreator: jest.fn(),
      findByIds: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    enumRepository = {
      findByCategoryAndValue: jest.fn(),
      findValuesByIds: jest.fn().mockResolvedValue(new Map()),
    };
    sequences = {
      nextDisplayId: jest.fn().mockResolvedValue('TSK-0001'),
    };
    taskMembers = {
      create: jest.fn(),
      deleteAllForTask: jest.fn(),
      findByTaskAndUser: jest.fn().mockResolvedValue(undefined),
      findByTaskIdsAndUser: jest.fn().mockResolvedValue(new Set()),
      findTaskIdsByUser: jest.fn().mockResolvedValue([]),
    };
    modulesRepository = { findById: jest.fn() };
    projectsRepository = { findById: jest.fn() };

    service = new TasksService(
      repository as unknown as TasksRepository,
      enumRepository as unknown as EnumRepository,
      sequences as unknown as TenantSequencesRepository,
      taskMembers as unknown as TaskMembersRepository,
      modulesRepository as unknown as ProjectModulesRepository,
      projectsRepository as unknown as ProjectsRepository,
    );
  });

  describe('create', () => {
    it('resolves status (task_status) and priority (importance) to enum ids', async () => {
      enumRepository.findByCategoryAndValue.mockImplementation(
        (category: string, value: string) =>
          Promise.resolve({ id: `${category}-${value}-id` }),
      );
      repository.create.mockResolvedValue({ id: 'task-1' });

      await service.create('tenant-1', 'user-1', {
        title: 'New Task',
        status: 'To_do',
        priority: 'High',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          statusId: 'task_status-To_do-id',
          priorityId: 'importance-High-id',
        }),
      );
    });

    it('derives projectId from an independent module rather than trusting the caller', async () => {
      enumRepository.findByCategoryAndValue.mockResolvedValue({
        id: 'enum-id',
      });
      modulesRepository.findById.mockResolvedValue({
        id: 'module-1',
        projectId: null,
      });
      repository.create.mockResolvedValue({ id: 'task-1' });

      await service.create('tenant-1', 'user-1', {
        title: 'New Task',
        moduleId: 'module-1',
        projectId: 'project-should-be-ignored',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: undefined, moduleId: 'module-1' }),
      );
    });

    it('derives projectId from a project-scoped module', async () => {
      enumRepository.findByCategoryAndValue.mockResolvedValue({
        id: 'enum-id',
      });
      modulesRepository.findById.mockResolvedValue({
        id: 'module-1',
        projectId: 'project-1',
      });
      repository.create.mockResolvedValue({ id: 'task-1' });

      await service.create('tenant-1', 'user-1', {
        title: 'New Task',
        moduleId: 'module-1',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'project-1',
          moduleId: 'module-1',
        }),
      );
    });

    it('rejects a direct link to an archived or unknown project', async () => {
      enumRepository.findByCategoryAndValue.mockResolvedValue({
        id: 'enum-id',
      });
      projectsRepository.findById.mockResolvedValue(undefined);

      await expect(
        service.create('tenant-1', 'user-1', {
          title: 'New Task',
          projectId: 'archived-project',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('dated descriptions', () => {
    const originalEntry = {
      id: 'entry-1',
      taskId: 'task-1',
      content: 'Original description',
      createdAt: '2026-10-12T06:00:00.000Z',
    };

    const newEntry = {
      id: 'entry-2',
      taskId: 'task-1',
      content: 'New description content',
      createdAt: '2026-10-13T06:00:00.000Z',
    };

    const task = {
      id: 'task-1',
      tenantId: 'tenant-1',
      createdBy: 'user-1',
      title: 'Research task',
      description: 'Original description',
      statusId: null,
      priorityId: null,
      visibilityId: null,
    };

    beforeEach(() => {
      repository.findById.mockResolvedValue(task);
      repository.findDescriptionEntries.mockResolvedValue([originalEntry]);
    });

    it('returns description entries with their original timestamps', async () => {
      const result = await service.findOne('tenant-1', 'task-1', 'user-1');

      expect(result.descriptionEntries).toEqual([originalEntry]);
      expect(repository.findDescriptionEntries).toHaveBeenCalledWith(
        'tenant-1',
        'task-1',
      );
    });

    it('returns initial description entries after creating a task', async () => {
      enumRepository.findByCategoryAndValue.mockResolvedValue({
        id: 'visibility-private-id',
      });
      repository.create.mockResolvedValue(task);

      const result = await service.create('tenant-1', 'user-1', {
        title: 'Research task',
        description: 'Original description',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Original description',
        }),
      );
      expect(result.descriptionEntries).toEqual([originalEntry]);
    });

    it('adds trimmed content and returns both description entries', async () => {
      repository.appendDescriptionEntry.mockResolvedValue(task);
      repository.findDescriptionEntries
        .mockResolvedValueOnce([originalEntry])
        .mockResolvedValueOnce([newEntry, originalEntry]);

      const result = await service.appendDescriptionEntry(
        'tenant-1',
        'task-1',
        'user-1',
        { content: '  New description content  ' },
      );

      expect(repository.appendDescriptionEntry).toHaveBeenCalledWith(
        'tenant-1',
        'task-1',
        'New description content',
      );
      expect(result.descriptionEntries).toEqual([newEntry, originalEntry]);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('rejects whitespace-only additions without writing', async () => {
      await expect(
        service.appendDescriptionEntry('tenant-1', 'task-1', 'user-1', {
          content: ' \n\t ',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(repository.appendDescriptionEntry).not.toHaveBeenCalled();
    });

    it('does not read description entries or write for an outsider', async () => {
      await expect(
        service.appendDescriptionEntry('tenant-1', 'task-1', 'outsider-1', {
          content: 'New content',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(repository.findDescriptionEntries).not.toHaveBeenCalled();
      expect(repository.appendDescriptionEntry).not.toHaveBeenCalled();
    });

    it('allows a member to add content using the task real tenant', async () => {
      const sharedTask = {
        ...task,
        tenantId: 'tenant-2',
        createdBy: 'owner-1',
      };
      repository.findByIdGlobal.mockResolvedValue(sharedTask);
      repository.findById.mockResolvedValue(sharedTask);
      taskMembers.findByTaskAndUser.mockResolvedValue({
        id: 'membership-1',
      });
      repository.appendDescriptionEntry.mockResolvedValue(sharedTask);

      await service.appendDescriptionEntryForCaller('task-1', 'member-1', {
        content: 'New content',
      });

      expect(repository.appendDescriptionEntry).toHaveBeenCalledWith(
        'tenant-2',
        'task-1',
        'New content',
      );
      expect(repository.findDescriptionEntries).toHaveBeenCalledWith(
        'tenant-2',
        'task-1',
      );
    });

    it('rejects an outsider through the tenant-agnostic path', async () => {
      repository.findByIdGlobal.mockResolvedValue({
        ...task,
        tenantId: 'tenant-2',
        createdBy: 'owner-1',
      });

      await expect(
        service.appendDescriptionEntryForCaller('task-1', 'outsider-1', {
          content: 'New content',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(repository.findDescriptionEntries).not.toHaveBeenCalled();
      expect(repository.appendDescriptionEntry).not.toHaveBeenCalled();
    });

    it('rejects replacement of earlier description content', async () => {
      await expect(
        service.update('tenant-1', 'task-1', 'user-1', {
          description: 'Replacement description',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(repository.update).not.toHaveBeenCalled();
      expect(repository.appendDescriptionEntry).not.toHaveBeenCalled();
    });

    it('updates metadata without writing description content', async () => {
      repository.update.mockResolvedValue({
        ...task,
        title: 'Updated title',
      });

      const result = await service.update('tenant-1', 'task-1', 'user-1', {
        title: 'Updated title',
        description: 'Original description',
      });

      expect(result.title).toBe('Updated title');
      expect(result.descriptionEntries).toEqual([originalEntry]);
      expect(repository.update.mock.calls[0][2]).not.toHaveProperty(
        'description',
      );
      expect(repository.appendDescriptionEntry).not.toHaveBeenCalled();
    });

    it('handles a task disappearing before the addition is saved', async () => {
      repository.appendDescriptionEntry.mockResolvedValue(undefined);

      await expect(
        service.appendDescriptionEntry('tenant-1', 'task-1', 'user-1', {
          content: 'New content',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('throws NotFoundException if the task does not exist', async () => {
      repository.findById.mockResolvedValue(undefined);
      await expect(
        service.delete('tenant-1', 'task-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns the deleted task when the caller is the creator', async () => {
      repository.findById.mockResolvedValue({
        id: 'task-1',
        createdBy: 'user-1',
      });
      repository.delete.mockResolvedValue({ id: 'task-1' });
      const result = await service.delete('tenant-1', 'task-1', 'user-1');
      expect(result).toEqual({ id: 'task-1' });
    });

    it('throws ForbiddenException if the caller is not the creator', async () => {
      repository.findById.mockResolvedValue({
        id: 'task-1',
        createdBy: 'owner-1',
      });
      await expect(
        service.delete('tenant-1', 'task-1', 'outsider-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(repository.delete).not.toHaveBeenCalled();
    });
    it('throws ForbiddenException when the caller is only a task member, not the creator', async () => {
      repository.findById.mockResolvedValue({
        id: 'task-1',
        createdBy: 'owner-1',
      });
      taskMembers.findByTaskAndUser.mockResolvedValue({ id: 'member-row' });
      await expect(
        service.delete('tenant-1', 'task-1', 'member-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(repository.delete).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when the task does not exist', async () => {
      repository.findById.mockResolvedValue(undefined);
      await expect(
        service.findOne('tenant-1', 'task-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the caller is neither creator nor member', async () => {
      repository.findById.mockResolvedValue({
        id: 'task-1',
        createdBy: 'owner-1',
        statusId: null,
        priorityId: null,
        visibilityId: null,
      });
      await expect(
        service.findOne('tenant-1', 'task-1', 'outsider-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns the task when the caller is the creator', async () => {
      repository.findById.mockResolvedValue({
        id: 'task-1',
        createdBy: 'user-1',
        statusId: null,
        priorityId: null,
        visibilityId: null,
      });
      const result = await service.findOne('tenant-1', 'task-1', 'user-1');
      expect(result).toEqual(expect.objectContaining({ id: 'task-1' }));
    });
  });

  describe('list', () => {
    it('rejects oversized All requests instead of returning a truncated list', async () => {
      repository.findVisibleByTenant.mockResolvedValue({
        data: [],
        totalItems: 5001,
      });

      await expect(
        service.list('tenant-1', 'user-1', 1, 'all'),
      ).rejects.toThrow('All is limited');
    });

    it('returns every matching row in one bounded All response', async () => {
      repository.findVisibleByTenant.mockResolvedValue({
        data: [1, 2, 3].map((id) => ({
          id: String(id),
          statusId: null,
          priorityId: null,
          visibilityId: null,
        })),
        totalItems: 3,
      });

      const result = await service.list('tenant-1', 'user-1', 7, 'all');

      expect(result.data.map((item) => item.id)).toEqual(['1', '2', '3']);
      expect(result.meta).toEqual({
        page: 1,
        pageSize: 5000,
        totalItems: 3,
        totalPages: 1,
      });
      expect(repository.findVisibleByTenant).toHaveBeenCalledTimes(1);
    });

    it('preserves server summary counts beyond the current page', async () => {
      repository.findVisibleByTenant.mockResolvedValue({
        data: [],
        totalItems: 85,
        summary: { open: 61 },
      });

      const result = await service.list('tenant-1', 'user-1', 1, 20);

      expect(result.summary).toEqual({ open: 61 });
    });

    it('returns a paginated page of visible tasks', async () => {
      repository.findVisibleByTenant.mockResolvedValue({
        data: [
          {
            id: 'task-21',
            createdBy: 'user-1',
            statusId: null,
            priorityId: null,
            visibilityId: null,
          },
        ],
        totalItems: 41,
      });

      const result = await service.list(
        'tenant-1',
        'user-1',
        2,
        20,
        'project-1',
      );

      expect(repository.findVisibleByTenant).toHaveBeenCalledWith(
        'tenant-1',
        'user-1',
        20,
        20,
        'project-1',
        undefined,
        false,
        undefined,
        undefined,
      );
      expect(result.data.map((task) => task.id)).toEqual(['task-21']);
      expect(result.meta).toEqual({
        page: 2,
        pageSize: 20,
        totalItems: 41,
        totalPages: 3,
      });
    });

    it('returns pagination metadata when no visible tasks exist', async () => {
      repository.findVisibleByTenant.mockResolvedValue({
        data: [],
        totalItems: 0,
      });

      const result = await service.list('tenant-1', 'user-1', 1, 20);

      expect(repository.findVisibleByTenant).toHaveBeenCalledWith(
        'tenant-1',
        'user-1',
        0,
        20,
        undefined,
        undefined,
        false,
        undefined,
        undefined,
      );
      expect(result.data).toEqual([]);
      expect(result.meta).toEqual({
        page: 1,
        pageSize: 20,
        totalItems: 0,
        totalPages: 1,
      });
    });

    it('passes multiple filters to the repository and preserves filtered pagination totals', async () => {
      repository.findVisibleByTenant.mockResolvedValue({
        data: [
          {
            id: 'task-21',
            createdBy: 'user-1',
            statusId: null,
            priorityId: null,
            visibilityId: null,
          },
        ],
        totalItems: 21,
        summary: { open: 21 },
      });

      const statuses = ['To do', 'Underway', 'Waiting'];
      const priorities = ['High', 'Critical'];

      const result = await service.list(
        'tenant-1',
        'user-1',
        2,
        20,
        undefined,
        undefined,
        false,
        statuses,
        priorities,
      );

      expect(repository.findVisibleByTenant).toHaveBeenCalledWith(
        'tenant-1',
        'user-1',
        20,
        20,
        undefined,
        undefined,
        false,
        statuses,
        priorities,
      );
      expect(result.meta).toEqual({
        page: 2,
        pageSize: 20,
        totalItems: 21,
        totalPages: 2,
      });
      expect(result.summary).toEqual({ open: 21 });
    });
  });

  describe('listForCaller', () => {
    it('combines tasks the caller created with tasks they are a member of, across tenants', async () => {
      repository.findByCreator.mockResolvedValue([
        {
          id: 'task-own',
          createdBy: 'user-1',
          statusId: null,
          priorityId: null,
          visibilityId: null,
        },
      ]);
      taskMembers.findTaskIdsByUser.mockResolvedValue([
        'task-own',
        'task-shared',
      ]);
      repository.findByIds.mockResolvedValue([
        {
          id: 'task-shared',
          createdBy: 'owner-2',
          statusId: null,
          priorityId: null,
          visibilityId: null,
        },
      ]);

      const result = await service.listForCaller('user-1');

      expect(repository.findByIds).toHaveBeenCalledWith(['task-shared']);
      expect(result.map((task) => task.id).sort()).toEqual([
        'task-own',
        'task-shared',
      ]);
    });
  });

  describe('findOneForCaller', () => {
    it('throws NotFoundException when the caller is neither creator nor member', async () => {
      repository.findByIdGlobal.mockResolvedValue({
        id: 'task-1',
        tenantId: 'tenant-2',
        createdBy: 'owner-1',
      });
      await expect(
        service.findOneForCaller('task-1', 'outsider-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns the task from its own tenant even when the caller belongs to a different tenant', async () => {
      repository.findByIdGlobal.mockResolvedValue({
        id: 'task-1',
        tenantId: 'tenant-2',
        createdBy: 'owner-1',
        statusId: null,
        priorityId: null,
        visibilityId: null,
      });
      taskMembers.findByTaskAndUser.mockResolvedValue({ id: 'member-row' });

      const result = await service.findOneForCaller('task-1', 'member-1');

      expect(taskMembers.findByTaskAndUser).toHaveBeenCalledWith(
        'tenant-2',
        'task-1',
        'member-1',
      );
      expect(result).toEqual(expect.objectContaining({ id: 'task-1' }));
    });
  });

  describe('deleteForCaller', () => {
    it('throws NotFoundException when the task does not exist', async () => {
      repository.findByIdGlobal.mockResolvedValue(undefined);
      await expect(service.deleteForCaller('task-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it("deletes using the task's own tenant, not any tenant supplied by the caller", async () => {
      repository.findByIdGlobal.mockResolvedValue({
        id: 'task-1',
        tenantId: 'tenant-2',
        createdBy: 'user-1',
      });
      repository.findById.mockResolvedValue({
        id: 'task-1',
        tenantId: 'tenant-2',
        createdBy: 'user-1',
      });
      repository.delete.mockResolvedValue({ id: 'task-1' });

      const result = await service.deleteForCaller('task-1', 'user-1');

      expect(repository.delete).toHaveBeenCalledWith('tenant-2', 'task-1');
      expect(result).toEqual({ id: 'task-1' });
    });
  });
});
