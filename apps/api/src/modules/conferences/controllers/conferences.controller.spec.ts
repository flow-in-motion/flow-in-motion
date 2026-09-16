import { ConfigService } from '@nestjs/config';
import { ConferencesController } from './conferences.controller';
import { ConferencesService } from '../services/conferences.service';
import { UsersService } from '../../users/users.service';

describe('ConferencesController', () => {
  let controller: ConferencesController;

  let conferencesService: {
    list: jest.Mock;
  };

  let usersService: {
    findByExternalAuthId: jest.Mock;
  };

  let configService: {
    get: jest.Mock;
  };

  beforeEach(() => {
    conferencesService = {
      list: jest.fn(),
    };

    usersService = {
      findByExternalAuthId: jest.fn().mockResolvedValue({ id: 'user-1' }),
    };

    configService = {
      get: jest.fn().mockReturnValue(20),
    };

    controller = new ConferencesController(
      conferencesService as unknown as ConferencesService,
      usersService as unknown as UsersService,
      configService as unknown as ConfigService,
    );
  });

  const req = {
    user: {
      sub: 'supabase-user-1',
      accessToken: 'token-1',
    },
  } as any;

  describe('list', () => {
    it('delegates with the caller and pagination parameters', async () => {
      const response = {
        data: [{ id: 'conference-1' }],
        meta: {
          page: 2,
          pageSize: 20,
          totalItems: 21,
          totalPages: 2,
        },
      };

      conferencesService.list.mockResolvedValue(response);

      const result = await controller.list('tenant-1', req, { page: 2 });

      expect(usersService.findByExternalAuthId).toHaveBeenCalledWith(
        'supabase-user-1',
      );

      expect(configService.get).toHaveBeenCalledWith('PAGE_SIZE', 20);

      expect(conferencesService.list).toHaveBeenCalledWith(
        'tenant-1',
        'user-1',
        2,
        20,
      );

      expect(result).toBe(response);
    });
  });
});
