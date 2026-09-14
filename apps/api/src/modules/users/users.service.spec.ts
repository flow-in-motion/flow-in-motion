import { UsersService } from './users.service';
import { DrizzleService } from '../../db/drizzle.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

describe('UsersService', () => {
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

      const service = new UsersService(
        drizzle,
        {} as HttpService,
        {} as ConfigService,
      );

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

      const service = new UsersService(
        drizzle,
        {} as HttpService,
        {} as ConfigService,
      );

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

      const service = new UsersService(
        drizzle,
        {} as HttpService,
        {} as ConfigService,
      );

      await service.search('ann', 3);

      expect(limitMock).toHaveBeenCalledWith(3);
    });
  });
});
