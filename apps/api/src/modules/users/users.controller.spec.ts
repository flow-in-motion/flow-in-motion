import { NotFoundException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: {
    search: jest.Mock;
    findOrProvisionFromPrincipal: jest.Mock;
  };

  beforeEach(() => {
    usersService = {
      search: jest.fn(),
      findOrProvisionFromPrincipal: jest.fn(),
    };
    controller = new UsersController(usersService as unknown as UsersService);
  });

  describe('search', () => {
    it('searches using the authenticated application user ID', async () => {
      usersService.findOrProvisionFromPrincipal.mockResolvedValue({
        id: 'user-owner',
        email: 'owner@example.com',
      });
      usersService.search.mockResolvedValue([
        {
          id: 'user-1',
          displayName: 'Ann Example',
          email: 'ann@example.com',
        },
      ]);

      const req = {
        user: {
          sub: 'supabase-owner',
          email: 'owner@example.com',
        },
      } as any;

      const result = await controller.search({ q: 'ann' }, req);

      expect(usersService.findOrProvisionFromPrincipal).toHaveBeenCalledWith(
        req.user,
      );
      expect(usersService.search).toHaveBeenCalledWith('ann', 'user-owner');
      expect(result).toEqual([
        {
          id: 'user-1',
          displayName: 'Ann Example',
          email: 'ann@example.com',
        },
      ]);
    });

    it('does not search when the authenticated user cannot be provisioned', async () => {
      usersService.findOrProvisionFromPrincipal.mockResolvedValue(undefined);

      const req = {
        user: {
          sub: 'supabase-owner',
          email: 'owner@example.com',
        },
      } as any;

      await expect(controller.search({ q: 'ann' }, req)).rejects.toBeInstanceOf(
        NotFoundException,
      );

      expect(usersService.search).not.toHaveBeenCalled();
    });
  });
});
