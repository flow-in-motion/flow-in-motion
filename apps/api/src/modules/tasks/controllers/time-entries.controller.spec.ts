import { UsersService } from '../../users/users.service';
import { TaskTimeEntriesService } from '../services/task-time-entries.service';
import { TimeEntriesController } from './time-entries.controller';

describe('TimeEntriesController', () => {
  const req = { user: { sub: 'auth-1' } } as never;

  let timeEntries: Record<
    'current' | 'start' | 'startPaper' | 'pause' | 'resume' | 'stop',
    jest.Mock
  >;
  let controller: TimeEntriesController;

  beforeEach(() => {
    timeEntries = {
      current: jest.fn().mockResolvedValue([]),
      start: jest.fn().mockResolvedValue({ id: 'entry-1' }),
      startPaper: jest.fn().mockResolvedValue({ id: 'entry-paper' }),
      pause: jest.fn().mockResolvedValue({ id: 'entry-1' }),
      resume: jest.fn().mockResolvedValue({ id: 'entry-1' }),
      stop: jest.fn().mockResolvedValue({ id: 'entry-1' }),
    };

    const users = {
      findByExternalAuthId: jest.fn().mockResolvedValue({
        id: 'user-1',
      }),
    };

    controller = new TimeEntriesController(
      timeEntries as unknown as TaskTimeEntriesService,
      users as unknown as UsersService,
    );
  });

  it('returns an empty timers array when nothing is open', async () => {
    await expect(controller.current(req)).resolves.toEqual({
      timers: [],
    });
    expect(timeEntries.current).toHaveBeenCalledWith('user-1');
  });

  it('returns all open timers', async () => {
    const timers = [{ id: 'entry-1' }, { id: 'entry-2' }];
    timeEntries.current.mockResolvedValue(timers);

    await expect(controller.current(req)).resolves.toEqual({
      timers,
    });
  });

  it('starts a task timer for the signed-in user', async () => {
    await expect(controller.start(req, { taskId: 'task-1' })).resolves.toEqual({
      timer: { id: 'entry-1' },
    });

    expect(timeEntries.start).toHaveBeenCalledWith('user-1', 'task-1');
  });

  it('starts a paper timer for the signed-in user', async () => {
    await expect(
      controller.startPaper(req, { moduleId: 'paper-1' }),
    ).resolves.toEqual({
      timer: { id: 'entry-paper' },
    });

    expect(timeEntries.startPaper).toHaveBeenCalledWith('user-1', 'paper-1');
  });

  it('passes the selected timer and signed-in user to each action', async () => {
    await expect(controller.pause(req, 'entry-1')).resolves.toEqual({
      timer: { id: 'entry-1' },
    });
    await expect(controller.resume(req, 'entry-1')).resolves.toEqual({
      timer: { id: 'entry-1' },
    });
    await expect(controller.stop(req, 'entry-1')).resolves.toEqual({
      stopped: { id: 'entry-1' },
    });

    expect(timeEntries.pause).toHaveBeenCalledWith('user-1', 'entry-1');
    expect(timeEntries.resume).toHaveBeenCalledWith('user-1', 'entry-1');
    expect(timeEntries.stop).toHaveBeenCalledWith('user-1', 'entry-1');
  });
});
