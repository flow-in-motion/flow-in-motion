import { MyModulesController } from './my-modules.controller';
import { ProjectModulesService } from '../services/project-modules.service';
import { UsersService } from '../../users/users.service';
import { ConfigService } from '@nestjs/config';

describe('MyModulesController', () => {
  let controller: MyModulesController;
  let modulesService: {
    listForCaller: jest.Mock;
    findOneForCaller: jest.Mock;
    updateForCaller: jest.Mock;
    archiveForCaller: jest.Mock;
    archiveImpactForCaller: jest.Mock;
    archiveForCallerWithOptions: jest.Mock;
  };
  let usersService: { findByExternalAuthId: jest.Mock };
  let configService: {
    get: jest.Mock;
  };

  beforeEach(() => {
    modulesService = {
      listForCaller: jest.fn(),
      findOneForCaller: jest.fn(),
      updateForCaller: jest.fn(),
      archiveForCaller: jest.fn(),
      archiveImpactForCaller: jest.fn(),
      archiveForCallerWithOptions: jest.fn(),
    };
    usersService = {
      findByExternalAuthId: jest.fn().mockResolvedValue({ id: 'user-1' }),
    };
    configService = {
      get: jest.fn().mockReturnValue(20),
    };
    controller = new MyModulesController(
      modulesService as unknown as ProjectModulesService,
      usersService as unknown as UsersService,
      configService as unknown as ConfigService,
    );
  });

  function req() {
    return { user: { sub: 'supabase-user-1' } } as never;
  }

  it('list() delegates with the caller and pagination parameters', async () => {
    const response = {
      data: [{ id: 'module-1' }],
      meta: {
        page: 2,
        pageSize: 20,
        totalItems: 21,
        totalPages: 2,
      },
    };

    modulesService.listForCaller.mockResolvedValue(response);

    const result = await controller.list(req(), { page: 2 });

    expect(usersService.findByExternalAuthId).toHaveBeenCalledWith(
      'supabase-user-1',
    );

    expect(configService.get).toHaveBeenCalledWith('PAGE_SIZE', 20);

    expect(modulesService.listForCaller).toHaveBeenCalledWith('user-1', 2, 20);

    expect(result).toBe(response);
  });

  it('findOne() delegates to findOneForCaller with the module id and caller id', async () => {
    modulesService.findOneForCaller.mockResolvedValue({ id: 'module-1' });
    const result = await controller.findOne('module-1', req());
    expect(modulesService.findOneForCaller).toHaveBeenCalledWith(
      'module-1',
      'user-1',
    );
    expect(result).toEqual({ id: 'module-1' });
  });

  it('update() delegates to updateForCaller with the module id, caller id, and body', async () => {
    modulesService.updateForCaller.mockResolvedValue({
      id: 'module-1',
      title: 'Updated',
    });
    const result = await controller.update('module-1', req(), {
      title: 'Updated',
    });
    expect(modulesService.updateForCaller).toHaveBeenCalledWith(
      'module-1',
      'user-1',
      {
        title: 'Updated',
      },
    );
    expect(result).toEqual({ id: 'module-1', title: 'Updated' });
  });

  it('archive() delegates to archiveForCaller with the module id and caller id', async () => {
    modulesService.archiveForCaller.mockResolvedValue({ id: 'module-1' });
    const result = await controller.archive('module-1', req());
    expect(modulesService.archiveForCaller).toHaveBeenCalledWith(
      'module-1',
      'user-1',
    );
    expect(result).toEqual({ id: 'module-1' });
  });

  it('returns archive impact using the paper and caller ids', async () => {
    const impact = { tasks: 3, notes: 2 };
    modulesService.archiveImpactForCaller.mockResolvedValue(impact);

    await expect(controller.archiveImpact('module-1', req())).resolves.toEqual(
      impact,
    );

    expect(modulesService.archiveImpactForCaller).toHaveBeenCalledWith(
      'module-1',
      'user-1',
    );
  });

  it.each(['archive_contents', 'move_contents'] as const)(
    'passes %s options through the caller-scoped endpoint',
    async (mode) => {
      const input = {
        mode,
        ...(mode === 'move_contents'
          ? { destinationModuleId: 'module-2' }
          : {}),
      };
      const response = {
        module: { id: 'module-1' },
        warning: '14 days',
      };

      modulesService.archiveForCallerWithOptions.mockResolvedValue(response);

      await expect(
        controller.archiveWithOptions('module-1', req(), input),
      ).resolves.toEqual(response);

      expect(modulesService.archiveForCallerWithOptions).toHaveBeenCalledWith(
        'module-1',
        'user-1',
        input,
      );
    },
  );
});
