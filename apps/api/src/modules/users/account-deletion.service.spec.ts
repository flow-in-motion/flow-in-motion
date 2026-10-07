import { NotFoundException } from '@nestjs/common';
import { DrizzleService } from '../../db/drizzle.service';
import { SupabaseAdminService } from '../auth/supabase-admin.service';
import { AccountDeletionService } from './account-deletion.service';

describe('AccountDeletionService', () => {
  function setup(deletedUser: { id: string } | null = { id: 'user-1' }) {
    const invitationWhere = jest.fn().mockResolvedValue(undefined);
    const returning = jest
      .fn()
      .mockResolvedValue(deletedUser ? [deletedUser] : []);
    const userWhere = jest.fn().mockReturnValue({ returning });
    const deleteQuery = jest
      .fn()
      .mockReturnValueOnce({ where: invitationWhere })
      .mockReturnValueOnce({ where: invitationWhere })
      .mockReturnValueOnce({ where: invitationWhere })
      .mockReturnValueOnce({ where: invitationWhere })
      .mockReturnValueOnce({ where: invitationWhere })
      .mockReturnValueOnce({ where: userWhere });
    const drizzle = {
      db: { delete: deleteQuery },
    } as unknown as DrizzleService;
    const deleteAuthUser = jest.fn().mockResolvedValue(undefined);
    const supabaseAdmin = {
      deleteUser: deleteAuthUser,
    } as unknown as SupabaseAdminService;

    return {
      service: new AccountDeletionService(drizzle, supabaseAdmin),
      invitationWhere,
      returning,
      deleteAuthUser,
      supabaseAdmin,
    };
  }

  it('removes invitation PII and application data before the Auth identity', async () => {
    const { service, invitationWhere, returning, deleteAuthUser } = setup();

    await service.deleteAccount({
      id: 'user-1',
      email: 'person@example.com',
      externalAuthId: 'auth-user-1',
    });

    expect(invitationWhere).toHaveBeenCalledTimes(5);
    expect(returning).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.anything() }),
    );
    expect(deleteAuthUser).toHaveBeenCalledWith('auth-user-1');
    expect(returning.mock.invocationCallOrder[0]).toBeLessThan(
      deleteAuthUser.mock.invocationCallOrder[0]!,
    );
  });

  it('does not touch Supabase Auth when the application user is missing', async () => {
    const { service, deleteAuthUser } = setup(null);

    await expect(
      service.deleteAccount({
        id: 'missing-user',
        email: 'person@example.com',
        externalAuthId: 'auth-user-1',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(deleteAuthUser).not.toHaveBeenCalled();
  });
});
