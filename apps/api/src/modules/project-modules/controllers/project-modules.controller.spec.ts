import { ProjectModulesController } from './project-modules.controller';
import { ProjectModulesService } from '../services/project-modules.service';
import { UsersService } from '../../users/users.service';
import { ConfigService } from '@nestjs/config';
import { CreateModuleDto } from '../dto/create-module.dto';

describe('ProjectModulesController', () => {
  let controller: ProjectModulesController;
  let modulesService: {
    listActive: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    archive: jest.Mock;
  };
  let usersService: { findByExternalAuthId: jest.Mock };
  let configService: {
    get: jest.Mock;
  };

  beforeEach(() => {
    modulesService = {
      listActive: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      archive: jest.fn(),
    };
    usersService = {
      findByExternalAuthId: jest.fn().mockResolvedValue({ id: 'user-1' }),
    };
    configService = {
      get: jest.fn().mockReturnValue(20),
    };

    controller = new ProjectModulesController(
      modulesService as unknown as ProjectModulesService,
      usersService as unknown as UsersService,
      configService as unknown as ConfigService,
    );
  });

  const req = {
    user: { sub: 'supabase-user-1', accessToken: 'token-1' },
  } as any;

  describe('list', () => {
    it('resolves the caller and delegates with pagination parameters', async () => {
      const response = {
        data: [{ id: 'm1' }],
        meta: {
          page: 2,
          pageSize: 20,
          totalItems: 21,
          totalPages: 2,
        },
      };

      modulesService.listActive.mockResolvedValue(response);

      const result = await controller.list('tenant-1', req, {
        page: 2,
        projectId: 'project-1',
      });

      expect(usersService.findByExternalAuthId).toHaveBeenCalledWith(
        'supabase-user-1',
      );

      expect(configService.get).toHaveBeenCalledWith('PAGE_SIZE', 20);

      expect(modulesService.listActive).toHaveBeenCalledWith(
        'tenant-1',
        'user-1',
        2,
        20,
        'project-1',
      );

      expect(result).toBe(response);
    });
  });

  describe('findOne', () => {
    it('resolves the caller and delegates to the service', async () => {
      modulesService.findOne.mockResolvedValue({ id: 'm1' });

      const result = await controller.findOne('tenant-1', 'm1', req);

      expect(modulesService.findOne).toHaveBeenCalledWith(
        'tenant-1',
        'm1',
        'user-1',
      );
      expect(result).toEqual({ id: 'm1' });
    });
  });

  describe('create', () => {
    it('resolves the caller and delegates to the service', async () => {
      modulesService.create.mockResolvedValue({ id: 'm1' });
      const dto: CreateModuleDto = {
        shortTitle: '...',
        title: '...',
        projectId: '11111111-1111-4111-8111-111111111111',
      };

      const result = await controller.create('tenant-1', req, dto);

      expect(modulesService.create).toHaveBeenCalledWith(
        'tenant-1',
        'user-1',
        dto,
      );
      expect(result).toEqual({ id: 'm1' });
    });
  });

  describe('update', () => {
    it('resolves the caller and delegates to the service', async () => {
      modulesService.update.mockResolvedValue({ id: 'm1', title: 'Updated' });
      const dto = { title: 'Updated' };

      const result = await controller.update('tenant-1', 'm1', req, dto);

      expect(modulesService.update).toHaveBeenCalledWith(
        'tenant-1',
        'm1',
        'user-1',
        dto,
      );
      expect(result).toEqual({ id: 'm1', title: 'Updated' });
    });
  });

  describe('archive', () => {
    it('resolves the caller and delegates to the service', async () => {
      modulesService.archive.mockResolvedValue({
        module: { id: 'm1' },
        warning: '14 days',
      });

      const result = await controller.archive('tenant-1', 'm1', req);

      expect(modulesService.archive).toHaveBeenCalledWith(
        'tenant-1',
        'm1',
        'user-1',
      );
      expect(result.warning).toBe('14 days');
    });
  });
});
