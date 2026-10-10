import { ModuleCollaboratorsService } from './module-collaborators.service';
import { ModuleCollaboratorsRepository } from '../repositories/module-collaborators.repository';
import { ProjectModulesRepository } from '../../project-modules/repositories/project-modules.repository';
import { ProjectCollaboratorsRepository } from '../../project-collaborators/repositories/project-collaborators.repository';
import { EnumRepository } from '../../enum/repositories/enum.repository';
import { UsersService } from '../../users/users.service';
import { MembershipsRepository } from '../../memberships/repositories/memberships.repository';

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
      {} as ProjectCollaboratorsRepository,
      {} as EnumRepository,
      {
        findSummariesByIds: jest.fn().mockResolvedValue([
          {
            id: 'user-owner',
            email: 'owner@example.com',
          },
        ]),
      } as unknown as UsersService,
      {} as MembershipsRepository,
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
