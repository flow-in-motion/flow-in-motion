import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { TaskMembersRepository } from '../../task-members/repositories/task-members.repository';
import {
  TaskTimeEntriesRepository,
  type TimeEntryRow,
} from '../repositories/task-time-entries.repository';
import { TasksRepository } from '../repositories/tasks.repository';
import { TaskTimeEntriesService } from './task-time-entries.service';

const USER = 'user-1';

function entry(overrides: Partial<TimeEntryRow> = {}): TimeEntryRow {
  return {
    id: 'entry-1',
    taskId: 'task-1',
    tenantId: 'tenant-1',
    userId: USER,
    source: 'timer',
    startedAt: new Date('2026-10-28T00:00:00Z'),
    endedAt: null,
    runningSince: new Date('2026-10-28T00:00:00Z'),
    durationSeconds: 0,
    note: null,
    runningSeconds: 0,
    ...overrides,
  };
}

describe('TaskTimeEntriesService', () => {
  let service: TaskTimeEntriesService;
  let repository: Record<
    | 'findOpen'
    | 'lockOpen'
    | 'startTimer'
    | 'pause'
    | 'resume'
    | 'stop'
    | 'addManual'
    | 'findForTask'
    | 'findOwn'
    | 'updateFinished'
    | 'deleteFinished'
    | 'totalsForTasks',
    jest.Mock
  >;
  let tasks: { findByIdGlobal: jest.Mock };
  let taskMembers: { findByTaskAndUser: jest.Mock };

  beforeEach(() => {
    repository = {
      findOpen: jest.fn().mockResolvedValue(undefined),
      lockOpen: jest.fn().mockResolvedValue(undefined),
      startTimer: jest.fn().mockResolvedValue({ id: 'entry-new' }),
      pause: jest.fn(),
      resume: jest.fn(),
      stop: jest.fn(),
      addManual: jest.fn(),
      findForTask: jest.fn().mockResolvedValue([]),
      findOwn: jest.fn(),
      updateFinished: jest.fn(),
      deleteFinished: jest.fn(),
      totalsForTasks: jest.fn().mockResolvedValue(new Map()),
    };
    tasks = {
      findByIdGlobal: jest.fn().mockResolvedValue({
        id: 'task-1',
        tenantId: 'tenant-1',
        createdBy: USER,
        estimatedHours: '6.00',
      }),
    };
    taskMembers = { findByTaskAndUser: jest.fn().mockResolvedValue(undefined) };

    service = new TaskTimeEntriesService(
      repository as unknown as TaskTimeEntriesRepository,
      tasks as unknown as TasksRepository,
      taskMembers as unknown as TaskMembersRepository,
    );
  });

  describe('current', () => {
    it('is null when no timer is open', async () => {
      await expect(service.current(USER)).resolves.toBeNull();
    });

    it('reports the task and the time so far', async () => {
      repository.findOpen.mockResolvedValue({
        ...entry({ durationSeconds: 600, runningSeconds: 120 }),
        taskTitle: 'Literature review',
        taskDisplayId: 'TSK-0007',
      });

      await expect(service.current(USER)).resolves.toEqual(
        expect.objectContaining({
          taskId: 'task-1',
          taskTitle: 'Literature review',
          taskDisplayId: 'TSK-0007',
          isRunning: true,
          durationSeconds: 600,
          runningSeconds: 120,
          elapsedSeconds: 720,
        }),
      );
    });

    it("doesn't count a running stretch while paused", async () => {
      repository.findOpen.mockResolvedValue({
        ...entry({
          runningSince: null,
          durationSeconds: 600,
          runningSeconds: 0,
        }),
        taskTitle: 'Literature review',
        taskDisplayId: null,
      });

      await expect(service.current(USER)).resolves.toEqual(
        expect.objectContaining({ isRunning: false, elapsedSeconds: 600 }),
      );
    });

    it('stops a timer on a task the person can no longer see', async () => {
      repository.findOpen.mockResolvedValue({
        ...entry(),
        taskTitle: null,
        taskDisplayId: null,
      });

      await expect(service.current(USER)).resolves.toBeNull();
      expect(repository.stop).toHaveBeenCalledWith('entry-1', USER);
    });
  });

  describe('start', () => {
    it("refuses a task the person didn't create and wasn't added to", async () => {
      tasks.findByIdGlobal.mockResolvedValue({
        id: 'task-1',
        tenantId: 'tenant-1',
        createdBy: 'someone-else',
      });

      await expect(service.start(USER, 'task-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.startTimer).not.toHaveBeenCalled();
    });

    it('lets a task member start a timer, in the task’s workspace', async () => {
      tasks.findByIdGlobal.mockResolvedValue({
        id: 'task-1',
        tenantId: 'tenant-9',
        createdBy: 'someone-else',
      });
      taskMembers.findByTaskAndUser.mockResolvedValue({ id: 'member-1' });

      await service.start(USER, 'task-1');

      expect(repository.startTimer).toHaveBeenCalledWith({
        tenantId: 'tenant-9',
        taskId: 'task-1',
        userId: USER,
      });
    });

    it('stops the timer on another task first', async () => {
      repository.lockOpen.mockResolvedValue(
        entry({ id: 'entry-old', taskId: 'task-other' }),
      );

      await service.start(USER, 'task-1');

      expect(repository.stop).toHaveBeenCalledWith('entry-old', USER);
      expect(repository.startTimer).toHaveBeenCalled();
      const [stoppedAt] = repository.stop.mock.invocationCallOrder;
      const [startedAt] = repository.startTimer.mock.invocationCallOrder;
      expect(stoppedAt).toBeLessThan(startedAt ?? 0);
    });

    it('resumes a paused timer on the same task instead of starting over', async () => {
      repository.lockOpen.mockResolvedValue(entry({ runningSince: null }));

      await service.start(USER, 'task-1');

      expect(repository.resume).toHaveBeenCalledWith('entry-1', USER);
      expect(repository.startTimer).not.toHaveBeenCalled();
    });

    it('leaves a timer already running on the same task alone', async () => {
      repository.lockOpen.mockResolvedValue(entry());

      await service.start(USER, 'task-1');

      expect(repository.resume).not.toHaveBeenCalled();
      expect(repository.stop).not.toHaveBeenCalled();
      expect(repository.startTimer).not.toHaveBeenCalled();
    });

    it('reports a clash when another timer was started at the same moment', async () => {
      repository.startTimer.mockRejectedValue(
        Object.assign(new Error('duplicate key'), { code: '23505' }),
      );

      await expect(service.start(USER, 'task-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('pause and resume', () => {
    it('needs an open timer', async () => {
      await expect(service.pause(USER)).rejects.toThrow(NotFoundException);
      await expect(service.resume(USER)).rejects.toThrow(NotFoundException);
    });

    it('pauses a running timer', async () => {
      repository.lockOpen.mockResolvedValue(entry());
      await service.pause(USER);
      expect(repository.pause).toHaveBeenCalledWith('entry-1', USER);
    });

    it("doesn't pause a paused timer again", async () => {
      repository.lockOpen.mockResolvedValue(entry({ runningSince: null }));
      await service.pause(USER);
      expect(repository.pause).not.toHaveBeenCalled();
    });

    it('resumes a paused timer', async () => {
      repository.lockOpen.mockResolvedValue(entry({ runningSince: null }));
      await service.resume(USER);
      expect(repository.resume).toHaveBeenCalledWith('entry-1', USER);
    });
  });

  describe('stop', () => {
    it('is null when nothing is open', async () => {
      await expect(service.stop(USER)).resolves.toBeNull();
    });

    it('returns the finished entry', async () => {
      repository.lockOpen.mockResolvedValue(entry());
      repository.stop.mockResolvedValue(
        entry({
          endedAt: new Date('2026-10-28T01:30:00Z'),
          runningSince: null,
          durationSeconds: 5400,
        }),
      );

      await expect(service.stop(USER)).resolves.toEqual(
        expect.objectContaining({
          id: 'entry-1',
          isOpen: false,
          isRunning: false,
          durationSeconds: 5400,
          runningSeconds: 0,
        }),
      );
    });
  });

  describe('listForTask', () => {
    it("lists the caller's entries with the task's totals", async () => {
      repository.findForTask.mockResolvedValue([
        entry({
          endedAt: new Date(),
          runningSince: null,
          durationSeconds: 900,
        }),
      ]);
      repository.totalsForTasks.mockResolvedValue(
        new Map([['task-1', { totalSeconds: 4500, mySeconds: 900 }]]),
      );

      await expect(service.listForTask('task-1', USER)).resolves.toEqual({
        taskId: 'task-1',
        estimatedHours: '6.00',
        entries: [expect.objectContaining({ durationSeconds: 900 })],
        mySeconds: 900,
        totalSeconds: 4500,
      });
      expect(repository.findForTask).toHaveBeenCalledWith('task-1', USER);
    });

    it('hides tasks the caller can’t see', async () => {
      tasks.findByIdGlobal.mockResolvedValue(undefined);
      await expect(service.listForTask('task-1', USER)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('adding time by hand', () => {
    it('stores minutes as seconds and tidies the note', async () => {
      repository.addManual.mockResolvedValue(
        entry({ source: 'manual', endedAt: new Date(), runningSince: null }),
      );

      await service.addManual('task-1', USER, {
        startedAt: '2026-10-27T09:00:00+11:00',
        minutes: 90,
        note: '  Coded interviews  ',
      });

      expect(repository.addManual).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        taskId: 'task-1',
        userId: USER,
        startedAt: new Date('2026-10-27T09:00:00+11:00'),
        durationSeconds: 5400,
        note: 'Coded interviews',
      });
    });

    it('refuses time dated well into the future', async () => {
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await expect(
        service.addManual('task-1', USER, {
          startedAt: nextWeek.toISOString(),
          minutes: 30,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.addManual).not.toHaveBeenCalled();
    });
  });

  describe('corrections', () => {
    it("can't change someone else's entry", async () => {
      repository.findOwn.mockResolvedValue(undefined);
      await expect(
        service.update('entry-1', USER, { minutes: 10 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('asks to stop the timer before changing it', async () => {
      repository.findOwn.mockResolvedValue(entry());
      await expect(
        service.update('entry-1', USER, { minutes: 10 }),
      ).rejects.toThrow(BadRequestException);
      await expect(service.remove('entry-1', USER)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('keeps the fields that were not changed', async () => {
      const finished = entry({
        endedAt: new Date('2026-10-28T01:00:00Z'),
        runningSince: null,
        durationSeconds: 3600,
        note: 'Analysis',
      });
      repository.findOwn.mockResolvedValue(finished);
      repository.updateFinished.mockResolvedValue({
        ...finished,
        durationSeconds: 2700,
      });

      await service.update('entry-1', USER, { minutes: 45 });

      expect(repository.updateFinished).toHaveBeenCalledWith('entry-1', USER, {
        startedAt: finished.startedAt,
        durationSeconds: 2700,
        note: 'Analysis',
      });
    });

    it('clears a note that is emptied', async () => {
      const finished = entry({
        endedAt: new Date('2026-10-28T01:00:00Z'),
        runningSince: null,
        durationSeconds: 3600,
        note: 'Analysis',
      });
      repository.findOwn.mockResolvedValue(finished);
      repository.updateFinished.mockResolvedValue(finished);

      await service.update('entry-1', USER, { note: '   ' });

      expect(repository.updateFinished).toHaveBeenCalledWith(
        'entry-1',
        USER,
        expect.objectContaining({ note: null }),
      );
    });

    it('deletes a finished entry', async () => {
      repository.findOwn.mockResolvedValue(
        entry({ endedAt: new Date(), runningSince: null }),
      );
      repository.deleteFinished.mockResolvedValue({
        id: 'entry-1',
        taskId: 'task-1',
      });

      await expect(service.remove('entry-1', USER)).resolves.toEqual({
        id: 'entry-1',
        taskId: 'task-1',
      });
    });
  });
});
