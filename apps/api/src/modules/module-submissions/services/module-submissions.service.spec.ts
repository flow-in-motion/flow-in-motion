import { NotFoundException } from '@nestjs/common';
import { ModuleSubmissionsService } from './module-submissions.service';
import { ModuleSubmissionsRepository } from '../repositories/module-submissions.repository';

describe('ModuleSubmissionsService', () => {
  let service: ModuleSubmissionsService;
  let repository: {
    findByModule: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  const tenantId = 'tenant-1';
  const moduleId = 'module-1';
  const callerUserId = 'user-1';

  beforeEach(() => {
    repository = {
      findByModule: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    service = new ModuleSubmissionsService(
      repository as unknown as ModuleSubmissionsRepository,
    );
  });

  describe('list', () => {
    it('returns every submission for the module', async () => {
      const submissions = [{ id: 'submission-1' }];
      repository.findByModule.mockResolvedValue(submissions);

      const result = await service.list(tenantId, moduleId);

      expect(repository.findByModule).toHaveBeenCalledWith(tenantId, moduleId);
      expect(result).toBe(submissions);
    });
  });

  describe('create', () => {
    it('trims text fields and records the caller as creator', async () => {
      repository.create.mockResolvedValue({ id: 'submission-1' });

      await service.create(tenantId, moduleId, callerUserId, {
        submittedDate: '2026-03-01',
        journalName: '  Nature Communications  ',
        status: 'Submitted',
        revisionRounds: 2,
        decisionDate: '2026-06-15',
        notes: '  Reviewer 2 requested more controls  ',
      });

      expect(repository.create).toHaveBeenCalledWith({
        tenantId,
        moduleId,
        createdBy: callerUserId,
        submittedDate: '2026-03-01',
        journalName: 'Nature Communications',
        status: 'Submitted',
        revisionRounds: 2,
        decisionDate: '2026-06-15',
        notes: 'Reviewer 2 requested more controls',
      });
    });
  });

  describe('update', () => {
    it('throws when the submission does not exist', async () => {
      repository.findById.mockResolvedValue(undefined);

      await expect(
        service.update(tenantId, moduleId, 'submission-1', {
          status: 'Accepted',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(repository.update).not.toHaveBeenCalled();
    });

    it('updates the submission when it exists', async () => {
      repository.findById.mockResolvedValue({ id: 'submission-1' });
      repository.update.mockResolvedValue({
        id: 'submission-1',
        status: 'Accepted',
      });

      const result = await service.update(tenantId, moduleId, 'submission-1', {
        status: 'Accepted',
      });

      expect(repository.update).toHaveBeenCalledWith(
        tenantId,
        moduleId,
        'submission-1',
        {
          submittedDate: undefined,
          journalName: undefined,
          status: 'Accepted',
          revisionRounds: undefined,
          decisionDate: undefined,
          notes: undefined,
        },
      );
      expect(result).toEqual({ id: 'submission-1', status: 'Accepted' });
    });
  });

  describe('remove', () => {
    it('throws when the submission does not exist', async () => {
      repository.findById.mockResolvedValue(undefined);

      await expect(
        service.remove(tenantId, moduleId, 'submission-1'),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(repository.remove).not.toHaveBeenCalled();
    });

    it('deletes the submission when it exists', async () => {
      repository.findById.mockResolvedValue({ id: 'submission-1' });
      repository.remove.mockResolvedValue({ id: 'submission-1' });

      const result = await service.remove(tenantId, moduleId, 'submission-1');

      expect(repository.remove).toHaveBeenCalledWith(
        tenantId,
        moduleId,
        'submission-1',
      );
      expect(result).toEqual({
        message: 'Submission deleted successfully',
        submission: { id: 'submission-1' },
      });
    });
  });
});
