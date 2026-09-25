import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsRepository } from '../repositories/projects.repository';
import { EnumRepository } from '../../enum/repositories/enum.repository';
import { ProjectCollaboratorsRepository } from '../../project-collaborators/repositories/project-collaborators.repository';
import { TenantSequencesRepository } from '../../tenant-sequences/repositories/tenant-sequences.repository';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let repository: {
    findById: jest.Mock;
    findByIdGlobal: jest.Mock;
    findGeneralByTenant: jest.Mock;
    findActiveByTenant: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    archive: jest.Mock;
    archiveImpact: jest.Mock;
    findArchivedByTenant: jest.Mock;
    moveContentsToProject: jest.Mock;
    restore: jest.Mock;
    permanentlyDelete: jest.Mock;
    findAccessiblePageByUser: jest.Mock;
  };
  let enumRepository: {
    findByCategoryAndValue: jest.Mock;
    findValuesByIds: jest.Mock;
  };
  let collaboratorsRepository: {
    findByProjectAndUser: jest.Mock;
    findByProjectIdsAndUser: jest.Mock;
  };
  let sequences: { nextDisplayId: jest.Mock };

  beforeEach(() => {
    repository = {
      findById: jest.fn(),
      findByIdGlobal: jest.fn(),
      findGeneralByTenant: jest.fn().mockResolvedValue(undefined),
      findActiveByTenant: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      archive: jest.fn(),
      archiveImpact: jest.fn(),
      findArchivedByTenant: jest.fn(),
      moveContentsToProject: jest.fn(),
      restore: jest.fn(),
      permanentlyDelete: jest.fn(),
      findAccessiblePageByUser: jest.fn(),
    };
    enumRepository = {
      findByCategoryAndValue: jest.fn(),
      findValuesByIds: jest
        .fn()
        .mockImplementation((ids: string[]) =>
          Promise.resolve(new Map(ids.map((id) => [id, id]))),
        ),
    };
    collaboratorsRepository = {
      findByProjectAndUser: jest.fn().mockResolvedValue(undefined),
      findByProjectIdsAndUser: jest.fn().mockResolvedValue(new Map()),
    };
    sequences = {
      nextDisplayId: jest.fn().mockResolvedValue('PRJ-0001'),
    };

    service = new ProjectsService(
      repository as unknown as ProjectsRepository,
      enumRepository as unknown as EnumRepository,
      collaboratorsRepository as unknown as ProjectCollaboratorsRepository,
      sequences as unknown as TenantSequencesRepository,
    );
  });

  describe('findOne', () => {
    it('throws NotFoundException when the project does not exist', async () => {
      repository.findById.mockResolvedValue(undefined);
      await expect(
        service.findOne('tenant-1', 'project-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns the project when the caller is a collaborator', async () => {
      repository.findById.mockResolvedValue({
        id: 'project-1',
        title: 'Test',
        userId: 'owner-1',
        statusId: null,
        importanceId: null,
      });
      collaboratorsRepository.findByProjectIdsAndUser.mockResolvedValue(
        new Map([['project-1', { roleId: 'role-collaborator' }]]),
      );
      const result = await service.findOne('tenant-1', 'project-1', 'user-1');
      expect(result).toEqual(
        expect.objectContaining({ id: 'project-1', title: 'Test' }),
      );
    });

    it('returns the project when the caller is the owner, even without an explicit collaborator row', async () => {
      repository.findById.mockResolvedValue({
        id: 'project-1',
        title: 'Test',
        userId: 'user-1',
        statusId: null,
        importanceId: null,
      });
      const result = await service.findOne('tenant-1', 'project-1', 'user-1');
      expect(result).toEqual(
        expect.objectContaining({ id: 'project-1', title: 'Test' }),
      );
    });

    it('throws NotFoundException when the caller is neither the owner nor a collaborator', async () => {
      repository.findById.mockResolvedValue({
        id: 'project-1',
        title: 'Test',
        userId: 'owner-1',
        statusId: null,
        importanceId: null,
      });
      await expect(
        service.findOne('tenant-1', 'project-1', 'outsider-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listForCaller', () => {
    it('returns a paginated list of accessible projects across tenants', async () => {
      repository.findAccessiblePageByUser.mockResolvedValue({
        data: [
          {
            id: 'project-1',
            tenantId: 'tenant-1',
            title: 'Owned here',
            userId: 'user-1',
            statusId: null,
            importanceId: null,
            archivedAt: null,
          },
          {
            id: 'project-2',
            tenantId: 'tenant-2',
            title: 'Collaborating elsewhere',
            userId: 'owner-2',
            statusId: null,
            importanceId: null,
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

      expect(result.data.map((project) => project.id)).toEqual([
        'project-1',
        'project-2',
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
    it('resolves the project real tenant and delegates to the access-checked findOne', async () => {
      repository.findByIdGlobal.mockResolvedValue({
        id: 'project-1',
        tenantId: 'tenant-1',
        userId: 'owner-1',
      });
      repository.findById.mockResolvedValue({
        id: 'project-1',
        title: 'Test',
        userId: 'owner-1',
        statusId: null,
        importanceId: null,
      });
      collaboratorsRepository.findByProjectIdsAndUser.mockResolvedValue(
        new Map([['project-1', { roleId: 'role-collaborator' }]]),
      );

      const result = await service.findOneForCaller('project-1', 'user-1');

      expect(repository.findById).toHaveBeenCalledWith('tenant-1', 'project-1');
      expect(result).toEqual(expect.objectContaining({ id: 'project-1' }));
    });

    it('throws NotFoundException when the project does not exist in any tenant', async () => {
      repository.findByIdGlobal.mockResolvedValue(undefined);
      await expect(
        service.findOneForCaller('project-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('archiveForCaller', () => {
    it('resolves the project real tenant and delegates to the access-checked archive', async () => {
      repository.findByIdGlobal.mockResolvedValue({
        id: 'project-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
      });
      repository.findById.mockResolvedValue({
        id: 'project-1',
        userId: 'user-1',
        statusId: null,
        importanceId: null,
      });
      repository.archive.mockResolvedValue({
        id: 'project-1',
        statusId: null,
        importanceId: null,
      });

      await service.archiveForCaller('project-1', 'user-1');

      expect(repository.archive).toHaveBeenCalledWith(
        'tenant-1',
        'project-1',
      );
    });

    it('throws NotFoundException when the project does not exist in any tenant', async () => {
      repository.findByIdGlobal.mockResolvedValue(undefined);
      await expect(
        service.archiveForCaller('project-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listActive', () => {
    it('returns the built-in project as an ordinary row and also exposes it for compatibility', async () => {
      repository.findGeneralByTenant.mockResolvedValue({
        id: 'project-general',
        title: 'General',
        userId: 'user-1',
        statusId: null,
        importanceId: null,
      });

      repository.findActiveByTenant.mockResolvedValue({
        data: [
          {
            id: 'project-general',
            title: 'General',
            userId: 'user-1',
            statusId: null,
            importanceId: null,
          },
          {
            id: 'project-1',
            title: 'Project One',
            userId: 'user-1',
            statusId: null,
            importanceId: null,
          },
        ],
        totalItems: 2,
        summary: { active: 1 },
      });

      collaboratorsRepository.findByProjectIdsAndUser.mockResolvedValue(
        new Map([
          ['project-general', { roleId: 'role-owner' }],
          ['project-1', { roleId: 'role-owner' }],
        ]),
      );

      const result = await service.listActive('tenant-1', 'user-1', 1, 20);

      expect(repository.findGeneralByTenant).toHaveBeenCalledWith('tenant-1');

      expect(repository.findActiveByTenant).toHaveBeenCalledWith(
        'tenant-1',
        0,
        20,
      );

      expect(result.generalProject).toEqual(
        expect.objectContaining({
          id: 'project-general',
          title: 'General',
        }),
      );

      expect(result.data.map((project) => project.id)).toEqual([
        'project-general',
        'project-1',
      ]);

      expect(result.summary).toEqual({ active: 1 });

      expect(result.meta).toEqual({
        page: 1,
        pageSize: 20,
        totalItems: 2,
        totalPages: 1,
      });
    });
  });

  describe('create', () => {
    it('resolves status/importance to enum ids', async () => {
      enumRepository.findByCategoryAndValue.mockImplementation(
        (category: string, value: string) =>
          Promise.resolve({ id: `${category}-${value}-id` }),
      );
      repository.create.mockResolvedValue({
        id: 'project-1',
        statusId: 'project_status-Active-id',
        importanceId: 'importance-High-id',
      });

      await service.create('user-1', 'tenant-1', {
        title: 'New Project',
        status: 'Active',
        importance: 'High',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          statusId: 'project_status-Active-id',
          importanceId: 'importance-High-id',
        }),
        expect.any(String),
      );
    });

    it('throws NotFoundException for an unknown enum value', async () => {
      enumRepository.findByCategoryAndValue.mockResolvedValue(undefined);

      await expect(
        service.create('user-1', 'tenant-1', {
          title: 'New Project',
          status: 'NotReal',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('leaves enum fields undefined when not provided', async () => {
      enumRepository.findByCategoryAndValue.mockImplementation(
        (category: string, _value: string) =>
          category === 'project_role'
            ? Promise.resolve({ id: 'owner-role-id' })
            : Promise.resolve(undefined),
      );
      repository.create.mockResolvedValue({
        id: 'project-1',
        statusId: null,
        importanceId: null,
      });

      await service.create('user-1', 'tenant-1', { title: 'New Project' });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          statusId: undefined,
          importanceId: undefined,
        }),
        'owner-role-id',
      );
    });
  });

  describe('update', () => {
    it('only resolves enum fields that were actually provided', async () => {
      repository.findById.mockResolvedValue({
        id: 'project-1',
        userId: 'user-1',
        statusId: null,
        importanceId: null,
      });
      repository.update.mockResolvedValue({
        id: 'project-1',
        title: 'Updated',
        statusId: null,
        importanceId: null,
      });

      await service.update('tenant-1', 'project-1', 'user-1', {
        title: 'Updated',
      });

      expect(enumRepository.findByCategoryAndValue).not.toHaveBeenCalled();
    });

    it('throws NotFoundException if the project does not exist', async () => {
      repository.findById.mockResolvedValue(undefined);
      await expect(
        service.update('tenant-1', 'project-1', 'user-1', { title: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('archive', () => {
    it('archives the project with its contents hidden and returns a warning', async () => {
      repository.findById.mockResolvedValue({
        id: 'project-1',
        userId: 'user-1',
        statusId: null,
        importanceId: null,
      });
      repository.archive.mockResolvedValue({
        id: 'project-1',
        statusId: null,
        importanceId: null,
      });

      const result = await service.archive('tenant-1', 'project-1', 'user-1');

      expect(repository.archive).toHaveBeenCalledWith(
        'tenant-1',
        'project-1',
      );
      expect(result.warning).toContain('14 days');
    });

    it('moves linked content before archiving when a destination is chosen', async () => {
      repository.findById
        .mockResolvedValueOnce({
          id: 'project-1',
          userId: 'user-1',
          isGeneral: false,
          archivedAt: null,
        })
        .mockResolvedValueOnce({
          id: 'project-2',
          userId: 'user-1',
          archivedAt: null,
        });
      repository.archive.mockResolvedValue({
        id: 'project-1',
        userId: 'user-1',
        statusId: null,
        importanceId: null,
      });

      await service.archive('tenant-1', 'project-1', 'user-1', {
        contentAction: 'move',
        destinationProjectId: 'project-2',
      });

      expect(repository.moveContentsToProject).toHaveBeenCalledWith(
        'tenant-1',
        'project-1',
        'project-2',
      );
      expect(repository.archive).toHaveBeenCalledWith('tenant-1', 'project-1');
    });

    it('does not allow the built-in project to be archived', async () => {
      repository.findById.mockResolvedValue({
        id: 'project-general',
        userId: 'user-1',
        isGeneral: true,
        archivedAt: null,
      });

      await expect(
        service.archive('tenant-1', 'project-general', 'user-1'),
      ).rejects.toThrow(BadRequestException);
      expect(repository.archive).not.toHaveBeenCalled();
    });

    it('throws NotFoundException if the project does not exist', async () => {
      repository.findById.mockResolvedValue(undefined);
      await expect(
        service.archive('tenant-1', 'project-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
