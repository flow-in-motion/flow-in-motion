import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { ConferencesRepository } from '../repositories/conferences.repository';
import { ConferencesService } from './conferences.service';

function setup() {
  const repository = {
    findModulesByIds: jest
      .fn()
      .mockResolvedValue([{ id: 'paper-1', projectId: null }]),
    findLinkableModuleIds: jest.fn().mockResolvedValue(['paper-1']),
    findVisibleById: jest.fn().mockResolvedValue({
      id: 'conference-1',
      ownerUserId: 'user-1',
    }),
    lockOwnedConference: jest.fn().mockResolvedValue({
      id: 'conference-1',
    }),
    findConferencePaperLink: jest.fn().mockResolvedValue(undefined),
    saveConferencePresentation: jest.fn().mockResolvedValue({
      id: 'link-1',
      presentedDate: '2026-10-01',
    }),
    clearConferencePresentation: jest.fn().mockResolvedValue({
      id: 'link-1',
      presentedDate: null,
    }),
    findPresentationsByModule: jest.fn().mockResolvedValue([
      {
        id: 'link-1',
        ownerUserId: 'user-1',
        conferenceName: 'Research conference',
        presentedDate: '2026-10-01',
      },
    ]),
    findOwnedConferenceOptions: jest.fn().mockResolvedValue([]),
    findSubmissionsByModule: jest.fn().mockResolvedValue([]),
  };

  const service = new ConferencesService(
    repository as unknown as ConferencesRepository,
  );

  return { service, repository };
}

describe('conference presentation service', () => {
  it('records a presentation on an existing planned link', async () => {
    const { service, repository } = setup();
    repository.findConferencePaperLink.mockResolvedValue({
      id: 'link-1',
      presentedDate: null,
    });

    await service.savePaperPresentation(
      'tenant-1',
      'paper-1',
      'conference-1',
      'user-1',
      {
        presentedDate: '2026-10-01',
        presentationType: ' Poster ',
        abstract: ' Presented abstract ',
      },
      'create',
    );

    expect(repository.saveConferencePresentation).toHaveBeenCalledWith(
      'tenant-1',
      'conference-1',
      'paper-1',
      {
        presentedDate: '2026-10-01',
        presentationType: 'Poster',
        paperTitle: null,
        abstract: 'Presented abstract',
        notes: null,
      },
    );
  });

  it('prevents creating a duplicate presentation', async () => {
    const { service, repository } = setup();
    repository.findConferencePaperLink.mockResolvedValue({
      id: 'link-1',
      presentedDate: '2026-10-01',
    });

    await expect(
      service.savePaperPresentation(
        'tenant-1',
        'paper-1',
        'conference-1',
        'user-1',
        { presentedDate: '2026-10-02' },
        'create',
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(repository.saveConferencePresentation).not.toHaveBeenCalled();
  });

  it('prevents writes by someone who does not own the conference', async () => {
    const { service, repository } = setup();
    repository.findVisibleById.mockResolvedValue({
      id: 'conference-1',
      ownerUserId: 'another-user',
    });

    await expect(
      service.savePaperPresentation(
        'tenant-1',
        'paper-1',
        'conference-1',
        'user-1',
        { presentedDate: '2026-10-01' },
        'create',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(repository.saveConferencePresentation).not.toHaveBeenCalled();
  });

  it('prevents writes when the caller does not own the independent paper', async () => {
    const { service, repository } = setup();
    repository.findLinkableModuleIds.mockResolvedValue([]);

    await expect(
      service.savePaperPresentation(
        'tenant-1',
        'paper-1',
        'conference-1',
        'user-1',
        { presentedDate: '2026-10-01' },
        'create',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(repository.saveConferencePresentation).not.toHaveBeenCalled();
  });

  it('does not create an entry through the update endpoint', async () => {
    const { service, repository } = setup();

    await expect(
      service.savePaperPresentation(
        'tenant-1',
        'paper-1',
        'conference-1',
        'user-1',
        { presentedDate: '2026-10-01' },
        'update',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(repository.saveConferencePresentation).not.toHaveBeenCalled();
  });

  it('clears presentation details using the existing link', async () => {
    const { service, repository } = setup();
    repository.findConferencePaperLink.mockResolvedValue({
      id: 'link-1',
      presentedDate: '2026-10-01',
    });

    await service.removePaperPresentation(
      'tenant-1',
      'paper-1',
      'conference-1',
      'user-1',
    );

    expect(repository.clearConferencePresentation).toHaveBeenCalledWith(
      'tenant-1',
      'conference-1',
      'paper-1',
    );
  });

  it('lets a paper reader view history without management controls', async () => {
    const { service, repository } = setup();
    repository.findLinkableModuleIds.mockResolvedValue([]);

    const result = await service.listPaperPresentations(
      'tenant-1',
      'paper-1',
      'user-1',
    );

    expect(result.canLogPresentation).toBe(false);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        canManage: false,
        conferenceName: 'Research conference',
      }),
    );
    expect(result.data[0]).not.toHaveProperty('ownerUserId');
  });

  it('rejects history requests for an inaccessible paper', async () => {
    const { service, repository } = setup();
    repository.findModulesByIds.mockResolvedValue([]);

    await expect(
      service.listPaperPresentations('tenant-1', 'paper-1', 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(repository.findPresentationsByModule).not.toHaveBeenCalled();
  });
});
