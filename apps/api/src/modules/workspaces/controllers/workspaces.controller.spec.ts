import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from '../services/workspaces.service';
import { UsersService } from '../../users/users.service';
import { ConfigService } from '@nestjs/config';

describe('WorkspacesController', () => {
  let controller: WorkspacesController;
  let workspacesService: {
    createWorkspace: jest.Mock;
    listWorkspaces: jest.Mock;
    getCurrentWorkspace: jest.Mock;
    switchCurrentWorkspace: jest.Mock;
    deleteWorkspace: jest.Mock;
  };
  let usersService: { findOrProvisionFromPrincipal: jest.Mock };
  let configService: {
    get: jest.Mock;
  };

  beforeEach(async () => {
    workspacesService = {
      createWorkspace: jest.fn(),
      listWorkspaces: jest.fn(),
      getCurrentWorkspace: jest.fn(),
      switchCurrentWorkspace: jest.fn(),
      deleteWorkspace: jest.fn(),
    };
    usersService = {
      findOrProvisionFromPrincipal: jest.fn(),
    };
    configService = {
      get: jest.fn().mockReturnValue(20),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [WorkspacesController],
      providers: [
        {
          provide: WorkspacesService,
          useValue: workspacesService,
        },
        {
          provide: UsersService,
          useValue: usersService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    controller = moduleRef.get<WorkspacesController>(WorkspacesController);
  });

  describe('list', () => {
    it('lists paginated workspaces for the provisioned caller', async () => {
      usersService.findOrProvisionFromPrincipal.mockResolvedValue({
        id: 'user-1',
      });

      const response = {
        data: [{ id: 'tenant-1' }, { id: 'tenant-2' }],
        meta: {
          page: 2,
          pageSize: 20,
          totalItems: 22,
          totalPages: 2,
        },
      };

      workspacesService.listWorkspaces.mockResolvedValue(response);

      const req = {
        user: {
          sub: 'supabase-user-1',
          accessToken: 'token-1',
        },
      } as any;

      const result = await controller.list(req, { page: 2 });

      expect(usersService.findOrProvisionFromPrincipal).toHaveBeenCalledWith(
        req.user,
      );

      expect(configService.get).toHaveBeenCalledWith('PAGE_SIZE', 20);

      expect(workspacesService.listWorkspaces).toHaveBeenCalledWith(
        'user-1',
        2,
        20,
      );

      expect(result).toBe(response);
    });
  });

  describe('create', () => {
    it('resolves the caller and delegates to the service', async () => {
      usersService.findOrProvisionFromPrincipal.mockResolvedValue({
        id: 'user-1',
      });
      workspacesService.createWorkspace.mockResolvedValue({
        id: 'tenant-1',
        name: 'New Co',
      });

      const req = {
        user: { sub: 'supabase-user-1', accessToken: 'token-1' },
      } as any;
      const dto = { name: 'New Co' };

      const result = await controller.create(req, dto);

      expect(usersService.findOrProvisionFromPrincipal).toHaveBeenCalledWith(
        req.user,
      );
      expect(workspacesService.createWorkspace).toHaveBeenCalledWith(
        'user-1',
        'New Co',
      );
      expect(result).toEqual({ id: 'tenant-1', name: 'New Co' });
    });

    it('throws NotFoundException if the user could not be found or provisioned', async () => {
      usersService.findOrProvisionFromPrincipal.mockResolvedValue(undefined);

      const req = {
        user: { sub: 'supabase-user-2', accessToken: 'token-2' },
      } as any;
      const dto = { name: 'New Co' };

      await expect(controller.create(req, dto as any)).rejects.toThrow(
        NotFoundException,
      );
      expect(workspacesService.createWorkspace).not.toHaveBeenCalled();
    });
  });

  describe('getCurrent', () => {
    it('resolves the caller and delegates to the service', async () => {
      usersService.findOrProvisionFromPrincipal.mockResolvedValue({
        id: 'user-1',
      });
      workspacesService.getCurrentWorkspace.mockResolvedValue({
        id: 'tenant-1',
      });

      const req = {
        user: { sub: 'supabase-user-1', accessToken: 'token-1' },
      } as any;

      const result = await controller.getCurrent(req);

      expect(workspacesService.getCurrentWorkspace).toHaveBeenCalledWith(
        'user-1',
      );
      expect(result).toEqual({ id: 'tenant-1' });
    });

    it('throws NotFoundException if the user could not be found or provisioned', async () => {
      usersService.findOrProvisionFromPrincipal.mockResolvedValue(undefined);

      const req = {
        user: { sub: 'supabase-user-2', accessToken: 'token-2' },
      } as any;

      await expect(controller.getCurrent(req)).rejects.toThrow(
        NotFoundException,
      );
      expect(workspacesService.getCurrentWorkspace).not.toHaveBeenCalled();
    });
  });

  describe('switchCurrent', () => {
    it('switches to an available workspace for the provisioned caller', async () => {
      usersService.findOrProvisionFromPrincipal.mockResolvedValue({
        id: 'user-1',
      });
      workspacesService.switchCurrentWorkspace.mockResolvedValue({
        id: 'tenant-2',
      });
      const req = {
        user: { sub: 'supabase-user-1', accessToken: 'token-1' },
      } as any;

      await expect(
        controller.switchCurrent(req, { workspaceId: 'tenant-2' }),
      ).resolves.toEqual({ id: 'tenant-2' });
      expect(workspacesService.switchCurrentWorkspace).toHaveBeenCalledWith(
        'user-1',
        'tenant-2',
      );
    });
  });

  describe('remove', () => {
    it('resolves the caller and delegates to the service', async () => {
      usersService.findOrProvisionFromPrincipal.mockResolvedValue({
        id: 'user-1',
      });
      workspacesService.deleteWorkspace.mockResolvedValue({ id: 'tenant-1' });

      const req = {
        user: { sub: 'supabase-user-1', accessToken: 'token-1' },
      } as any;

      await expect(controller.remove(req, 'tenant-1')).resolves.toEqual({
        id: 'tenant-1',
      });
      expect(workspacesService.deleteWorkspace).toHaveBeenCalledWith(
        'user-1',
        'tenant-1',
      );
    });

    it('throws NotFoundException if the user could not be found or provisioned', async () => {
      usersService.findOrProvisionFromPrincipal.mockResolvedValue(undefined);

      const req = {
        user: { sub: 'supabase-user-2', accessToken: 'token-2' },
      } as any;

      await expect(controller.remove(req, 'tenant-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(workspacesService.deleteWorkspace).not.toHaveBeenCalled();
    });
  });
});
