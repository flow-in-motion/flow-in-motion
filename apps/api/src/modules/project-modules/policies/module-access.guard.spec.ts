import { ForbiddenException } from '@nestjs/common';
import { ModuleAccessGuard } from './module-access.guard';
import { UsersService } from '../../users/users.service';
import { ProjectModulesRepository } from '../repositories/project-modules.repository';

function context(params: { tenantId?: string; moduleId?: string }) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: { sub: 'external-user-1' }, params }),
    }),
  } as never;
}

describe('ModuleAccessGuard', () => {
  const usersService = {
    findByExternalAuthId: jest.fn().mockResolvedValue({ id: 'user-1' }),
  };
  const modulesRepository = {
    checkAccessForGuard: jest.fn(),
  };
  const guard = new ModuleAccessGuard(
    usersService as unknown as UsersService,
    modulesRepository as unknown as ProjectModulesRepository,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the pre-context access function and permits an accessible module', async () => {
    modulesRepository.checkAccessForGuard.mockResolvedValue(true);

    await expect(
      guard.canActivate(
        context({ tenantId: 'tenant-1', moduleId: 'module-1' }),
      ),
    ).resolves.toBe(true);
    expect(modulesRepository.checkAccessForGuard).toHaveBeenCalledWith(
      'tenant-1',
      'module-1',
      'user-1',
    );
  });

  it('rejects a module the caller cannot access', async () => {
    modulesRepository.checkAccessForGuard.mockResolvedValue(false);

    await expect(
      guard.canActivate(
        context({ tenantId: 'tenant-1', moduleId: 'module-1' }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects requests without complete module context', async () => {
    await expect(
      guard.canActivate(context({ tenantId: 'tenant-1' })),
    ).rejects.toThrow('Tenant and module context are required');
  });
});
