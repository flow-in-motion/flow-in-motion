import { MyTasksController } from './my-tasks.controller';
import { TasksService } from '../services/tasks.service';
import { UsersService } from '../../users/users.service';

describe('MyTasksController', () => {
  let controller: MyTasksController;
  let tasksService: {
    listForCaller: jest.Mock;
    findOneForCaller: jest.Mock;
    updateForCaller: jest.Mock;
    deleteForCaller: jest.Mock;
  };
  let usersService: { findByExternalAuthId: jest.Mock };

  beforeEach(() => {
    tasksService = {
      listForCaller: jest.fn(),
      findOneForCaller: jest.fn(),
      updateForCaller: jest.fn(),
      deleteForCaller: jest.fn(),
    };
    usersService = {
      findByExternalAuthId: jest.fn().mockResolvedValue({ id: 'user-1' }),
    };
    controller = new MyTasksController(
      tasksService as unknown as TasksService,
      usersService as unknown as UsersService,
    );
  });

  function req() {
    return { user: { sub: 'supabase-user-1' } } as never;
  }

  it('list() resolves the caller and delegates to listForCaller', async () => {
    tasksService.listForCaller.mockResolvedValue([{ id: 'task-1' }]);
    const result = await controller.list(req());
    expect(usersService.findByExternalAuthId).toHaveBeenCalledWith(
      'supabase-user-1',
    );
    expect(tasksService.listForCaller).toHaveBeenCalledWith('user-1');
    expect(result).toEqual([{ id: 'task-1' }]);
  });

  it('findOne() delegates to findOneForCaller with the task id and caller id', async () => {
    tasksService.findOneForCaller.mockResolvedValue({ id: 'task-1' });
    const result = await controller.findOne('task-1', req());
    expect(tasksService.findOneForCaller).toHaveBeenCalledWith(
      'task-1',
      'user-1',
    );
    expect(result).toEqual({ id: 'task-1' });
  });

  it('update() delegates to updateForCaller with the task id, caller id, and body', async () => {
    tasksService.updateForCaller.mockResolvedValue({
      id: 'task-1',
      title: 'Updated',
    });
    const result = await controller.update('task-1', req(), {
      title: 'Updated',
    });
    expect(tasksService.updateForCaller).toHaveBeenCalledWith(
      'task-1',
      'user-1',
      {
        title: 'Updated',
      },
    );
    expect(result).toEqual({ id: 'task-1', title: 'Updated' });
  });

  it('remove() delegates to deleteForCaller with the task id and caller id', async () => {
    tasksService.deleteForCaller.mockResolvedValue({ id: 'task-1' });
    const result = await controller.remove('task-1', req());
    expect(tasksService.deleteForCaller).toHaveBeenCalledWith(
      'task-1',
      'user-1',
    );
    expect(result).toEqual({ id: 'task-1' });
  });
});
