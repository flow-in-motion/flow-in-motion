import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConferencesService } from './conferences.service';
import { ConferencesRepository } from '../repositories/conferences.repository';

describe('ConferencesService', () => {
  let service: ConferencesService;
  let repository: {
    findProjectsByIds: jest.Mock;
    findOwnedProjectIds: jest.Mock;
    findLinkedProjects: jest.Mock;
    findVisibleById: jest.Mock;
    findVisiblePageByUser: jest.Mock;
    findLinkedProjectsForConferences: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };

  const tenantId = 'tenant-1';
  const callerUserId = 'user-1';

  beforeEach(() => {
    repository = {
      findProjectsByIds: jest.fn(),
      findOwnedProjectIds: jest.fn(),
      findLinkedProjects: jest.fn().mockResolvedValue([]),
      findVisibleById: jest.fn(),
      findVisiblePageByUser: jest.fn(),
      findLinkedProjectsForConferences: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    service = new ConferencesService(
      repository as unknown as ConferencesRepository,
    );
  });

  const baseInput = {
    acronym: 'ASM',
    name: 'Conference',
    location: 'Sydney',
    submissionDue: '2026-08-01',
    startDate: '2027-06-04',
    endDate: '2027-06-08',
  };

  describe('create', () => {
    it('creates a conference when only its name is supplied', async () => {
      repository.create.mockResolvedValue({
        id: 'conference-1',
        submissionDue: null,
      });

      const result = await service.create(tenantId, callerUserId, {
        name: 'XYZ, London, 2027',
        projectIds: [],
      });

      expect(repository.create).toHaveBeenCalledWith(
        {
          tenantId,
          ownerUserId: callerUserId,
          acronym: null,
          name: 'XYZ, London, 2027',
          location: null,
          submissionDue: null,
          startDate: null,
          endDate: null,
          submissionType: undefined,
        },
        [],
      );
      expect(result).toEqual(
        expect.objectContaining({ daysRemaining: null, projects: [] }),
      );
    });

    it('creates a conference with no linked projects without validating ownership', async () => {
      repository.create.mockResolvedValue({ id: 'conference-1' });

      await service.create(tenantId, callerUserId, {
        ...baseInput,
        projectIds: [],
      });

      expect(repository.findProjectsByIds).not.toHaveBeenCalled();
      expect(repository.findOwnedProjectIds).not.toHaveBeenCalled();
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId, ownerUserId: callerUserId }),
        [],
      );
    });

    it('still requires ownership of every linked project when projects are supplied', async () => {
      repository.findProjectsByIds.mockResolvedValue([{ id: 'project-1' }]);
      repository.findOwnedProjectIds.mockResolvedValue([]);

      await expect(
        service.create(tenantId, callerUserId, {
          ...baseInput,
          projectIds: ['project-1'],
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejects an end date before the start date regardless of linked projects', async () => {
      await expect(
        service.create(tenantId, callerUserId, {
          ...baseInput,
          startDate: '2027-06-08',
          endDate: '2027-06-04',
          projectIds: [],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('update', () => {
    it('clears all linked projects when projectIds is updated to an empty array', async () => {
      repository.findVisibleById.mockResolvedValue({
        id: 'conference-1',
        ownerUserId: callerUserId,
        startDate: baseInput.startDate,
        endDate: baseInput.endDate,
      });
      repository.update.mockResolvedValue({ id: 'conference-1' });

      await service.update(tenantId, 'conference-1', callerUserId, {
        projectIds: [],
      });

      expect(repository.findProjectsByIds).not.toHaveBeenCalled();
      expect(repository.update).toHaveBeenCalledWith(
        tenantId,
        'conference-1',
        expect.any(Object),
        [],
      );
    });

    it('allows optional dates to be cleared', async () => {
      repository.findVisibleById.mockResolvedValue({
        id: 'conference-1',
        ownerUserId: callerUserId,
        submissionDue: baseInput.submissionDue,
        startDate: baseInput.startDate,
        endDate: baseInput.endDate,
      });
      repository.update.mockResolvedValue({
        id: 'conference-1',
        submissionDue: null,
      });

      await service.update(tenantId, 'conference-1', callerUserId, {
        submissionDue: null,
        startDate: null,
        endDate: null,
      });

      expect(repository.update).toHaveBeenCalledWith(
        tenantId,
        'conference-1',
        expect.objectContaining({
          submissionDue: null,
          startDate: null,
          endDate: null,
        }),
        undefined,
      );
    });
  });

  describe('list', () => {
    it('returns a paginated list of visible conferences', async () => {
      const conference = {
        id: 'conference-1',
        tenantId: 'tenant-1',
        acronym: 'CONF',
        name: 'Example Conference',
        location: 'Melbourne',
        submissionDue: '2026-10-01',
        startDate: '2026-11-01',
        endDate: '2026-11-03',
      };

      const linkedProjects = [
        {
          id: 'project-1',
          title: 'Research Project',
        },
      ];

      repository.findVisiblePageByUser.mockResolvedValue({
        data: [conference],
        totalItems: 45,
      });

      repository.findLinkedProjectsForConferences.mockResolvedValue(
        new Map([['conference-1', linkedProjects]]),
      );

      const result = await service.list('tenant-1', 'user-1', 2, 20);

      expect(repository.findVisiblePageByUser).toHaveBeenCalledWith(
        'tenant-1',
        'user-1',
        20,
        20,
      );

      expect(repository.findLinkedProjectsForConferences).toHaveBeenCalledWith(
        'tenant-1',
        ['conference-1'],
      );

      expect(result.data).toEqual([
        expect.objectContaining({
          id: 'conference-1',
          projects: linkedProjects,
          daysRemaining: expect.any(Number),
        }),
      ]);

      expect(result.meta).toEqual({
        page: 2,
        pageSize: 20,
        totalItems: 45,
        totalPages: 3,
      });
    });

    it('returns no deadline countdown when a conference has no deadline', async () => {
      repository.findVisiblePageByUser.mockResolvedValue({
        data: [{ id: 'conference-1', submissionDue: null }],
        totalItems: 1,
      });
      repository.findLinkedProjectsForConferences.mockResolvedValue(new Map());

      const result = await service.list('tenant-1', 'user-1', 1, 20);

      expect(result.data[0]).toEqual(
        expect.objectContaining({ daysRemaining: null }),
      );
    });
  });
});
