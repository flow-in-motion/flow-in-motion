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
    service = new ProjectModulesService(
      repository as unknown as ProjectModulesRepository,
      enumRepository as unknown as EnumRepository,
      collaboratorsRepository as unknown as ModuleCollaboratorsRepository,
      projectCollaboratorsRepository as unknown as ProjectCollaboratorsRepository,
      projectsRepository as unknown as ProjectsRepository,
      sequences as unknown as TenantSequencesRepository,
    );
    sequences = {
      nextDisplayId: jest.fn().mockResolvedValue('MOD-0001'),
    };
  });

  describe('findOne', () => {
    it('throws NotFoundException when the module does not exist', async () => {
      repository.findById.mockResolvedValue(undefined);
      await expect(
        service.findOne('tenant-1', 'module-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the caller cannot access an independent module', async () => {
      repository.findById.mockResolvedValue({
        id: 'module-1',
        projectId: null,
        statusId: null,
      });
      await expect(
        service.findOne('tenant-1', 'module-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns an independent module when the caller is a module collaborator', async () => {
      repository.findById.mockResolvedValue({
        id: 'module-1',
        projectId: null,
        statusId: null,
      });
      collaboratorsRepository.findByModuleAndUser.mockResolvedValue({
        roleId: 'role-1',
      });
      const result = await service.findOne('tenant-1', 'module-1', 'user-1');
      expect(result).toEqual(expect.objectContaining({ id: 'module-1' }));
    });

    it('returns a project-scoped module when the caller can see the parent project', async () => {
      repository.findById.mockResolvedValue({
        id: 'module-1',
        projectId: 'project-1',
        statusId: null,
      });
      projectCollaboratorsRepository.findByProjectAndUser.mockResolvedValue({
        roleId: 'role-1',
      });
      const result = await service.findOne('tenant-1', 'module-1', 'user-1');
      expect(result).toEqual(expect.objectContaining({ id: 'module-1' }));
      expect(
        collaboratorsRepository.findByModuleAndUser,
      ).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for a project-scoped module when the caller cannot see the parent project', async () => {
      repository.findById.mockResolvedValue({
        id: 'module-1',
        projectId: 'project-1',
        statusId: null,
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

      expect(repository.archive).toHaveBeenCalledWith(
        'tenant-1',
        'module-1',
        'archived-status-id',
      );
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
      repository.findVisibleActiveByTenant.mockResolvedValue({ data: [], totalItems: 5001 });
      await expect(service.listActive('tenant-1', 'user-1', 1, 'all')).rejects.toThrow('All is limited');
    });

    it('returns every matching row in one bounded All response', async () => {
      repository.findVisibleActiveByTenant.mockResolvedValue({ data: [1, 2, 3].map((id) => ({ id: String(id), statusId: null, pipelineStageId: null, visibilityId: null, priorityId: null })), totalItems: 3 });
      const result = await service.listActive('tenant-1', 'user-1', 7, 'all');
      expect(result.data.map((item) => item.id)).toEqual(['1', '2', '3']);
      expect(result.meta).toEqual({ page: 1, pageSize: 5000, totalItems: 3, totalPages: 1 });
      expect(repository.findVisibleActiveByTenant).toHaveBeenCalledTimes(1);
    });

    it('preserves server summary counts beyond the current page', async () => {
      repository.findVisibleActiveByTenant.mockResolvedValue({ data: [], totalItems: 85, summary: { active: 34, review: 25 } });
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

  describe('create', () => {
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

      projectCollaboratorsRepository.findByProjectAndUser.mockResolvedValue({
        roleId: 'role-1',
      });

      await expect(
        service.update('tenant-1', 'module-1', 'user-1', {
          projectId: null as unknown as string,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(projectsRepository.findById).not.toHaveBeenCalled();
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
    it("rejects moving a paper into another user's project", async () => {
      repository.findById.mockResolvedValue({
        id: 'module-1',
        projectId: 'project-1',
        statusId: null,
      });

      projectCollaboratorsRepository.findByProjectAndUser.mockResolvedValue({
        roleId: 'role-1',
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

  describe('archive', () => {
    it('resolves the Archived status and sets archivedAt, returning a warning', async () => {
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

      const result = await service.archive('tenant-1', 'module-1', 'user-1');

      expect(repository.archive).toHaveBeenCalledWith(
        'tenant-1',
        'module-1',
        'archived-status-id',
      );
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
