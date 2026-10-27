import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { ConferencesRepository } from '../repositories/conferences.repository';
import { ConferencesService } from './conferences.service';

const TENANT = 'tenant-1';
const CONFERENCE = 'conference-1';
const OWNER = 'user-1';

function setup() {
  const repository = {
    findVisibleById: jest.fn().mockResolvedValue({
      id: CONFERENCE,
      ownerUserId: OWNER,
      submissionDue: null,
    }),
    lockOwnedConference: jest.fn().mockResolvedValue({ id: CONFERENCE }),
    findProjectsByIds: jest.fn().mockResolvedValue([{ id: 'project-1' }]),
    findLinkableProjectIds: jest.fn().mockResolvedValue(['project-1']),
    findModulesByIds: jest
      .fn()
      .mockResolvedValue([{ id: 'paper-1', projectId: null }]),
    findLinkableModuleIds: jest.fn().mockResolvedValue(['paper-1']),
    insertSubmission: jest.fn().mockResolvedValue({ id: 'submission-1' }),
    findSubmissionForUpdate: jest.fn(),
    updateSubmission: jest.fn().mockResolvedValue({ id: 'submission-1' }),
    deleteSubmission: jest.fn().mockResolvedValue({ id: 'submission-1' }),
    findLinkedProjects: jest.fn().mockResolvedValue([]),
    findLinkedPapers: jest.fn().mockResolvedValue([]),
    findSubmissions: jest.fn().mockResolvedValue([]),
  };
  const service = new ConferencesService(
    repository as unknown as ConferencesRepository,
  );
  return { service, repository };
}

describe('conference submissions', () => {
  describe('adding', () => {
    it('lists a submission that is just a title, such as a PDW', async () => {
      const { service, repository } = setup();

      await service.addSubmission(TENANT, CONFERENCE, OWNER, {
        title: '  PDW: Qualitative methods  ',
        submissionType: 'PDW',
        status: 'Planning',
        submissionDue: '2027-01-15',
      });

      expect(repository.insertSubmission).toHaveBeenCalledWith(
        TENANT,
        CONFERENCE,
        { moduleId: undefined, projectId: undefined },
        {
          paperTitle: 'PDW: Qualitative methods',
          submissionType: 'PDW',
          status: 'Planning',
          submissionDue: '2027-01-15',
          notes: null,
        },
      );
      expect(repository.findLinkableModuleIds).not.toHaveBeenCalled();
      expect(repository.findLinkableProjectIds).not.toHaveBeenCalled();
    });

    it('links a paper the caller may link', async () => {
      const { service, repository } = setup();

      await service.addSubmission(TENANT, CONFERENCE, OWNER, {
        moduleId: 'paper-1',
        submissionType: 'Full paper',
        status: 'Submitted',
      });

      expect(repository.findLinkableModuleIds).toHaveBeenCalledWith(
        TENANT,
        ['paper-1'],
        OWNER,
      );
      expect(repository.insertSubmission).toHaveBeenCalledWith(
        TENANT,
        CONFERENCE,
        { moduleId: 'paper-1', projectId: undefined },
        expect.objectContaining({ status: 'Submitted', paperTitle: null }),
      );
    });

    it('links a project the caller may link', async () => {
      const { service, repository } = setup();

      await service.addSubmission(TENANT, CONFERENCE, OWNER, {
        projectId: 'project-1',
        submissionType: 'Symposium / Panel',
      });

      expect(repository.findLinkableProjectIds).toHaveBeenCalledWith(
        TENANT,
        ['project-1'],
        OWNER,
      );
      expect(repository.insertSubmission).toHaveBeenCalledWith(
        TENANT,
        CONFERENCE,
        { moduleId: undefined, projectId: 'project-1' },
        expect.objectContaining({ submissionType: 'Symposium / Panel' }),
      );
    });

    it('refuses a paper the caller may not link', async () => {
      const { service, repository } = setup();
      repository.findLinkableModuleIds.mockResolvedValue([]);

      await expect(
        service.addSubmission(TENANT, CONFERENCE, OWNER, {
          moduleId: 'paper-1',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repository.insertSubmission).not.toHaveBeenCalled();
    });

    it('needs a title when there is no paper or project', async () => {
      const { service, repository } = setup();

      await expect(
        service.addSubmission(TENANT, CONFERENCE, OWNER, { title: '   ' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.insertSubmission).not.toHaveBeenCalled();
    });

    it('refuses a paper and a project in one submission', async () => {
      const { service } = setup();

      await expect(
        service.addSubmission(TENANT, CONFERENCE, OWNER, {
          moduleId: 'paper-1',
          projectId: 'project-1',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('says so when the paper is already a submission', async () => {
      const { service, repository } = setup();
      repository.insertSubmission.mockResolvedValue(undefined);

      await expect(
        service.addSubmission(TENANT, CONFERENCE, OWNER, {
          moduleId: 'paper-1',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('only lets the conference owner add submissions', async () => {
      const { service, repository } = setup();

      await expect(
        service.addSubmission(TENANT, CONFERENCE, 'someone-else', {
          title: 'Talk',
        }),
      ).rejects.toThrow('Only the conference owner can manage its submissions');
      expect(repository.insertSubmission).not.toHaveBeenCalled();
    });
  });

  describe('editing', () => {
    it('changes only the details that were sent', async () => {
      const { service, repository } = setup();
      repository.findSubmissionForUpdate.mockResolvedValue({
        id: 'submission-1',
        moduleId: 'paper-1',
        projectId: null,
      });

      await service.updateSubmission(
        TENANT,
        CONFERENCE,
        'submission-1',
        OWNER,
        { status: 'Accepted', submissionDue: null },
      );

      expect(repository.updateSubmission).toHaveBeenCalledWith(
        TENANT,
        CONFERENCE,
        'submission-1',
        { status: 'Accepted', submissionDue: null },
      );
    });

    it('keeps a title on a submission that has nothing else', async () => {
      const { service, repository } = setup();
      repository.findSubmissionForUpdate.mockResolvedValue({
        id: 'submission-1',
        moduleId: null,
        projectId: null,
      });

      await expect(
        service.updateSubmission(TENANT, CONFERENCE, 'submission-1', OWNER, {
          title: '',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.updateSubmission).not.toHaveBeenCalled();
    });

    it('reports a submission that does not exist', async () => {
      const { service, repository } = setup();
      repository.findSubmissionForUpdate.mockResolvedValue(undefined);

      await expect(
        service.updateSubmission(TENANT, CONFERENCE, 'missing', OWNER, {
          status: 'Submitted',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('removing', () => {
    it('removes a submission', async () => {
      const { service, repository } = setup();
      repository.findSubmissionForUpdate.mockResolvedValue({
        id: 'submission-1',
        moduleId: null,
        projectId: null,
        presentedDate: null,
      });

      await service.removeSubmission(TENANT, CONFERENCE, 'submission-1', OWNER);

      expect(repository.deleteSubmission).toHaveBeenCalledWith(
        TENANT,
        CONFERENCE,
        'submission-1',
      );
    });

    it("keeps a paper whose presentation is recorded on the paper's page", async () => {
      const { service, repository } = setup();
      repository.findSubmissionForUpdate.mockResolvedValue({
        id: 'submission-1',
        moduleId: 'paper-1',
        projectId: null,
        presentedDate: '2026-10-01',
      });

      await expect(
        service.removeSubmission(TENANT, CONFERENCE, 'submission-1', OWNER),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repository.deleteSubmission).not.toHaveBeenCalled();
    });
  });

  it('describes each submission by what it is', async () => {
    const { service, repository } = setup();
    const base = {
      paperDisplayId: null,
      paperShortTitle: null,
      paperTitle: null,
      projectDisplayId: null,
      projectTitle: null,
      titleAsSubmitted: null,
      submissionType: null,
      status: null,
      submissionDue: null,
      presentedDate: null,
      notes: null,
    };
    repository.findSubmissions.mockResolvedValue([
      {
        ...base,
        id: 's-paper',
        moduleId: 'paper-1',
        projectId: null,
        paperDisplayId: 'MOD-001',
        paperShortTitle: 'Draft manuscript',
        status: 'Submitted',
      },
      {
        ...base,
        id: 's-project',
        moduleId: null,
        projectId: 'project-1',
        projectDisplayId: 'PRJ-001',
        projectTitle: 'Genome Project',
      },
      {
        ...base,
        id: 's-pdw',
        moduleId: null,
        projectId: null,
        titleAsSubmitted: 'PDW: Qualitative methods',
        submissionType: 'PDW',
      },
    ]);

    const result = await service.addSubmission(TENANT, CONFERENCE, OWNER, {
      title: 'Anything',
    });

    expect(result.submissions).toEqual([
      expect.objectContaining({
        id: 's-paper',
        kind: 'paper',
        name: 'Draft manuscript',
        displayId: 'MOD-001',
        status: 'Submitted',
      }),
      expect.objectContaining({
        id: 's-project',
        kind: 'project',
        name: 'Genome Project',
        displayId: 'PRJ-001',
      }),
      expect.objectContaining({
        id: 's-pdw',
        kind: 'other',
        name: 'PDW: Qualitative methods',
        displayId: null,
        submissionType: 'PDW',
      }),
    ]);
  });
});
