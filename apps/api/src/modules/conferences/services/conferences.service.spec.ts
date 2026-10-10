import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConferencesService } from './conferences.service';
import { ConferencesRepository } from '../repositories/conferences.repository';

describe('ConferencesService', () => {
  let service: ConferencesService;
  let repository: {
    findProjectsByIds: jest.Mock;
    findOwnedProjectIds: jest.Mock;
    findModulesByIds: jest.Mock;
    findLinkedProjects: jest.Mock;
    findLinkedPapers: jest.Mock;
    findVisibleById: jest.Mock;
    findVisiblePageByUser: jest.Mock;
    findLinkedProjectsForConferences: jest.Mock;
    findLinkedPapersForConferences: jest.Mock;
    searchOwnedLinkOptions: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };

  const tenantId = 'tenant-1';
  const callerUserId = 'user-1';

  beforeEach(() => {
    repository = {
      findProjectsByIds: jest.fn(),
      findOwnedProjectIds: jest.fn(),
      findModulesByIds: jest.fn(),
      findLinkedProjects: jest.fn().mockResolvedValue([]),
      findLinkedPapers: jest.fn().mockResolvedValue([]),
      findVisibleById: jest.fn(),
      findVisiblePageByUser: jest.fn(),
      findLinkedProjectsForConferences: jest.fn(),
      findLinkedPapersForConferences: jest.fn(),
      searchOwnedLinkOptions: jest.fn(),
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
    moduleIds: [],
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
        moduleIds: [],
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
          intents: [],
        },
        [],
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
        [],
      );
    });

    it('stores every selected conference intent', async () => {
      repository.create.mockResolvedValue({
        id: 'conference-1',
        submissionDue: null,
      });

      await service.create(tenantId, callerUserId, {
        name: 'Multi-purpose conference',
        intents: ['Submitting', 'Attending'],
        projectIds: [],
        moduleIds: [],
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ intents: ['Submitting', 'Attending'] }),
        [],
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

    it('stores a paper link after validating ownership of its parent project', async () => {
      repository.findModulesByIds.mockResolvedValue([
        { id: 'paper-1', projectId: 'project-1' },
      ]);
      repository.findProjectsByIds.mockResolvedValue([{ id: 'project-1' }]);
      repository.findOwnedProjectIds.mockResolvedValue(['project-1']);
      repository.create.mockResolvedValue({
        id: 'conference-1',
        submissionDue: null,
      });

      await service.create(tenantId, callerUserId, {
        name: 'Paper conference',
        projectIds: [],
        moduleIds: ['paper-1'],
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Paper conference' }),
        [],
        ['paper-1'],
      );
    });

    it('does not link a missing or archived paper', async () => {
      repository.findModulesByIds.mockResolvedValue([]);

      await expect(
        service.create(tenantId, callerUserId, {
          name: 'Paper conference',
          projectIds: [],
          moduleIds: ['paper-1'],
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

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
        undefined,
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
      repository.findLinkedPapersForConferences.mockResolvedValue(new Map());

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
      expect(repository.findLinkedPapersForConferences).toHaveBeenCalledWith(
        'tenant-1',
        ['conference-1'],
      );

      expect(result.data).toEqual([
        expect.objectContaining({
          id: 'conference-1',
          projects: linkedProjects,
          papers: [],
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
      repository.findLinkedPapersForConferences.mockResolvedValue(new Map());

      const result = await service.list('tenant-1', 'user-1', 1, 20);

      expect(result.data[0]).toEqual(
        expect.objectContaining({ daysRemaining: null }),
      );
    });
  });

  describe('searchLinkOptions', () => {
    it('searches all owned project and paper link options', async () => {
      repository.searchOwnedLinkOptions.mockResolvedValue([
        { kind: 'paper', id: 'paper-42', label: 'Remote paper' },
      ]);

      const result = await service.searchLinkOptions(
        tenantId,
        callerUserId,
        ' Remote ',
      );

      expect(repository.searchOwnedLinkOptions).toHaveBeenCalledWith(
        tenantId,
        callerUserId,
        'Remote',
      );
      expect(result).toEqual([
        { kind: 'paper', id: 'paper-42', label: 'Remote paper' },
      ]);
    });
  });
});
