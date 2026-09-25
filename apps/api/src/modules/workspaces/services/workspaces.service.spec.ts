import { NotFoundException } from '@nestjs/common';
import { DrizzleService } from '../../../db/drizzle.service';
import { WorkspacesRepository } from '../repositories/workspaces.repository';
import { WorkspacesService } from './workspaces.service';
import { ProjectsService } from '../../projects/services/projects.service';

describe('WorkspacesService', () => {
  let service: WorkspacesService;
  let repository: {
    findAllByMemberUserId: jest.Mock;
    findCurrentByUserId: jest.Mock;
    findWorkspaceForMember: jest.Mock;
    setCurrentWorkspace: jest.Mock;
    deleteById: jest.Mock;
    findPageByMemberUserId: jest.Mock;
  };
  let drizzle: { db: { insert: jest.Mock } };
  let projectsService: {
    create: jest.Mock;
  };

  beforeEach(() => {
    repository = {
      findAllByMemberUserId: jest.fn(),
      findCurrentByUserId: jest.fn(),
      findWorkspaceForMember: jest.fn(),
      setCurrentWorkspace: jest.fn(),
      deleteById: jest.fn(),
      findPageByMemberUserId: jest.fn(),
    };
    drizzle = { db: { insert: jest.fn() } };
    projectsService = {
      create: jest.fn(),
    };
    service = new WorkspacesService(
      repository as unknown as WorkspacesRepository,
      drizzle as unknown as DrizzleService,
      projectsService as unknown as ProjectsService,
    );
  });

  it('creates a workspace, owner membership, current context, and General project', async () => {
    const tenant = {
      id: 'tenant-1',
      name: 'My Workspace',
    };

    let insertCall = 0;

    drizzle.db.insert.mockImplementation(() => {
      insertCall += 1;

      if (insertCall === 1) {
        return {
          values: () => ({
            returning: () => Promise.resolve([tenant]),
          }),
        };
      }

      if (insertCall === 2) {
        return {
          values: () => Promise.resolve(undefined),
        };
      }

      return {
        values: () => ({
          onConflictDoUpdate: () => Promise.resolve(undefined),
        }),
      };
    });

    projectsService.create.mockResolvedValue({
      id: 'project-general',
      tenantId: 'tenant-1',
      userId: 'user-1',
      title: 'General',
    });

    await expect(
      service.createWorkspace('user-1', 'My Workspace'),
    ).resolves.toEqual({
      ...tenant,
      membershipRole: 'owner',
    });

    expect(drizzle.db.insert).toHaveBeenCalledTimes(3);

    expect(projectsService.create).toHaveBeenCalledWith('user-1', 'tenant-1', {
      title: 'General',
    });
  });

  it('returns a paginated list of active workspaces available to the user', async () => {
    const available = [{ id: 'tenant-1' }, { id: 'tenant-2' }];

    repository.findPageByMemberUserId.mockResolvedValue({
      data: available,
      totalItems: 45,
    });

    const result = await service.listWorkspaces('user-1', 2, 20);

    expect(repository.findPageByMemberUserId).toHaveBeenCalledWith(
      'user-1',
      20,
      20,
    );

    expect(result).toEqual({
      data: available,
      meta: {
        page: 2,
        pageSize: 20,
        totalItems: 45,
        totalPages: 3,
      },
    });
  });

  it('returns an existing persisted current workspace', async () => {
    const current = { id: 'tenant-2', name: 'Current' };
    repository.findCurrentByUserId.mockResolvedValue(current);

    await expect(service.getCurrentWorkspace('user-1')).resolves.toBe(current);
    expect(repository.findAllByMemberUserId).not.toHaveBeenCalled();
  });

  it('persists the first available workspace when no current context exists', async () => {
    const fallback = { id: 'tenant-1', name: 'Fallback' };
    repository.findCurrentByUserId.mockResolvedValue(undefined);
    repository.findAllByMemberUserId.mockResolvedValue([fallback]);

    await expect(service.getCurrentWorkspace('user-1')).resolves.toBe(fallback);
    expect(repository.setCurrentWorkspace).toHaveBeenCalledWith(
      'user-1',
      'tenant-1',
    );
  });

  it('rejects current workspace lookup when the user has no memberships', async () => {
    repository.findCurrentByUserId.mockResolvedValue(undefined);
    repository.findAllByMemberUserId.mockResolvedValue([]);

    await expect(service.getCurrentWorkspace('user-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('switches only to a workspace available to the user', async () => {
    const target = { id: 'tenant-2', name: 'Target' };
    repository.findWorkspaceForMember.mockResolvedValue(target);

    await expect(
      service.switchCurrentWorkspace('user-1', 'tenant-2'),
    ).resolves.toBe(target);
    expect(repository.setCurrentWorkspace).toHaveBeenCalledWith(
      'user-1',
      'tenant-2',
    );
  });

  it('rejects switching to an unavailable workspace', async () => {
    repository.findWorkspaceForMember.mockResolvedValue(undefined);

    await expect(
      service.switchCurrentWorkspace('user-1', 'tenant-other'),
    ).rejects.toThrow(NotFoundException);
    expect(repository.setCurrentWorkspace).not.toHaveBeenCalled();
  });

  it('deletes a workspace owned by the caller', async () => {
    const deleted = { id: 'tenant-1', name: 'Gone' };
    repository.deleteById.mockResolvedValue(deleted);

    await expect(service.deleteWorkspace('user-1', 'tenant-1')).resolves.toBe(
      deleted,
    );
    expect(repository.deleteById).toHaveBeenCalledWith('tenant-1', 'user-1');
  });

  it('rejects deleting a workspace the caller does not own', async () => {
    repository.deleteById.mockResolvedValue(undefined);

    await expect(service.deleteWorkspace('user-1', 'tenant-2')).rejects.toThrow(
      NotFoundException,
    );
  });
});
