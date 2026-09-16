import { MyProjectsController } from './my-projects.controller';
import { ProjectsService } from '../services/projects.service';
import { UsersService } from '../../users/users.service';
import { ConfigService } from '@nestjs/config';

describe('MyProjectsController', () => {
  let controller: MyProjectsController;
  let projectsService: {
    listForCaller: jest.Mock;
    findOneForCaller: jest.Mock;
    updateForCaller: jest.Mock;
    archiveForCaller: jest.Mock;
  };
  let usersService: { findByExternalAuthId: jest.Mock };
  let configService: {
    get: jest.Mock;
  };

  beforeEach(() => {
    projectsService = {
      listForCaller: jest.fn(),
      findOneForCaller: jest.fn(),
      updateForCaller: jest.fn(),
      archiveForCaller: jest.fn(),
    };
    usersService = {
      findByExternalAuthId: jest.fn().mockResolvedValue({ id: 'user-1' }),
    };
    configService = {
      get: jest.fn().mockReturnValue(20),
    };
    controller = new MyProjectsController(
      projectsService as unknown as ProjectsService,
      usersService as unknown as UsersService,
      configService as unknown as ConfigService,
    );
  });

  function req() {
    return { user: { sub: 'supabase-user-1' } } as never;
  }

  it('list() delegates with the caller and pagination parameters', async () => {
    const response = {
      data: [{ id: 'project-1' }],
      meta: {
        page: 2,
        pageSize: 20,
        totalItems: 21,
        totalPages: 2,
      },
    };

    projectsService.listForCaller.mockResolvedValue(response);

    const result = await controller.list(req(), { page: 2 });

    expect(usersService.findByExternalAuthId).toHaveBeenCalledWith(
      'supabase-user-1',
    );

    expect(configService.get).toHaveBeenCalledWith('PAGE_SIZE', 20);

    expect(projectsService.listForCaller).toHaveBeenCalledWith('user-1', 2, 20);

    expect(result).toBe(response);
  });

  it('findOne() delegates to findOneForCaller with the project id and caller id', async () => {
    projectsService.findOneForCaller.mockResolvedValue({ id: 'project-1' });
    const result = await controller.findOne('project-1', req());
    expect(projectsService.findOneForCaller).toHaveBeenCalledWith(
      'project-1',
      'user-1',
    );
    expect(result).toEqual({ id: 'project-1' });
  });

  it('update() delegates to updateForCaller with the project id, caller id, and body', async () => {
    projectsService.updateForCaller.mockResolvedValue({
      id: 'project-1',
      title: 'Updated',
    });
    const result = await controller.update('project-1', req(), {
      title: 'Updated',
    });
    expect(projectsService.updateForCaller).toHaveBeenCalledWith(
      'project-1',
      'user-1',
      {
        title: 'Updated',
      },
    );
    expect(result).toEqual({ id: 'project-1', title: 'Updated' });
  });

  it('archive() delegates to archiveForCaller with the project id and caller id', async () => {
    projectsService.archiveForCaller.mockResolvedValue({ id: 'project-1' });
    const result = await controller.archive('project-1', req());
    expect(projectsService.archiveForCaller).toHaveBeenCalledWith(
      'project-1',
      'user-1',
    );
    expect(result).toEqual({ id: 'project-1' });
  });
});
