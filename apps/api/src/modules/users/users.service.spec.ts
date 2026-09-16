import { UsersService } from './users.service';
import { DrizzleService } from '../../db/drizzle.service';
import { UnauthorizedException } from '@nestjs/common';

describe('UsersService', () => {
  describe('findOrProvisionFromPrincipal', () => {
    it('creates an application user from verified Supabase claims', async () => {
      const created = {
        id: 'user-1',
        externalAuthId: 'supabase-user-1',
        email: 'person@example.com',
        displayName: 'Person Example',
        status: 'active',
      };
      const existingWhere = jest.fn().mockResolvedValue([]);
      const emailWhere = jest.fn().mockResolvedValue([]);
      const select = jest
        .fn()
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({ where: existingWhere }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({ where: emailWhere }),
        });
      const returning = jest.fn().mockResolvedValue([created]);
      const values = jest.fn().mockReturnValue({ returning });
      const insert = jest.fn().mockReturnValue({ values });
      const drizzle = {
        db: { select, insert },
      } as unknown as DrizzleService;
      const service = new UsersService(drizzle);

      await expect(
        service.findOrProvisionFromPrincipal({
          sub: 'supabase-user-1',
          email: ' Person@Example.com ',
          displayName: ' Person Example ',
        }),
      ).resolves.toEqual(created);

      expect(values).toHaveBeenCalledWith({
        externalAuthId: 'supabase-user-1',
        email: 'person@example.com',
        displayName: 'Person Example',
        status: 'active',
      });
    });

    it('requires an email claim when provisioning a new user', async () => {
      const where = jest.fn().mockResolvedValue([]);
      const drizzle = {
        db: {
          select: jest.fn().mockReturnValue({
            from: jest.fn().mockReturnValue({ where }),
          }),
        },
      } as unknown as DrizzleService;
      const service = new UsersService(drizzle);

      await expect(
        service.findOrProvisionFromPrincipal({ sub: 'supabase-user-1' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('search', () => {
    it('returns matching active users ordered by display name', async () => {
      const limitMock = jest.fn().mockResolvedValue([
        {
          id: 'user-1',
          displayName: 'Ann Example',
          email: 'ann@example.com',
          affiliation: 'Research University',
        },
      ]);
      const orderByMock = jest.fn().mockReturnValue({ limit: limitMock });
      const whereMock = jest.fn().mockReturnValue({ orderBy: orderByMock });
      const fromMock = jest.fn().mockReturnValue({ where: whereMock });
      const selectMock = jest.fn().mockReturnValue({ from: fromMock });
      const drizzle = {
        db: { select: selectMock },
      } as unknown as DrizzleService;

      const service = new UsersService(drizzle);

      const result = await service.search('ann');

      expect(selectMock).toHaveBeenCalled();
      expect(selectMock).toHaveBeenCalledWith(
        expect.objectContaining({
          affiliation: expect.anything(),
        }),
      );
      expect(limitMock).toHaveBeenCalledWith(8);
      expect(result).toEqual([
        {
          id: 'user-1',
          displayName: 'Ann Example',
          email: 'ann@example.com',
          affiliation: 'Research University',
        },
      ]);
    });

    it('returns an empty array without querying for a blank query', async () => {
      const selectMock = jest.fn();
      const drizzle = {
        db: { select: selectMock },
      } as unknown as DrizzleService;

      const service = new UsersService(drizzle);

      const result = await service.search('   ');

      expect(result).toEqual([]);
      expect(selectMock).not.toHaveBeenCalled();
    });

    it('respects a custom limit', async () => {
      const limitMock = jest.fn().mockResolvedValue([]);
      const orderByMock = jest.fn().mockReturnValue({ limit: limitMock });
      const whereMock = jest.fn().mockReturnValue({ orderBy: orderByMock });
      const fromMock = jest.fn().mockReturnValue({ where: whereMock });
      const selectMock = jest.fn().mockReturnValue({ from: fromMock });
      const drizzle = {
        db: { select: selectMock },
      } as unknown as DrizzleService;

      const service = new UsersService(drizzle);

      await service.search('ann', 3);

      expect(limitMock).toHaveBeenCalledWith(3);
    });
  });
});
