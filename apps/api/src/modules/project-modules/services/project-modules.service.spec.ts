import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ProjectModulesService } from './project-modules.service';
import { ProjectModulesRepository } from '../repositories/project-modules.repository';
import { EnumRepository } from '../../enum/repositories/enum.repository';
import { ModuleCollaboratorsRepository } from '../../module-collaborators/repositories/module-collaborators.repository';
import { ProjectCollaboratorsRepository } from '../../project-collaborators/repositories/project-collaborators.repository';
import { TenantSequencesRepository } from '../../tenant-sequences/repositories/tenant-sequences.repository';
import { ProjectsRepository } from '../../projects/repositories/projects.repository';

describe('ProjectModulesService', () => {
  let service: ProjectModulesService;
  let projectsRepository: {
    findById: jest.Mock;
  };
  let repository: {
    findById: jest.Mock;
    findByIdGlobal: jest.Mock;
    findVisibleActiveByTenant: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    archive: jest.Mock;
    findAccessiblePageByUser: jest.Mock;
    findRememberedVenueValues: jest.Mock;
    findCurrentlyWithCollaborators: jest.Mock;
    findInvitationById: jest.Mock;
    archiveImpact: jest.Mock;
  };
  let enumRepository: {
    findByCategoryAndValue: jest.Mock;
    findModuleStageByValueForTenant: jest.Mock;
    findValuesByIds: jest.Mock;
  };
  let collaboratorsRepository: {
    findByModuleAndUser: jest.Mock;
    create: jest.Mock;
  };
  let projectCollaboratorsRepository: {
    findByProjectAndUser: jest.Mock;
  };
  let sequences: { nextDisplayId: jest.Mock };

  beforeEach(() => {
    repository = {
      findById: jest.fn(),
      findByIdGlobal: jest.fn(),
      findVisibleActiveByTenant: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      archive: jest.fn(),
      findAccessiblePageByUser: jest.fn(),
      findRememberedVenueValues: jest.fn(),
      findCurrentlyWithCollaborators: jest.fn(),
      findInvitationById: jest.fn(),
      archiveImpact: jest.fn(),
    };
    projectsRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'project-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        title: 'Test Project',
      }),
    };
    enumRepository = {
      findByCategoryAndValue: jest.fn(),
      findModuleStageByValueForTenant: jest.fn(),
      findValuesByIds: jest.fn().mockResolvedValue(new Map()),
    };
    collaboratorsRepository = {
      findByModuleAndUser: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockResolvedValue({ id: 'collaborator-1' }),
    };
    projectCollaboratorsRepository = {
      findByProjectAndUser: jest.fn().mockResolvedValue(undefined),
    };
    sequences = {
      nextDisplayId: jest.fn().mockResolvedValue('MOD-0001'),
    };
    service = new ProjectModulesService(
      repository as unknown as ProjectModulesRepository,
      enumRepository as unknown as EnumRepository,
      collaboratorsRepository as unknown as ModuleCollaboratorsRepository,
      projectCollaboratorsRepository as unknown as ProjectCollaboratorsRepository,
      projectsRepository as unknown as ProjectsRepository,
      sequences as unknown as TenantSequencesRepository,
    );
  });

  describe('listVenueSuggestions', () => {
    it('deduplicates and sorts remembered paper, project and conference names', async () => {
      repository.findRememberedVenueValues.mockResolvedValue({
        paperValues: [
          {
            targetJournal: 'Nature, Cell',
            backupJournal: 'nature, PLOS ONE',
            targetConference: 'ICML',
            backupConference: 'NeurIPS',
          },
        ],
        projectValues: [{ targetJournals: 'Lancet' }],
        conferenceValues: [
          {
            acronym: 'ICLR',
            name: 'International Conference on Learning Representations',
          },
          { acronym: null, name: 'Research Conference' },
        ],
      });

      await expect(
        service.listVenueSuggestions('tenant-1', 'user-1'),
      ).resolves.toEqual({
        journals: ['Cell', 'Lancet', 'Nature', 'PLOS ONE'],
        conferences: ['ICLR', 'ICML', 'NeurIPS', 'Research Conference'],
      });
    });
  });

  describe('listCurrentlyWithCollaborators', () => {
    it('combines saved and accepted collaborators without including the caller', async () => {
      repository.findCurrentlyWithCollaborators.mockResolvedValue({
        registered: [
          {
            userId: 'user-2',
            email: 'sam@example.com',
            displayName: 'Sam Coauthor',
            affiliation: 'Research Institute',
          },
        ],
        invited: [
          {
            invitationId: 'invite-1',
            email: 'sam@example.com',
            displayName: 'Sam',
            affiliation: null,
          },
          {
            invitationId: 'invite-2',
            email: 'new@example.com',
            displayName: 'New Coauthor',
            affiliation: 'University',
          },
          {
            invitationId: 'invite-self',
            email: 'owner@example.com',
            displayName: 'Owner',
            affiliation: null,
          },
        ],
        callerEmail: 'owner@example.com',
      });

      await expect(
        service.listCurrentlyWithCollaborators('tenant-1', 'user-1'),
      ).resolves.toEqual([
        {
          id: 'invitation:invite-2',
          userIds: [],
          invitationIds: ['invite-2'],
          displayName: 'New Coauthor',
          affiliation: 'University',
        },
        {
          id: 'user:user-2',
          userIds: ['user-2'],
          invitationIds: ['invite-1'],
          displayName: 'Sam Coauthor',
          affiliation: 'Research Institute',
        },
      ]);
      expect(repository.findCurrentlyWithCollaborators).toHaveBeenCalledWith(
        'tenant-1',
        'user-1',
      );
    });
  });

  describe('findOne', () => {
    it('rejects a missing paper', async () => {
      repository.findById.mockResolvedValue(undefined);

      await expect(
        service.findOne('tenant-1', 'module-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects an independent paper without paper membership', async () => {
      repository.findById.mockResolvedValue({
        id: 'module-1',
        projectId: null,
        statusId: null,
      });

      await expect(
        service.findOne('tenant-1', 'module-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('allows an independent paper collaborator', async () => {
      repository.findById.mockResolvedValue({
        id: 'module-1',
        projectId: null,
        statusId: null,
      });
      collaboratorsRepository.findByModuleAndUser.mockResolvedValue({
        roleId: 'role-1',
      });

      await expect(
        service.findOne('tenant-1', 'module-1', 'user-1'),
      ).resolves.toEqual(expect.objectContaining({ id: 'module-1' }));
    });

    it('allows the parent project owner without paper membership', async () => {
      repository.findById.mockResolvedValue({
        id: 'module-1',
        projectId: 'project-1',
        statusId: null,
      });

      await expect(
        service.findOne('tenant-1', 'module-1', 'user-1'),
      ).resolves.toEqual(expect.objectContaining({ id: 'module-1' }));

      expect(projectsRepository.findById).toHaveBeenCalledWith(
        'tenant-1',
        'project-1',
      );
    });

    it('allows a paper collaborator without parent project membership', async () => {
      repository.findById.mockResolvedValue({
        id: 'module-1',
        projectId: 'project-1',
        statusId: null,
      });
      projectsRepository.findById.mockResolvedValue({
        id: 'project-1',
        tenantId: 'tenant-1',
        userId: 'someone-else',
      });
      collaboratorsRepository.findByModuleAndUser.mockResolvedValue({
        roleId: 'role-collaborator',
      });

      await expect(
        service.findOne('tenant-1', 'module-1', 'user-1'),
      ).resolves.toEqual(expect.objectContaining({ id: 'module-1' }));
    });

    it('rejects a project collaborator without paper membership', async () => {
      repository.findById.mockResolvedValue({
        id: 'module-1',
        projectId: 'project-1',
        statusId: null,
      });
      projectsRepository.findById.mockResolvedValue({
        id: 'project-1',
        tenantId: 'tenant-1',
        userId: 'someone-else',
      });
      projectCollaboratorsRepository.findByProjectAndUser.mockResolvedValue({
        roleId: 'role-collaborator',
      });

      await expect(
        service.findOne('tenant-1', 'module-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listForCaller', () => {
    it('returns a paginated list of accessible modules across tenants', async () => {
      repository.findAccessiblePageByUser.mockResolvedValue({
        data: [
          {
            id: 'module-1',
            tenantId: 'tenant-1',
            projectId: 'project-1',
            statusId: null,
            archivedAt: null,
          },
          {
            id: 'module-2',
            tenantId: 'tenant-2',
            projectId: null,
            statusId: null,
            archivedAt: null,
          },
        ],
        totalItems: 45,
      });

      const result = await service.listForCaller('user-1', 2, 20);

      expect(repository.findAccessiblePageByUser).toHaveBeenCalledWith(
        'user-1',
        20,
        20,
      );

      expect(result.data.map((module) => module.id)).toEqual([
        'module-1',
        'module-2',
      ]);

      expect(result.meta).toEqual({
        page: 2,
        pageSize: 20,
        totalItems: 45,
        totalPages: 3,
      });
    });
  });

  describe('findOneForCaller', () => {
    it('resolves the module real tenant and delegates to the access-checked findOne', async () => {
      repository.findByIdGlobal.mockResolvedValue({
        id: 'module-1',
        tenantId: 'tenant-1',
        projectId: null,
      });
      repository.findById.mockResolvedValue({
        id: 'module-1',
        projectId: null,
        statusId: null,
      });
      collaboratorsRepository.findByModuleAndUser.mockResolvedValue({
        roleId: 'role-1',
      });

      const result = await service.findOneForCaller('module-1', 'user-1');

      expect(repository.findById).toHaveBeenCalledWith('tenant-1', 'module-1');
      expect(result).toEqual(expect.objectContaining({ id: 'module-1' }));
    });

    it('throws NotFoundException when the module does not exist in any tenant', async () => {
      repository.findByIdGlobal.mockResolvedValue(undefined);
      await expect(
        service.findOneForCaller('module-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('archiveForCaller', () => {
    it('resolves the module real tenant and delegates to the access-checked archive', async () => {
      repository.findByIdGlobal.mockResolvedValue({
        id: 'module-1',
        tenantId: 'tenant-1',
        projectId: null,
      });
      repository.findById.mockResolvedValue({
        id: 'module-1',
        projectId: null,
        statusId: null,
      });
      collaboratorsRepository.findByModuleAndUser.mockResolvedValue({
        roleId: 'owner-role-id',
      });
      enumRepository.findByCategoryAndValue.mockImplementation(
        (category: string, value: string) =>
          Promise.resolve({
            id:
              category === 'project_role' && value === 'Owner'
                ? 'owner-role-id'
                : 'archived-status-id',
          }),
      );
      repository.archive.mockResolvedValue({
        id: 'module-1',
        statusId: 'archived-status-id',
      });

      await service.archiveForCaller('module-1', 'user-1');

      expect(repository.archive).toHaveBeenCalledWith('tenant-1', 'module-1');
    });

    it('throws NotFoundException when the module does not exist in any tenant', async () => {
      repository.findByIdGlobal.mockResolvedValue(undefined);
      await expect(
        service.archiveForCaller('module-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listActive', () => {
    it('rejects oversized All requests instead of returning a truncated list', async () => {
      repository.findVisibleActiveByTenant.mockResolvedValue({
        data: [],
        totalItems: 5001,
      });
      await expect(
        service.listActive('tenant-1', 'user-1', 1, 'all'),
      ).rejects.toThrow('All is limited');
    });

    it('returns every matching row in one bounded All response', async () => {
      repository.findVisibleActiveByTenant.mockResolvedValue({
        data: [1, 2, 3].map((id) => ({
          id: String(id),
          statusId: null,
          pipelineStageId: null,
          visibilityId: null,
          priorityId: null,
        })),
        totalItems: 3,
      });
      const result = await service.listActive('tenant-1', 'user-1', 7, 'all');
      expect(result.data.map((item) => item.id)).toEqual(['1', '2', '3']);
      expect(result.meta).toEqual({
        page: 1,
        pageSize: 5000,
        totalItems: 3,
        totalPages: 1,
      });
      expect(repository.findVisibleActiveByTenant).toHaveBeenCalledTimes(1);
    });

    it('preserves server summary counts beyond the current page', async () => {
      repository.findVisibleActiveByTenant.mockResolvedValue({
        data: [],
        totalItems: 85,
        summary: { active: 34, review: 25 },
      });
      const result = await service.listActive('tenant-1', 'user-1', 1, 20);
      expect(result.summary).toEqual({ active: 34, review: 25 });
    });

    it('returns a paginated list of visible active modules', async () => {
      repository.findVisibleActiveByTenant.mockResolvedValue({
        data: [
          {
            id: 'module-1',
            projectId: null,
            statusId: null,
          },
          {
            id: 'module-2',
            projectId: 'project-1',
            statusId: null,
          },
        ],
        totalItems: 45,
      });

      const result = await service.listActive(
        'tenant-1',
        'user-1',
        2,
        20,
        'project-1',
      );

      expect(repository.findVisibleActiveByTenant).toHaveBeenCalledWith(
        'tenant-1',
        'user-1',
        20,
        20,
        'project-1',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );

      expect(result.data.map((module) => module.id)).toEqual([
        'module-1',
        'module-2',
      ]);

      expect(result.meta).toEqual({
        page: 2,
        pageSize: 20,
        totalItems: 45,
        totalPages: 3,
      });
    });

    it('passes status, stage and Currently With filters to the repository before pagination', async () => {
      repository.findVisibleActiveByTenant.mockResolvedValue({
        data: [],
        totalItems: 0,
      });

      await service.listActive(
        'tenant-1',
        'user-1',
        1,
        20,
        undefined,
        undefined,
        undefined,
        undefined,
        ['Complete', 'Stalled'],
        ['Literature Review', 'Submitted, Under Review'],
        ['me', 'journal'],
        ['user-2'],
        undefined,
      );

      expect(repository.findVisibleActiveByTenant).toHaveBeenCalledWith(
        'tenant-1',
        'user-1',
        0,
        20,
        undefined,
        undefined,
        undefined,
        undefined,
        ['Complete', 'Stalled'],
        ['Literature Review', 'Submitted, Under Review'],
        ['me', 'journal'],
        ['user-2'],
        undefined,
      );
    });
  });

  describe('create', () => {
    it('defaults a new paper to Currently With Me', async () => {
      enumRepository.findByCategoryAndValue.mockImplementation(
        (category: string, value: string) =>
          Promise.resolve({ id: `${category}-${value}-id` }),
      );
      repository.create.mockResolvedValue({
        id: 'module-1',
        statusId: null,
        pipelineStageId: null,
      });

      await service.create('tenant-1', 'user-1', {
        projectId: 'project-1',
        shortTitle: 'New Paper',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          createdBy: 'user-1',
          currentlyWithType: 'me',
          assignedToUserId: 'user-1',
        }),
      );
    });

    it('creates a paper Currently With a general collaborator/author', async () => {
      enumRepository.findByCategoryAndValue.mockImplementation(
        (category: string, value: string) =>
          Promise.resolve({ id: `${category}-${value}-id` }),
      );
      repository.create.mockResolvedValue({
        id: 'module-1',
        statusId: null,
        pipelineStageId: null,
      });

      await service.create('tenant-1', 'user-1', {
        projectId: 'project-1',
        shortTitle: 'New Paper',
        currentlyWithType: 'collaborator',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          currentlyWithType: 'collaborator',
          assignedToUserId: null,
        }),
      );
    });

    it('keeps the chosen status when created in the submitted-under-review stage', async () => {
      enumRepository.findByCategoryAndValue.mockImplementation(
        (category: string, value: string) =>
          Promise.resolve({ id: `${category}-${value}-id` }),
      );
      enumRepository.findModuleStageByValueForTenant.mockResolvedValue({
        id: 'submitted-stage-id',
        value: 'Submitted, Under Review',
      });
      repository.create.mockResolvedValue({
        id: 'module-1',
        statusId: 'project_status-Active-id',
        pipelineStageId: 'submitted-stage-id',
      });

      await service.create('tenant-1', 'user-1', {
        projectId: 'project-1',
        shortTitle: 'Submitted paper',
        status: 'Active',
        pipelineStage: 'Submitted, Under Review',
      });

      expect(enumRepository.findByCategoryAndValue).not.toHaveBeenCalledWith(
        'project_status',
        'Review',
      );
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          statusId: 'project_status-Active-id',
          pipelineStageId: 'submitted-stage-id',
        }),
      );
    });

    it('stores the retired Review status as Active for papers', async () => {
      enumRepository.findByCategoryAndValue.mockImplementation(
        (category: string, value: string) =>
          Promise.resolve({ id: `${category}-${value}-id` }),
      );
      repository.create.mockResolvedValue({
        id: 'module-1',
        statusId: 'project_status-Active-id',
        pipelineStageId: null,
      });

      await service.create('tenant-1', 'user-1', {
        projectId: 'project-1',
        shortTitle: 'Old client paper',
        status: 'Review',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ statusId: 'project_status-Active-id' }),
      );
    });

    it('stores Journal without a user assignment', async () => {
      enumRepository.findByCategoryAndValue.mockImplementation(
        (category: string, value: string) =>
          Promise.resolve({ id: `${category}-${value}-id` }),
      );
      repository.create.mockResolvedValue({
        id: 'module-1',
        statusId: null,
        pipelineStageId: null,
      });

      await service.create('tenant-1', 'user-1', {
        projectId: 'project-1',
        shortTitle: 'New Paper',
        currentlyWithType: 'journal',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          currentlyWithType: 'journal',
          assignedToUserId: null,
        }),
      );
    });

    it('rejects creating a paper for a project that does not exist', async () => {
      projectsRepository.findById.mockResolvedValue(undefined);

      await expect(
        service.create('tenant-1', 'user-1', {
          projectId: 'missing-project',
          shortTitle: 'New Paper',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(projectsRepository.findById).toHaveBeenCalledWith(
        'tenant-1',
        'missing-project',
      );

      expect(repository.create).not.toHaveBeenCalled();
    });

    it("rejects creating a paper under another user's project", async () => {
      projectsRepository.findById.mockResolvedValue({
        id: 'project-1',
        tenantId: 'tenant-1',
        userId: 'different-owner',
        title: 'Someone Else Project',
      });

      await expect(
        service.create('tenant-1', 'user-1', {
          projectId: 'project-1',
          shortTitle: 'New Paper',
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejects removing the project from a paper', async () => {
      repository.findById.mockResolvedValue({
        id: 'module-1',
        projectId: 'project-1',
        statusId: null,
      });

      collaboratorsRepository.findByModuleAndUser.mockResolvedValue({
        roleId: 'role-owner',
      });

      await expect(
        service.update('tenant-1', 'module-1', 'user-1', {
          projectId: null as unknown as string,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(repository.update).not.toHaveBeenCalled();
    });

    it('resolves status to its enum id', async () => {
      enumRepository.findByCategoryAndValue.mockImplementation(
        (category: string, value: string) =>
          Promise.resolve({ id: `${category}-${value}-id` }),
      );
      repository.create.mockResolvedValue({
        id: 'module-1',
        statusId: 'project_status-Active-id',
      });

      await service.create('tenant-1', 'user-1', {
        projectId: 'project-1',
        shortTitle: 'New Module',
        title: 'New Module',
        status: 'Active',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          statusId: 'project_status-Active-id',
        }),
      );
    });

    it('resolves paper priority to its enum id', async () => {
      enumRepository.findByCategoryAndValue.mockImplementation(
        (category: string, value: string) =>
          Promise.resolve({ id: `${category}-${value}-id` }),
      );
      repository.create.mockResolvedValue({
        id: 'module-1',
        statusId: null,
        priorityId: 'importance-Critical-id',
        pipelineStageId: null,
      });

      await service.create('tenant-1', 'user-1', {
        projectId: 'project-1',
        shortTitle: 'Priority paper',
        priority: 'Critical',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          priorityId: 'importance-Critical-id',
        }),
      );
    });

    it('passes through the target/backup journal and conference fields', async () => {
      enumRepository.findByCategoryAndValue.mockImplementation(
        (category: string, value: string) =>
          category === 'project_role' && value === 'Owner'
            ? Promise.resolve({ id: 'owner-role-id' })
            : Promise.resolve(undefined),
      );
      repository.create.mockResolvedValue({
        id: 'module-1',
        statusId: null,
      });

      await service.create('tenant-1', 'user-1', {
        projectId: 'project-1',
        shortTitle: 'New Module',
        targetJournal: 'Nature Communications',
        backupJournal: 'Scientific Reports',
        targetConference: 'ICML',
        backupConference: 'NeurIPS Workshop',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          targetJournal: 'Nature Communications',
          backupJournal: 'Scientific Reports',
          targetConference: 'ICML',
          backupConference: 'NeurIPS Workshop',
        }),
      );
    });

    it("resolves the pipeline stage against the tenant's shared stage list", async () => {
      enumRepository.findByCategoryAndValue.mockImplementation(
        (category: string, value: string) =>
          Promise.resolve({ id: `${category}-${value}-id` }),
      );
      enumRepository.findModuleStageByValueForTenant.mockResolvedValue({
        id: 'tenant-stage-drafting',
        value: 'Drafting & Writing',
      });
      repository.create.mockResolvedValue({
        id: 'module-1',
        statusId: null,
        pipelineStageId: 'tenant-stage-drafting',
      });

      await service.create('tenant-1', 'user-1', {
        projectId: 'project-1',
        shortTitle: 'Paper in progress',
        pipelineStage: 'Drafting & Writing',
      });

      expect(
        enumRepository.findModuleStageByValueForTenant,
      ).toHaveBeenCalledWith('tenant-1', 'Drafting & Writing');
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ pipelineStageId: 'tenant-stage-drafting' }),
      );
    });

    it('always records pipelineStageChangedAt at creation time', async () => {
      enumRepository.findByCategoryAndValue.mockImplementation(
        (category: string, value: string) =>
          Promise.resolve({ id: `${category}-${value}-id` }),
      );
      repository.create.mockResolvedValue({
        id: 'module-1',
        statusId: null,
        pipelineStageId: null,
      });

      await service.create('tenant-1', 'user-1', {
        projectId: 'project-1',
        shortTitle: 'New Module',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ pipelineStageChangedAt: expect.any(Date) }),
      );
    });

    it('throws NotFoundException for an unknown pipeline stage', async () => {
      enumRepository.findByCategoryAndValue.mockImplementation(
        (category: string, value: string) =>
          Promise.resolve({ id: `${category}-${value}-id` }),
      );
      enumRepository.findModuleStageByValueForTenant.mockResolvedValue(
        undefined,
      );

      await expect(
        service.create('tenant-1', 'user-1', {
          projectId: 'project-1',
          shortTitle: 'Paper in progress',
          pipelineStage: 'Not A Real Stage',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('adds a collaborator for a project-scoped module too', async () => {
      enumRepository.findByCategoryAndValue.mockImplementation(
        (category: string, value: string) =>
          Promise.resolve({ id: `${category}-${value}-id` }),
      );
      repository.create.mockResolvedValue({
        id: 'module-1',
        statusId: null,
      });
      await service.create('tenant-1', 'user-1', {
        shortTitle: 'Project module',
        projectId: 'project-1',
      });

      expect(collaboratorsRepository.create).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        moduleId: 'module-1',
        userId: 'user-1',
        roleId: 'project_role-Owner-id',
      });
    });
  });

  describe('update', () => {
    it.each([
      {
        label: 'sets a new due date',
        dueDate: '2026-11-20',
      },
      {
        label: 'clears the due date',
        dueDate: null,
      },
      {
        label: 'leaves the due date unchanged when omitted',
        dueDate: undefined,
      },
    ])('$label', async ({ dueDate }) => {
      const existing = {
        id: 'module-1',
        projectId: null,
        statusId: null,
        priorityId: null,
        pipelineStageId: null,
        dueDate: '2026-09-15',
      };

      repository.findById.mockResolvedValue(existing);
      collaboratorsRepository.findByModuleAndUser.mockResolvedValue({
        roleId: 'owner-role-id',
      });
      repository.update.mockResolvedValue({
        ...existing,
        dueDate: dueDate === undefined ? existing.dueDate : dueDate,
      });

      await service.update(
        'tenant-1',
        'module-1',
        'user-1',
        dueDate === undefined ? {} : { dueDate },
      );

      expect(repository.update).toHaveBeenCalledWith(
        'tenant-1',
        'module-1',
        expect.objectContaining({ dueDate }),
      );
    });

    it('assigns Currently With to a collaborator already on the paper', async () => {
      repository.findById.mockResolvedValue({
        id: 'module-1',
        projectId: null,
        statusId: null,
        pipelineStageId: null,
        assignedToUserId: 'user-1',
      });
      collaboratorsRepository.findByModuleAndUser
        .mockResolvedValueOnce({ roleId: 'owner-role-id' })
        .mockResolvedValueOnce({ roleId: 'editor-role-id' });
      repository.update.mockResolvedValue({
        id: 'module-1',
        statusId: null,
        pipelineStageId: null,
      });

      await service.update('tenant-1', 'module-1', 'user-1', {
        currentlyWithType: 'collaborator',
        assignedToUserId: 'user-2',
      });

      expect(repository.update).toHaveBeenCalledWith(
        'tenant-1',
        'module-1',
        expect.objectContaining({
          currentlyWithType: 'collaborator',
          assignedToUserId: 'user-2',
        }),
      );
    });

    it('keeps the chosen status when entering the submitted-under-review stage', async () => {
      repository.findById.mockResolvedValue({
        id: 'module-1',
        projectId: null,
        statusId: 'active-status-id',
        pipelineStageId: 'drafting-stage-id',
        pipelineStage: 'Drafting & Writing',
      });
      collaboratorsRepository.findByModuleAndUser.mockResolvedValue({
        roleId: 'owner-role-id',
      });
      enumRepository.findByCategoryAndValue.mockImplementation(
        (category: string, value: string) =>
          Promise.resolve({ id: `${category}-${value}-id` }),
      );
      enumRepository.findModuleStageByValueForTenant.mockResolvedValue({
        id: 'submitted-stage-id',
        value: 'Submitted, Under Review',
      });
      repository.update.mockResolvedValue({
        id: 'module-1',
        statusId: 'project_status-Active-id',
        pipelineStageId: 'submitted-stage-id',
      });

      await service.update('tenant-1', 'module-1', 'user-1', {
        status: 'Active',
        pipelineStage: 'Submitted, Under Review',
      });

      expect(enumRepository.findByCategoryAndValue).not.toHaveBeenCalledWith(
        'project_status',
        'Review',
      );
      expect(repository.update).toHaveBeenCalledWith(
        'tenant-1',
        'module-1',
        expect.objectContaining({
          statusId: 'project_status-Active-id',
          pipelineStageId: 'submitted-stage-id',
          pipelineStageChangedAt: expect.any(Date),
        }),
      );
    });
    it('sets Currently With to a general collaborator/author without a specific person', async () => {
      repository.findById.mockResolvedValue({
        id: 'module-1',
        projectId: null,
        statusId: null,
        priorityId: null,
        pipelineStageId: null,
        assignedToUserId: 'user-2',
        assignedToInvitationId: null,
      });
      collaboratorsRepository.findByModuleAndUser.mockResolvedValueOnce({
        roleId: 'owner-role-id',
      });
      repository.update.mockResolvedValue({
        id: 'module-1',
        statusId: null,
        priorityId: null,
        pipelineStageId: null,
      });

      await service.update('tenant-1', 'module-1', 'user-1', {
        currentlyWithType: 'collaborator',
        assignedToUserId: null,
        assignedToInvitationId: null,
      });

      expect(repository.update).toHaveBeenCalledWith(
        'tenant-1',
        'module-1',
        expect.objectContaining({
          currentlyWithType: 'collaborator',
          assignedToUserId: null,
          assignedToInvitationId: null,
        }),
      );
    });

    it('rejects a Currently With collaborator who is not on the paper', async () => {
      repository.findById.mockResolvedValue({
        id: 'module-1',
        projectId: null,
        statusId: null,
        pipelineStageId: null,
        assignedToUserId: 'user-1',
      });
      collaboratorsRepository.findByModuleAndUser
        .mockResolvedValueOnce({ roleId: 'owner-role-id' })
        .mockResolvedValueOnce(undefined);

      await expect(
        service.update('tenant-1', 'module-1', 'user-1', {
          currentlyWithType: 'collaborator',
          assignedToUserId: 'user-3',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(repository.update).not.toHaveBeenCalled();
    });

    it('assigns Currently With to a saved collaborator contact', async () => {
      repository.findById.mockResolvedValue({
        id: 'module-1',
        projectId: null,
        statusId: null,
        priorityId: null,
        pipelineStageId: null,
        assignedToUserId: 'user-1',
        assignedToInvitationId: null,
      });
      collaboratorsRepository.findByModuleAndUser.mockResolvedValueOnce({
        roleId: 'owner-role-id',
      });
      repository.findInvitationById.mockResolvedValue({ id: 'invite-1' });
      repository.update.mockResolvedValue({
        id: 'module-1',
        statusId: null,
        priorityId: null,
        pipelineStageId: null,
      });

      await service.update('tenant-1', 'module-1', 'user-1', {
        currentlyWithType: 'collaborator',
        assignedToUserId: null,
        assignedToInvitationId: 'invite-1',
      });

      expect(repository.findInvitationById).toHaveBeenCalledWith(
        'module-1',
        'invite-1',
      );
      expect(repository.update).toHaveBeenCalledWith(
        'tenant-1',
        'module-1',
        expect.objectContaining({
          currentlyWithType: 'collaborator',
          assignedToUserId: null,
          assignedToInvitationId: 'invite-1',
        }),
      );
    });

    it('clears the user assignment for Friendly reviewer', async () => {
      repository.findById.mockResolvedValue({
        id: 'module-1',
        projectId: null,
        statusId: null,
        pipelineStageId: null,
        assignedToUserId: 'user-2',
      });
      collaboratorsRepository.findByModuleAndUser.mockResolvedValue({
        roleId: 'owner-role-id',
      });
      repository.update.mockResolvedValue({
        id: 'module-1',
        statusId: null,
        pipelineStageId: null,
      });

      await service.update('tenant-1', 'module-1', 'user-1', {
        currentlyWithType: 'friendly_reviewer',
      });

      expect(repository.update).toHaveBeenCalledWith(
        'tenant-1',
        'module-1',
        expect.objectContaining({
          currentlyWithType: 'friendly_reviewer',
          assignedToUserId: null,
        }),
      );
    });

    it('stores Others without a collaborator assignment', async () => {
      repository.findById.mockResolvedValue({
        id: 'module-1',
        projectId: null,
        statusId: null,
        priorityId: null,
        pipelineStageId: null,
        assignedToUserId: 'user-2',
        assignedToInvitationId: null,
      });
      collaboratorsRepository.findByModuleAndUser.mockResolvedValue({
        roleId: 'owner-role-id',
      });
      repository.update.mockResolvedValue({
        id: 'module-1',
        statusId: null,
        priorityId: null,
        pipelineStageId: null,
      });

      await service.update('tenant-1', 'module-1', 'user-1', {
        currentlyWithType: 'others',
      });

      expect(repository.update).toHaveBeenCalledWith(
        'tenant-1',
        'module-1',
        expect.objectContaining({
          currentlyWithType: 'others',
          assignedToUserId: null,
          assignedToInvitationId: null,
        }),
      );
    });

    it("rejects moving a paper into another user's project", async () => {
      repository.findById.mockResolvedValue({
        id: 'module-1',
        projectId: 'project-1',
        statusId: null,
      });

      collaboratorsRepository.findByModuleAndUser.mockResolvedValue({
        roleId: 'role-owner',
      });

      projectsRepository.findById.mockResolvedValue({
        id: 'project-2',
        tenantId: 'tenant-1',
        userId: 'different-owner',
        title: 'Another User Project',
      });

      await expect(
        service.update('tenant-1', 'module-1', 'user-1', {
          projectId: 'project-2',
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(projectsRepository.findById).toHaveBeenCalledWith(
        'tenant-1',
        'project-2',
      );
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('passes through the target/backup journal and conference fields', async () => {
      repository.findById.mockResolvedValue({
        id: 'module-1',
        projectId: null,
        statusId: null,
      });
      collaboratorsRepository.findByModuleAndUser.mockResolvedValue({
        roleId: 'role-1',
      });
      repository.update.mockResolvedValue({
        id: 'module-1',
        statusId: null,
      });

      await service.update('tenant-1', 'module-1', 'user-1', {
        targetJournal: 'Nature Communications',
        backupJournal: 'Scientific Reports',
        targetConference: 'ICML',
        backupConference: 'NeurIPS Workshop',
      });

      expect(repository.update).toHaveBeenCalledWith(
        'tenant-1',
        'module-1',
        expect.objectContaining({
          targetJournal: 'Nature Communications',
          backupJournal: 'Scientific Reports',
          targetConference: 'ICML',
          backupConference: 'NeurIPS Workshop',
        }),
      );
    });

    it('links an independent module to a project', async () => {
      repository.findById.mockResolvedValue({
        id: 'module-1',
        projectId: null,
        statusId: null,
      });
      collaboratorsRepository.findByModuleAndUser.mockResolvedValue({
        roleId: 'role-1',
      });
      repository.update.mockResolvedValue({
        id: 'module-1',
        projectId: 'project-2',
        statusId: null,
      });

      await service.update('tenant-1', 'module-1', 'user-1', {
        projectId: 'project-2',
      });

      expect(repository.update).toHaveBeenCalledWith(
        'tenant-1',
        'module-1',
        expect.objectContaining({ projectId: 'project-2' }),
      );
    });

    it('moves an independent paper into the General project', async () => {
      repository.findById.mockResolvedValue({
        id: 'module-1',
        projectId: 'project-1',
        statusId: null,
      });

      projectCollaboratorsRepository.findByProjectAndUser.mockResolvedValue({
        roleId: 'role-1',
      });

      projectsRepository.findById.mockResolvedValue({
        id: 'project-general',
        tenantId: 'tenant-1',
        userId: 'user-1',
        title: 'General',
      });

      repository.update.mockResolvedValue({
        id: 'module-1',
        projectId: 'project-general',
        statusId: null,
      });

      await service.update('tenant-1', 'module-1', 'user-1', {
        projectId: 'project-general',
      });

      expect(projectsRepository.findById).toHaveBeenCalledWith(
        'tenant-1',
        'project-general',
      );

      expect(repository.update).toHaveBeenCalledWith(
        'tenant-1',
        'module-1',
        expect.objectContaining({
          projectId: 'project-general',
        }),
      );
    });

    it('leaves the project link untouched when projectId is omitted', async () => {
      repository.findById.mockResolvedValue({
        id: 'module-1',
        projectId: 'project-1',
        statusId: null,
      });
      projectCollaboratorsRepository.findByProjectAndUser.mockResolvedValue({
        roleId: 'role-1',
      });
      repository.update.mockResolvedValue({
        id: 'module-1',
        projectId: 'project-1',
        statusId: null,
      });

      await service.update('tenant-1', 'module-1', 'user-1', {
        title: 'Renamed module',
      });

      expect(repository.update).toHaveBeenCalledWith(
        'tenant-1',
        'module-1',
        expect.objectContaining({ projectId: undefined }),
      );
    });

    it('records pipelineStageChangedAt when the pipeline stage actually changes', async () => {
      repository.findById.mockResolvedValue({
        id: 'module-1',
        projectId: null,
        statusId: null,
        pipelineStageId: 'stage-concept-id',
      });
      collaboratorsRepository.findByModuleAndUser.mockResolvedValue({
        roleId: 'role-1',
      });
      enumRepository.findValuesByIds.mockResolvedValue(
        new Map([['stage-concept-id', 'Concept, Ideation']]),
      );
      enumRepository.findModuleStageByValueForTenant.mockResolvedValue({
        id: 'stage-drafting-id',
        value: 'Drafting & Writing',
      });
      repository.update.mockResolvedValue({
        id: 'module-1',
        projectId: null,
        statusId: null,
        pipelineStageId: 'stage-drafting-id',
      });

      await service.update('tenant-1', 'module-1', 'user-1', {
        pipelineStage: 'Drafting & Writing',
      });

      expect(repository.update).toHaveBeenCalledWith(
        'tenant-1',
        'module-1',
        expect.objectContaining({ pipelineStageChangedAt: expect.any(Date) }),
      );
    });

    it('does not touch pipelineStageChangedAt when the pipeline stage is re-submitted unchanged', async () => {
      repository.findById.mockResolvedValue({
        id: 'module-1',
        projectId: null,
        statusId: null,
        pipelineStageId: 'stage-concept-id',
      });
      collaboratorsRepository.findByModuleAndUser.mockResolvedValue({
        roleId: 'role-1',
      });
      enumRepository.findValuesByIds.mockResolvedValue(
        new Map([['stage-concept-id', 'Concept, Ideation']]),
      );
      enumRepository.findModuleStageByValueForTenant.mockResolvedValue({
        id: 'stage-concept-id',
        value: 'Concept, Ideation',
      });
      repository.update.mockResolvedValue({
        id: 'module-1',
        projectId: null,
        statusId: null,
        pipelineStageId: 'stage-concept-id',
      });

      await service.update('tenant-1', 'module-1', 'user-1', {
        pipelineStage: 'Concept, Ideation',
      });

      expect(repository.update).toHaveBeenCalledWith(
        'tenant-1',
        'module-1',
        expect.objectContaining({ pipelineStageChangedAt: undefined }),
      );
    });

    it('does not touch pipelineStageChangedAt when the pipeline stage is omitted', async () => {
      repository.findById.mockResolvedValue({
        id: 'module-1',
        projectId: 'project-1',
        statusId: null,
      });
      projectCollaboratorsRepository.findByProjectAndUser.mockResolvedValue({
        roleId: 'role-1',
      });
      repository.update.mockResolvedValue({
        id: 'module-1',
        projectId: 'project-1',
        statusId: null,
      });

      await service.update('tenant-1', 'module-1', 'user-1', {
        title: 'Renamed module',
      });

      expect(repository.update).toHaveBeenCalledWith(
        'tenant-1',
        'module-1',
        expect.objectContaining({ pipelineStageChangedAt: undefined }),
      );
    });
  });

  describe('paper archive options', () => {
    beforeEach(() => {
      repository.findById.mockImplementation(
        (_tenantId: string, moduleId: string) =>
          Promise.resolve({
            id: moduleId,
            tenantId: 'tenant-1',
            projectId: null,
            archivedAt: null,
            statusId: null,
            priorityId: null,
            pipelineStageId: null,
          }),
      );

      repository.findByIdGlobal.mockResolvedValue({
        id: 'module-1',
        tenantId: 'tenant-1',
      });

      collaboratorsRepository.findByModuleAndUser.mockResolvedValue({
        roleId: 'owner-role-id',
      });

      enumRepository.findByCategoryAndValue.mockResolvedValue({
        id: 'owner-role-id',
      });

      repository.archive.mockResolvedValue({
        id: 'module-1',
        statusId: null,
        priorityId: null,
        pipelineStageId: null,
      });

      repository.archiveImpact.mockResolvedValue({
        tasks: 3,
        notes: 2,
      });
    });

    it('returns linked-work counts for the paper owner', async () => {
      await expect(
        service.archiveImpact('tenant-1', 'module-1', 'user-1'),
      ).resolves.toEqual({ tasks: 3, notes: 2 });

      expect(repository.archiveImpact).toHaveBeenCalledWith(
        'tenant-1',
        'module-1',
      );
    });

    it('rejects impact requests from non-owners', async () => {
      collaboratorsRepository.findByModuleAndUser.mockResolvedValue({
        roleId: 'editor-role-id',
      });

      await expect(
        service.archiveImpact('tenant-1', 'module-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);

      expect(repository.archiveImpact).not.toHaveBeenCalled();
    });

    it('moves linked work to another owned paper through one archive operation', async () => {
      await service.archive('tenant-1', 'module-1', 'user-1', {
        mode: 'move_contents',
        destinationModuleId: 'module-2',
      });

      expect(repository.archive).toHaveBeenCalledTimes(1);
      expect(repository.archive).toHaveBeenCalledWith(
        'tenant-1',
        'module-1',
        'module-2',
      );
    });

    it('rejects archiving by a non-owner', async () => {
      collaboratorsRepository.findByModuleAndUser.mockResolvedValue({
        roleId: 'editor-role-id',
      });

      await expect(
        service.archive('tenant-1', 'module-1', 'user-1', {
          mode: 'archive_contents',
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(repository.archive).not.toHaveBeenCalled();
    });

    it.each([undefined, 'module-1'])(
      'rejects a missing or identical destination: %s',
      async (destinationModuleId) => {
        await expect(
          service.archive('tenant-1', 'module-1', 'user-1', {
            mode: 'move_contents',
            destinationModuleId,
          }),
        ).rejects.toThrow(BadRequestException);

        expect(repository.archive).not.toHaveBeenCalled();
      },
    );

    it('rejects a destination the caller does not own', async () => {
      collaboratorsRepository.findByModuleAndUser.mockImplementation(
        (_tenantId: string, moduleId: string) =>
          Promise.resolve({
            roleId:
              moduleId === 'module-1' ? 'owner-role-id' : 'editor-role-id',
          }),
      );

      await expect(
        service.archive('tenant-1', 'module-1', 'user-1', {
          mode: 'move_contents',
          destinationModuleId: 'module-2',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(repository.archive).not.toHaveBeenCalled();
    });

    it.each([
      undefined,
      {
        id: 'module-2',
        projectId: null,
        archivedAt: new Date(),
      },
    ])('rejects an unavailable destination: %j', async (destination) => {
      repository.findById.mockResolvedValueOnce({
        id: 'module-1',
        projectId: null,
        archivedAt: null,
      });
      repository.findById.mockResolvedValueOnce(destination);

      await expect(
        service.archive('tenant-1', 'module-1', 'user-1', {
          mode: 'move_contents',
          destinationModuleId: 'module-2',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(repository.archive).not.toHaveBeenCalled();
    });

    it('rejects a destination whose parent project is unavailable', async () => {
      repository.findById.mockResolvedValueOnce({
        id: 'module-1',
        projectId: null,
      });
      repository.findById.mockResolvedValueOnce({
        id: 'module-2',
        projectId: 'archived-project',
        archivedAt: null,
      });
      projectsRepository.findById.mockResolvedValue(undefined);

      await expect(
        service.archive('tenant-1', 'module-1', 'user-1', {
          mode: 'move_contents',
          destinationModuleId: 'module-2',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(repository.archive).not.toHaveBeenCalled();
    });

    it('resolves the real tenant for caller-scoped archive options', async () => {
      await service.archiveForCallerWithOptions('module-1', 'user-1', {
        mode: 'move_contents',
        destinationModuleId: 'module-2',
      });

      expect(repository.findByIdGlobal).toHaveBeenCalledWith('module-1');
      expect(repository.archive).toHaveBeenCalledWith(
        'tenant-1',
        'module-1',
        'module-2',
      );
    });

    it('resolves the real tenant for caller-scoped impact', async () => {
      await expect(
        service.archiveImpactForCaller('module-1', 'user-1'),
      ).resolves.toEqual({ tasks: 3, notes: 2 });

      expect(repository.archiveImpact).toHaveBeenCalledWith(
        'tenant-1',
        'module-1',
      );
    });

    it('translates wrapped database destination errors', async () => {
      repository.archive.mockRejectedValue({
        cause: {
          code: '22023',
          message: 'Choose another active paper that you own',
        },
      });

      await expect(
        service.archive('tenant-1', 'module-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('translates wrapped database permission errors', async () => {
      repository.archive.mockRejectedValue({
        cause: { code: '42501' },
      });

      await expect(
        service.archive('tenant-1', 'module-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('archive', () => {
    it('archives without overwriting status and returns a warning', async () => {
      repository.findById.mockResolvedValue({
        id: 'module-1',
        projectId: null,
        statusId: 'stalled-status-id',
      });
      collaboratorsRepository.findByModuleAndUser.mockResolvedValue({
        roleId: 'owner-role-id',
      });
      enumRepository.findByCategoryAndValue.mockImplementation(
        (category: string, value: string) =>
          Promise.resolve({
            id:
              category === 'project_role' && value === 'Owner'
                ? 'owner-role-id'
                : 'unexpected-status-id',
          }),
      );
      repository.archive.mockResolvedValue({
        id: 'module-1',
        statusId: 'stalled-status-id',
      });

      const result = await service.archive('tenant-1', 'module-1', 'user-1');

      expect(repository.archive).toHaveBeenCalledWith('tenant-1', 'module-1');
      expect(enumRepository.findByCategoryAndValue).toHaveBeenCalledTimes(1);
      expect(result.warning).toContain('14 days');
    });

    it('throws NotFoundException if the module does not exist', async () => {
      repository.findById.mockResolvedValue(undefined);
      await expect(
        service.archive('tenant-1', 'module-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
