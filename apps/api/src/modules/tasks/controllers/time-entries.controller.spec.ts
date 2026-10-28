import { UsersService } from '../../users/users.service';
import { TaskTimeEntriesService } from '../services/task-time-entries.service';
import { TimeEntriesController } from './time-entries.controller';

describe('TimeEntriesController', () => {
  const req = { user: { sub: 'auth-1' } } as never;
  let timeEntries: Record<
    'current' | 'start' | 'pause' | 'resume' | 'stop',
    jest.Mock
  >;
  let controller: TimeEntriesController;

  beforeEach(() => {
    timeEntries = {
      current: jest.fn().mockResolvedValue(null),
      start: jest.fn().mockResolvedValue({ id: 'entry-1' }),
      pause: jest.fn().mockResolvedValue({ id: 'entry-1' }),
      resume: jest.fn().mockResolvedValue({ id: 'entry-1' }),
      stop: jest.fn().mockResolvedValue(null),
    };
    const users = {
      findByExternalAuthId: jest.fn().mockResolvedValue({ id: 'user-1' }),
    };
    controller = new TimeEntriesController(
      timeEntries as unknown as TaskTimeEntriesService,
      users as unknown as UsersService,
    );
  });

  it('wraps "no timer" so the response is still JSON', async () => {
    await expect(controller.current(req)).resolves.toEqual({ timer: null });
    await expect(controller.stop(req)).resolves.toEqual({ stopped: null });
  });

  it("acts on the signed-in person's timer", async () => {
    await expect(controller.start(req, { taskId: 'task-1' })).resolves.toEqual({
      timer: { id: 'entry-1' },
    });
    expect(timeEntries.start).toHaveBeenCalledWith('user-1', 'task-1');

    await controller.pause(req);
    await controller.resume(req);
    expect(timeEntries.pause).toHaveBeenCalledWith('user-1');
    expect(timeEntries.resume).toHaveBeenCalledWith('user-1');
  });
});
