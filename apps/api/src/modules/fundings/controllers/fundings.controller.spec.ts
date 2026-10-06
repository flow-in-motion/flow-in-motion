import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { FundingsService } from '../services/fundings.service';
import { FundingsController } from './fundings.controller';

describe('FundingsController', () => {
  it('passes pagination and search values to the service', async () => {
    const service = { list: jest.fn().mockResolvedValue({ data: [] }) };
    const usersService = {
      findByExternalAuthId: jest.fn().mockResolvedValue({ id: 'user-1' }),
    };
    const configService = { get: jest.fn().mockReturnValue(20) };
    const controller = new FundingsController(
      service as unknown as FundingsService,
      usersService as unknown as UsersService,
      configService as unknown as ConfigService,
    );
    const req = {
      user: { sub: 'external-user' },
    } as unknown as Parameters<FundingsController['list']>[1];

    await controller.list('tenant-1', req, {
      page: 2,
      pageSize: 50,
      search: ' ARC ',
    });

    expect(service.list).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      2,
      50,
      'ARC',
    );
  });
});
