import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { HdrService } from './hdr.service';
import { HdrRepository } from './hdr.repository';

describe('HDR records', () => {
  let service: HdrService;
  let repo: Record<
    | 'page'
    | 'links'
    | 'findOwned'
    | 'validProjects'
    | 'validPapers'
    | 'create'
    | 'update'
    | 'remove',
    jest.Mock
  >;
  beforeEach(() => {
    repo = {
      page: jest.fn(),
      links: jest.fn().mockResolvedValue({ projects: [], papers: [] }),
      findOwned: jest.fn().mockResolvedValue({ id: 'person' }),
      validProjects: jest.fn().mockResolvedValue([]),
      validPapers: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'person' }),
      update: jest.fn().mockResolvedValue({ id: 'person' }),
      remove: jest.fn().mockResolvedValue({ id: 'person' }),
    };
    service = new HdrService(repo as unknown as HdrRepository);
  });
  it('creates a name-only record owned by the caller with no invitation or existing work writes', async () => {
    await service.create('workspace', 'supervisor', {
      name: '  Sample student  ',
    });
    expect(repo.create).toHaveBeenCalledWith(
      {
        tenantId: 'workspace',
        ownerUserId: 'supervisor',
        name: 'Sample student',
        type: 'PhD',
        category: 'Current',
        email: null,
        researchTopic: null,
      },
      [],
      [],
    );
  });
  it('rejects blank names', async () => {
    await expect(
      service.create('w', 'u', { name: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.create).not.toHaveBeenCalled();
  });
  it('validates every selected paper and project before creating', async () => {
    repo.validProjects.mockResolvedValue([{ id: 'project' }]);
    await expect(
      service.create('w', 'u', {
        name: 'Student',
        projectIds: ['project'],
        paperIds: ['inaccessible'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.create).not.toHaveBeenCalled();
  });
  it('returns global counts separately from filtered and paginated rows', async () => {
    repo.page.mockResolvedValue({
      data: [{ id: 'person' }],
      totals: {
        totalItems: 1,
        currentStudents: 37,
        potentialStudents: 11,
        visitingScholars: 5,
      },
      page: 1,
    });
    const result = await service.list('w', 'u', {
      page: 2,
      search: 'Exact name',
      type: 'MRes',
    });
    expect(result.counts).toEqual({
      currentStudents: 37,
      potentialStudents: 11,
      visitingScholars: 5,
    });
    expect(result.meta.totalItems).toBe(1);
    expect(repo.links).toHaveBeenCalledWith('w', 'u', ['person']);
  });
  it('does not reset links or categories omitted from a partial edit', async () => {
    await service.update('w', 'person', 'u', { name: 'Updated' });
    expect(repo.update).toHaveBeenCalledWith(
      'w',
      'person',
      'u',
      expect.objectContaining({ type: undefined, category: undefined }),
      undefined,
      undefined,
    );
  });
  it('can clear optional fields and detach every selected work link', async () => {
    await service.update('w', 'person', 'u', {
      email: null,
      researchTopic: null,
      projectIds: [],
      paperIds: [],
    });
    expect(repo.update).toHaveBeenCalledWith(
      'w',
      'person',
      'u',
      expect.objectContaining({ email: null, researchTopic: null }),
      [],
      [],
    );
  });
  it('cannot edit another person’s private record', async () => {
    repo.findOwned.mockResolvedValue(undefined);
    await expect(
      service.update('w', 'person', 'other-user', { name: 'Changed' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.update).not.toHaveBeenCalled();
    expect(repo.validProjects).not.toHaveBeenCalled();
  });
  it('deletes only the owned HDR record', async () => {
    await service.remove('w', 'person', 'u');
    expect(repo.remove).toHaveBeenCalledWith('w', 'person', 'u');
    repo.remove.mockResolvedValue(undefined);
    await expect(service.remove('w', 'person', 'other')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
