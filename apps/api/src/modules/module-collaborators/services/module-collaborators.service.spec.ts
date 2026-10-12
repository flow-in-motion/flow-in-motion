import { ModuleCollaboratorsService } from './module-collaborators.service';
import { ModuleCollaboratorsRepository } from '../repositories/module-collaborators.repository';
import { ProjectModulesRepository } from '../../project-modules/repositories/project-modules.repository';
import { EnumRepository } from '../../enum/repositories/enum.repository';
import { UsersService } from '../../users/users.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('ModuleCollaboratorsService', () => {
  it('includes saved invitation contacts and deduplicates accepted users by email', async () => {
    const repository = {
      findInvitationContactsByModule: jest.fn().mockResolvedValue([
        {
          invitationId: 'invite-accepted',
          email: 'sam@example.com',
          displayName: 'Sam',
          affiliation: null,
          status: 'accepted',
        },
        {
          invitationId: 'invite-draft',
          email: 'dana@example.com',
          displayName: 'Dana Draft',
          affiliation: 'Monash University',
          status: 'draft',
        },
      ]),
    };
    const service = new ModuleCollaboratorsService(
      repository as unknown as ModuleCollaboratorsRepository,
      {} as ProjectModulesRepository,
      {} as EnumRepository,
      {
        findSummariesByIds: jest.fn().mockResolvedValue([
          {
            id: 'user-owner',
            email: 'owner@example.com',
          },
        ]),
      } as unknown as UsersService,
    );
    jest.spyOn(service, 'list').mockResolvedValue([
      {
        id: 'collaborator-1',
        tenantId: 'tenant-1',
        moduleId: 'module-1',
        projectId: null,
        userId: 'user-sam',
        role: 'Collaborator',
        displayName: 'Sam Coauthor',
        email: 'sam@example.com',
        affiliation: 'CSIRO',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await expect(
      service.listContacts('tenant-1', 'module-1', 'user-owner'),
    ).resolves.toEqual([
      {
        id: 'invitation:invite-draft',
        userId: null,
        invitationId: 'invite-draft',
        displayName: 'Dana Draft',
        affiliation: 'Monash University',
      },
      {
        id: 'user:user-sam',
        userId: 'user-sam',
        invitationId: 'invite-accepted',
        displayName: 'Sam Coauthor',
        affiliation: 'CSIRO',
      },
    ]);
  });
});
describe('ModuleCollaboratorsService authorization', () => {
  function setup() {
    const repository = {
      findByModuleAndUser: jest.fn().mockResolvedValue(undefined),
      findByModule: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      updateRole: jest.fn(),
      delete: jest.fn(),
    };

    const modulesRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'module-1',
        tenantId: 'tenant-1',
        projectId: 'project-1',
      }),
      isProjectOwner: jest.fn().mockResolvedValue(false),
    };

    const enumRepository = {
      findByCategoryAndValue: jest.fn().mockResolvedValue({
        id: 'role-owner',
      }),
      findValuesByIds: jest.fn().mockResolvedValue(new Map()),
    };

    const usersService = {
      findSummariesByIds: jest.fn().mockResolvedValue([]),
    };

    const service = new ModuleCollaboratorsService(
      repository as unknown as ModuleCollaboratorsRepository,
      modulesRepository as unknown as ProjectModulesRepository,
      enumRepository as unknown as EnumRepository,
      usersService as unknown as UsersService,
    );

    return { service, repository, modulesRepository };
  }

  it('allows the project owner without creating paper membership', async () => {
    const { service, repository, modulesRepository } = setup();
    modulesRepository.isProjectOwner.mockResolvedValue(true);

    await expect(
      service.assertCanManageCollaborators('tenant-1', 'module-1', 'user-1'),
    ).resolves.toBeUndefined();

    expect(modulesRepository.isProjectOwner).toHaveBeenCalledWith(
      'tenant-1',
      'project-1',
      'user-1',
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('allows the paper owner without project ownership', async () => {
    const { service, repository } = setup();
    repository.findByModuleAndUser.mockResolvedValue({
      roleId: 'role-owner',
    });

    await expect(
      service.assertCanManageCollaborators('tenant-1', 'module-1', 'user-1'),
    ).resolves.toBeUndefined();
  });

  it('rejects an ordinary paper collaborator from managing collaborators', async () => {
    const { service, repository } = setup();
    repository.findByModuleAndUser.mockResolvedValue({
      roleId: 'role-collaborator',
    });

    await expect(
      service.assertCanManageCollaborators('tenant-1', 'module-1', 'user-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects a caller with no paper membership or project ownership', async () => {
    const { service } = setup();

    await expect(
      service.assertCanManageCollaborators('tenant-1', 'module-1', 'user-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('blocks unauthorized collaborator mutations before any write', async () => {
    const { service, repository } = setup();

    await expect(
      service.add('tenant-1', 'module-1', 'user-2', 'Collaborator', 'user-1'),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      service.updateRole('tenant-1', 'module-1', 'user-2', 'Owner', 'user-1'),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      service.remove('tenant-1', 'module-1', 'user-2', 'user-1'),
    ).rejects.toThrow(ForbiddenException);

    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.updateRole).not.toHaveBeenCalled();
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('allows a paper collaborator to view collaborators without project membership', async () => {
    const { service, repository, modulesRepository } = setup();
    repository.findByModuleAndUser.mockResolvedValue({
      roleId: 'role-collaborator',
    });

    await expect(
      service.list('tenant-1', 'module-1', 'user-1'),
    ).resolves.toEqual([]);

    expect(modulesRepository.isProjectOwner).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('allows the project owner to view collaborators without creating membership', async () => {
    const { service, repository, modulesRepository } = setup();
    modulesRepository.isProjectOwner.mockResolvedValue(true);

    await expect(
      service.list('tenant-1', 'module-1', 'user-1'),
    ).resolves.toEqual([]);

    expect(repository.create).not.toHaveBeenCalled();
  });

  it('hides the collaborator list from a caller without paper access', async () => {
    const { service, repository } = setup();

    await expect(
      service.list('tenant-1', 'module-1', 'user-1'),
    ).rejects.toThrow(NotFoundException);

    expect(repository.findByModule).not.toHaveBeenCalled();
  });
});
