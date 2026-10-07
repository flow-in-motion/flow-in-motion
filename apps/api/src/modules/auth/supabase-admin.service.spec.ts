import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { SupabaseAdminService } from './supabase-admin.service';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

describe('SupabaseAdminService', () => {
  const getUserById = jest.fn();
  const deleteUser = jest.fn();
  const config = {
    getOrThrow: jest.fn().mockReturnValue('https://project-ref.supabase.co'),
    get: jest.fn().mockReturnValue('sb_secret_test-key'),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockReturnValue({
      auth: { admin: { getUserById, deleteUser } },
    });
  });

  it('confirms an Auth user still exists before application provisioning', async () => {
    getUserById.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    });
    const service = new SupabaseAdminService(config);

    await expect(
      service.assertUserExists('auth-user-1'),
    ).resolves.toBeUndefined();

    expect(createClient).toHaveBeenCalledWith(
      'https://project-ref.supabase.co',
      'sb_secret_test-key',
      {
        auth: { autoRefreshToken: false, persistSession: false },
      },
    );
    expect(getUserById).toHaveBeenCalledWith('auth-user-1');
  });

  it('rejects provisioning from a token whose Auth user was deleted', async () => {
    getUserById.mockResolvedValue({
      data: { user: null },
      error: new Error('User not found'),
    });
    const service = new SupabaseAdminService(config);

    await expect(
      service.assertUserExists('auth-user-1'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('deletes the Auth user through the server-only admin client', async () => {
    deleteUser.mockResolvedValue({ data: { user: null }, error: null });
    const service = new SupabaseAdminService(config);

    await expect(service.deleteUser('auth-user-1')).resolves.toBeUndefined();
    expect(deleteUser).toHaveBeenCalledWith('auth-user-1');
  });

  it('fails closed when the server-only secret key is missing', async () => {
    const missingKeyConfig = {
      getOrThrow: jest.fn().mockReturnValue('https://project-ref.supabase.co'),
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    const service = new SupabaseAdminService(missingKeyConfig);

    await expect(service.deleteUser('auth-user-1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
