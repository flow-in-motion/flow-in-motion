import { ModuleSubmissionsController } from './module-submissions.controller';
import { ModuleSubmissionsService } from '../services/module-submissions.service';
import { UsersService } from '../../users/users.service';

describe('ModuleSubmissionsController', () => {
  let controller: ModuleSubmissionsController;

  let service: {
    list: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  let usersService: {
    findByExternalAuthId: jest.Mock;
  };

  beforeEach(() => {
    service = {
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    usersService = {
      findByExternalAuthId: jest.fn().mockResolvedValue({ id: 'user-1' }),
    };

    controller = new ModuleSubmissionsController(
      service as unknown as ModuleSubmissionsService,
      usersService as unknown as UsersService,
    );
  });

  const req = {
    user: { sub: 'cognito-sub-1', accessToken: 'token-1' },
  } as any;

  describe('list', () => {
    it('delegates with the tenant and module', async () => {
      const submissions = [{ id: 'submission-1' }];
      service.list.mockResolvedValue(submissions);

      const result = await controller.list('tenant-1', 'module-1');

      expect(service.list).toHaveBeenCalledWith('tenant-1', 'module-1');
      expect(result).toBe(submissions);
    });
  });

  describe('create', () => {
    it('resolves the caller and delegates to the service', async () => {
      service.create.mockResolvedValue({ id: 'submission-1' });

      const dto = {
        submittedDate: '2026-03-01',
        journalName: 'Nature Communications',
        status: 'Submitted',
      };
      const result = await controller.create('tenant-1', 'module-1', req, dto);

      expect(usersService.findByExternalAuthId).toHaveBeenCalledWith(
        'cognito-sub-1',
      );
      expect(service.create).toHaveBeenCalledWith(
        'tenant-1',
        'module-1',
        'user-1',
        dto,
      );
      expect(result).toEqual({ id: 'submission-1' });
    });
  });

  describe('update', () => {
    it('delegates to the service', async () => {
      service.update.mockResolvedValue({ id: 'submission-1' });

      const dto = { status: 'Accepted' };
      const result = await controller.update(
        'tenant-1',
        'module-1',
        'submission-1',
        dto,
      );

      expect(service.update).toHaveBeenCalledWith(
        'tenant-1',
        'module-1',
        'submission-1',
        dto,
      );
      expect(result).toEqual({ id: 'submission-1' });
    });
  });

  describe('remove', () => {
    it('delegates to the service', async () => {
      service.remove.mockResolvedValue({
        message: 'Submission deleted successfully',
      });

      const result = await controller.remove(
        'tenant-1',
        'module-1',
        'submission-1',
      );

      expect(service.remove).toHaveBeenCalledWith(
        'tenant-1',
        'module-1',
        'submission-1',
      );
      expect(result).toEqual({ message: 'Submission deleted successfully' });
    });
  });
});
