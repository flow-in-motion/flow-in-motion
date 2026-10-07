import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { FundingsRepository } from '../repositories/fundings.repository';
import { FundingsService } from './fundings.service';

describe('FundingsService', () => {
  let service: FundingsService;
  let repository: {
    findVisiblePageByUser: jest.Mock;
    findLinksForFundings: jest.Mock;
    findVisibleById: jest.Mock;
    findAccessibleProjectsByIds: jest.Mock;
    findAccessibleModulesByIds: jest.Mock;
    findLinkedProjects: jest.Mock;
    findLinkedModules: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(() => {
    repository = {
      findVisiblePageByUser: jest.fn(),
      findLinksForFundings: jest.fn(),
      findVisibleById: jest.fn(),
      findAccessibleProjectsByIds: jest.fn().mockResolvedValue([]),
      findAccessibleModulesByIds: jest.fn().mockResolvedValue([]),
      findLinkedProjects: jest.fn().mockResolvedValue([]),
      findLinkedModules: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    service = new FundingsService(repository as unknown as FundingsRepository);
  });

  it('creates a funding record when only the funding body is supplied', async () => {
    repository.create.mockResolvedValue({
      id: 'funding-1',
      fundingBody: 'Australian Research Council',
    });

    const result = await service.create('tenant-1', 'user-1', {
      fundingBody: ' Australian Research Council ',
      projectIds: [],
      moduleIds: [],
    });

    expect(repository.create).toHaveBeenCalledWith(
      {
        tenantId: 'tenant-1',
        ownerUserId: 'user-1',
        fundingBody: 'Australian Research Council',
        scheme: null,
        partners: null,
        amount: null,
        currency: null,
        applicationDeadline: null,
        status: null,
        notes: null,
      },
      [],
      [],
    );
    expect(result).toEqual(
      expect.objectContaining({ projects: [], papers: [] }),
    );
  });

  it('rejects a blank funding body', async () => {
    await expect(
      service.create('tenant-1', 'user-1', {
        fundingBody: '   ',
        projectIds: [],
        moduleIds: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires access to every linked project and paper', async () => {
    repository.findAccessibleProjectsByIds.mockResolvedValue([
      { id: 'project-1' },
    ]);
    repository.findAccessibleModulesByIds.mockResolvedValue([]);

    await expect(
      service.create('tenant-1', 'user-1', {
        fundingBody: 'Funding body',
        projectIds: ['project-1'],
        moduleIds: ['paper-1'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('returns paginated funding with project and paper links', async () => {
    repository.findVisiblePageByUser.mockResolvedValue({
      data: [{ id: 'funding-1', fundingBody: 'Funding body' }],
      totalItems: 1,
    });
    repository.findLinksForFundings.mockResolvedValue({
      projectsByFunding: new Map([
        ['funding-1', [{ id: 'project-1', title: 'Project' }]],
      ]),
      modulesByFunding: new Map([
        ['funding-1', [{ id: 'paper-1', title: 'Paper' }]],
      ]),
    });

    const result = await service.list('tenant-1', 'user-1', 1, 20, 'arc');

    expect(repository.findVisiblePageByUser).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      0,
      20,
      'arc',
    );
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        projects: [{ id: 'project-1', title: 'Project' }],
        papers: [{ id: 'paper-1', title: 'Paper' }],
      }),
    );
  });

  it('does not allow a viewer to update funding they do not own', async () => {
    repository.findVisibleById.mockResolvedValue({
      id: 'funding-1',
      ownerUserId: 'another-user',
    });

    await expect(
      service.update('tenant-1', 'funding-1', 'user-1', {
        scheme: 'New scheme',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.update).not.toHaveBeenCalled();
  });
});
