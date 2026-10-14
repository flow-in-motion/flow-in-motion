import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { userLookupCache } from './user-lookup-cache';
import { DrizzleService } from '../../db/drizzle.service';
import { SupabaseAdminService } from '../auth/supabase-admin.service';

function serviceReturning(rows: unknown[][]) {
  const where = jest.fn();
  for (const result of rows) where.mockResolvedValueOnce(result);
  const select = jest
    .fn()
    .mockReturnValue({ from: jest.fn().mockReturnValue({ where }) });
  const service = new UsersService(
    { db: { select } } as unknown as DrizzleService,
    {} as SupabaseAdminService,
  );
  return { service, where };
}

const user = { id: 'user-1', externalAuthId: 'auth-1', displayName: 'Avi' };

describe('findByExternalAuthId caching', () => {
  beforeEach(() => {
    userLookupCache.clear();
    jest.useRealTimers();
  });

  it('looks the user up once and reuses the result for later calls', async () => {
    const { service, where } = serviceReturning([[user]]);

    await expect(service.findByExternalAuthId('auth-1')).resolves.toBe(user);
    await expect(service.findByExternalAuthId('auth-1')).resolves.toBe(user);
    await expect(service.findByExternalAuthId('auth-1')).resolves.toBe(user);

    expect(where).toHaveBeenCalledTimes(1);
  });

  it('never caches a missing user, so a newly created one is found at once', async () => {
    const { service, where } = serviceReturning([[], [user]]);

    await expect(service.findByExternalAuthId('auth-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.findByExternalAuthId('auth-1')).resolves.toBe(user);
    expect(where).toHaveBeenCalledTimes(2);
  });

  it('refreshes after a minute, and immediately once the user is forgotten', async () => {
    jest.useFakeTimers();
    const renamed = { ...user, displayName: 'Avishka' };
    const { service, where } = serviceReturning([[user], [renamed], [user]]);

    await service.findByExternalAuthId('auth-1');
    jest.advanceTimersByTime(61_000);
    await expect(service.findByExternalAuthId('auth-1')).resolves.toBe(renamed);

    userLookupCache.forget({ id: 'user-1' });
    await expect(service.findByExternalAuthId('auth-1')).resolves.toBe(user);
    expect(where).toHaveBeenCalledTimes(3);
  });
});
