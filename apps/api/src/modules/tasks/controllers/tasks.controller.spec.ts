// apps/api/src/modules/tasks/controllers/tasks.controller.spec.ts
import { TasksController } from './tasks.controller';
import { TasksService } from '../services/tasks.service';
import { UsersService } from '../../users/users.service';
import { ConfigService } from '@nestjs/config';

describe('TasksController', () => {
  let controller: TasksController;

  let tasksService: {
    list: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };

  let usersService: {
    findByExternalAuthId: jest.Mock;
  };

  let configService: {
    get: jest.Mock;
  };

  beforeEach(() => {
    tasksService = {
      list: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    usersService = { findByExternalAuthId: jest.fn() };
    configService = {
      get: jest.fn().mockReturnValue(50),
    };

    controller = new TasksController(
      tasksService as unknown as TasksService,
      usersService as unknown as UsersService,
      configService as unknown as ConfigService,
    );
  });

  const req = {
    user: { sub: 'supabase-user-1', accessToken: 'token-1' },
  } as any;

  describe('list', () => {
    it('passes the page and configured page size to the service', async () => {
      usersService.findByExternalAuthId.mockResolvedValue({
        id: 'user-1',
      });

      const tasks = {
        data: [{ id: 't1' }],
        meta: {
          page: 2,
          pageSize: 50,
          totalItems: 51,
          totalPages: 2,
        },
      };

      tasksService.list.mockResolvedValue(tasks);

      const result = await controller.list('tenant-1', req, {
        page: 2,
        projectId: 'project-1',
      });

      expect(configService.get).toHaveBeenCalledWith('PAGE_SIZE', 20);

      expect(tasksService.list).toHaveBeenCalledWith(
        'tenant-1',
        'user-1',
        2,
        50,
        'project-1',
      );

      expect(result).toBe(tasks);
    });

    it('defaults to page one when page is not supplied', async () => {
      usersService.findByExternalAuthId.mockResolvedValue({
        id: 'user-1',
      });

      tasksService.list.mockResolvedValue({
        data: [],
        meta: {
          page: 1,
          pageSize: 50,
          totalItems: 0,
          totalPages: 1,
        },
      });

      await controller.list('tenant-1', req, {});

      expect(tasksService.list).toHaveBeenCalledWith(
        'tenant-1',
        'user-1',
        1,
        50,
        undefined,
      );
    });
  });

  describe('findOne', () => {
    it('resolves the caller and delegates to the service with tenantId and taskId', async () => {
      usersService.findByExternalAuthId.mockResolvedValue({ id: 'user-1' });
      tasksService.findOne.mockResolvedValue({ id: 't1' });

      const result = await controller.findOne('tenant-1', 't1', req);

      expect(tasksService.findOne).toHaveBeenCalledWith(
        'tenant-1',
        't1',
        'user-1',
      );
      expect(result).toEqual({ id: 't1' });
    });
  });

  describe('create', () => {
    it('resolves the caller and delegates to the service', async () => {
      usersService.findByExternalAuthId.mockResolvedValue({ id: 'user-1' });
      tasksService.create.mockResolvedValue({ id: 't1' });

      const dto = { title: 'New Task' };

      const result = await controller.create('tenant-1', req, dto);

      expect(usersService.findByExternalAuthId).toHaveBeenCalledWith(
        'supabase-user-1',
      );
      expect(tasksService.create).toHaveBeenCalledWith(
        'tenant-1',
        'user-1',
        dto,
      );
      expect(result).toEqual({ id: 't1' });
    });
  });

  describe('update', () => {
    it('resolves the caller and delegates to the service with tenantId, taskId, and dto', async () => {
      usersService.findByExternalAuthId.mockResolvedValue({ id: 'user-1' });
      tasksService.update.mockResolvedValue({ id: 't1', title: 'Updated' });
      const dto = { title: 'Updated' };

      const result = await controller.update('tenant-1', 't1', req, dto);

      expect(tasksService.update).toHaveBeenCalledWith(
        'tenant-1',
        't1',
        'user-1',
        dto,
      );
      expect(result).toEqual({ id: 't1', title: 'Updated' });
    });
  });

  describe('remove', () => {
    it('resolves the caller and delegates to the service with tenantId and taskId', async () => {
      usersService.findByExternalAuthId.mockResolvedValue({ id: 'user-1' });
      tasksService.delete.mockResolvedValue({ id: 't1' });

      const result = await controller.remove('tenant-1', 't1', req);

      expect(tasksService.delete).toHaveBeenCalledWith(
        'tenant-1',
        't1',
        'user-1',
      );
      expect(result).toEqual({ id: 't1' });
    });
  });
});
