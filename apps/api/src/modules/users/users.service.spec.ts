import { UsersService } from './users.service';
import { DrizzleService } from '../../db/drizzle.service';
import { UnauthorizedException } from '@nestjs/common';
import { SupabaseAdminService } from '../auth/supabase-admin.service';

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
      const assertUserExists = jest.fn().mockResolvedValue(undefined);
      const supabaseAdmin = {
        assertUserExists,
      } as unknown as SupabaseAdminService;
      const service = new UsersService(drizzle, supabaseAdmin);

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
      expect(assertUserExists).toHaveBeenCalledWith('supabase-user-1');
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
      const supabaseAdmin = {
        assertUserExists: jest.fn().mockResolvedValue(undefined),
      } as unknown as SupabaseAdminService;
      const service = new UsersService(drizzle, supabaseAdmin);

      await expect(
        service.findOrProvisionFromPrincipal({ sub: 'supabase-user-1' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('search', () => {
    it('maps registered users and reusable invitation contacts', async () => {
      const executeMock = jest.fn().mockResolvedValue({
        rows: [
          {
            id: 'user-1',
            display_name: 'Ann Registered',
            email: 'ann@example.com',
            affiliation: 'Research University',
          },
          {
            id: 'contact:sam@example.com',
            display_name: 'Sam Invited',
            email: 'sam@example.com',
            affiliation: 'Example Institute',
          },
        ],
      });
      const drizzle = {
        db: { execute: executeMock },
      } as unknown as DrizzleService;

      const service = new UsersService(drizzle, {} as SupabaseAdminService);

      const result = await service.search('example', 'user-owner');

      expect(executeMock).toHaveBeenCalledTimes(1);
      expect(result).toEqual([
        {
          id: 'user-1',
          displayName: 'Ann Registered',
          email: 'ann@example.com',
          affiliation: 'Research University',
        },
        {
          id: 'contact:sam@example.com',
          displayName: 'Sam Invited',
          email: 'sam@example.com',
          affiliation: 'Example Institute',
        },
      ]);
    });

    it('returns an empty array without querying for a blank query', async () => {
      const executeMock = jest.fn();
      const drizzle = {
        db: { execute: executeMock },
      } as unknown as DrizzleService;

      const service = new UsersService(drizzle, {} as SupabaseAdminService);

      const result = await service.search('   ', 'user-owner');

      expect(result).toEqual([]);
      expect(executeMock).not.toHaveBeenCalled();
    });

    it('supports a custom result limit', async () => {
      const executeMock = jest.fn().mockResolvedValue({ rows: [] });
      const drizzle = {
        db: { execute: executeMock },
      } as unknown as DrizzleService;

      const service = new UsersService(drizzle, {} as SupabaseAdminService);

      await service.search('ann', 'user-owner', 3);

      expect(executeMock).toHaveBeenCalledTimes(1);
    });
  });
});
