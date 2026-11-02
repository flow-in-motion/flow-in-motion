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
import { ProjectModulesRepository } from '../../project-modules/repositories/project-modules.repository';

const USER = 'user-1';

function entry(overrides: Partial<TimeEntryRow> = {}): TimeEntryRow {
  return {
    id: 'entry-1',
    taskId: 'task-1',
    moduleId: null,
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
    | 'findAllOpen'
    | 'lockOpenEntry'
    | 'lockOpenForTask'
    | 'lockOpenForPaper'
    | 'startTimer'
    | 'pause'
    | 'resume'
    | 'stop'
    | 'addManual'
    | 'findForTask'
    | 'findOwn'
    | 'updateFinished'
    | 'deleteFinished'
    | 'totalsForTasks'
    | 'findForPaper'
    | 'totalsForPapers'
    | 'activeDatesForProject',
    jest.Mock
  >;
  let tasks: { findByIdGlobal: jest.Mock };
  let taskMembers: { findByTaskAndUser: jest.Mock };
  let papers: { findByIdGlobal: jest.Mock };

  beforeEach(() => {
    repository = {
      findAllOpen: jest.fn().mockResolvedValue([]),
      lockOpenEntry: jest.fn().mockResolvedValue(undefined),
      lockOpenForTask: jest.fn().mockResolvedValue(undefined),
      lockOpenForPaper: jest.fn().mockResolvedValue(undefined),
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
      findForPaper: jest.fn().mockResolvedValue([]),
      totalsForPapers: jest.fn().mockResolvedValue(new Map()),
      activeDatesForProject: jest.fn().mockResolvedValue([]),
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
    papers = {
      findByIdGlobal: jest.fn().mockResolvedValue(undefined),
    };

    service = new TaskTimeEntriesService(
      repository as unknown as TaskTimeEntriesRepository,
      tasks as unknown as TasksRepository,
      taskMembers as unknown as TaskMembersRepository,
      papers as unknown as ProjectModulesRepository,
    );
  });

  describe('project activity', () => {
    const now = new Date('2026-11-02T12:00:00Z');
    const created = new Date('2026-10-01T12:00:00Z');

    it('continues a streak from yesterday without counting today as inactive', async () => {
      repository.activeDatesForProject.mockResolvedValue([
        '2026-11-01',
        '2026-10-31',
      ]);
      await expect(
        service.projectActivity('project-1', created, 'UTC', now),
      ).resolves.toEqual({
        currentStreakDays: 2,
        lastActiveDate: '2026-11-01',
        inactiveDays: 0,
      });
    });

    it('ends the streak after a missed day and counts full inactive days', async () => {
      repository.activeDatesForProject.mockResolvedValue(['2026-10-30']);
      await expect(
        service.projectActivity('project-1', created, 'UTC', now),
      ).resolves.toEqual({
        currentStreakDays: 0,
        lastActiveDate: '2026-10-30',
        inactiveDays: 2,
      });
    });

    it('uses the caller’s local date at a UTC midnight boundary', async () => {
      repository.activeDatesForProject.mockResolvedValue(['2026-11-02']);
      await expect(
        service.projectActivity(
          'project-1',
          created,
          'Australia/Sydney',
          new Date('2026-11-01T14:00:00Z'),
        ),
      ).resolves.toEqual({
        currentStreakDays: 1,
        lastActiveDate: '2026-11-02',
        inactiveDays: 0,
      });
    });
  });

  describe('current', () => {
    it('returns an empty list when no timers are open', async () => {
      await expect(service.current(USER)).resolves.toEqual([]);
    });

    it('reports multiple task timers independently', async () => {
      repository.findAllOpen.mockResolvedValue([
        {
          ...entry({
            id: 'entry-1',
            durationSeconds: 600,
            runningSeconds: 120,
          }),
          taskTitle: 'Literature review',
          taskDisplayId: 'TSK-0007',
        },
        {
          ...entry({
            id: 'entry-2',
            taskId: 'task-2',
            durationSeconds: 300,
            runningSince: null,
            runningSeconds: 0,
          }),
          taskTitle: 'Draft introduction',
          taskDisplayId: 'TSK-0008',
        },
      ]);

      await expect(service.current(USER)).resolves.toEqual([
        expect.objectContaining({
          id: 'entry-1',
          taskId: 'task-1',
          isRunning: true,
          elapsedSeconds: 720,
        }),
        expect.objectContaining({
          id: 'entry-2',
          taskId: 'task-2',
          isRunning: false,
          elapsedSeconds: 300,
        }),
      ]);
    });

    it('stops an inaccessible timer while retaining accessible ones', async () => {
      repository.findAllOpen.mockResolvedValue([
        {
          ...entry(),
          taskTitle: null,
          taskDisplayId: null,
        },
        {
          ...entry({ id: 'entry-2', taskId: 'task-2' }),
          taskTitle: 'Accessible task',
          taskDisplayId: null,
        },
      ]);

      await expect(service.current(USER)).resolves.toEqual([
        expect.objectContaining({ id: 'entry-2' }),
      ]);

      expect(repository.stop).toHaveBeenCalledTimes(1);
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

    it('starts a task without stopping another task timer', async () => {
      repository.findAllOpen.mockResolvedValue([
        {
          ...entry({ id: 'entry-other', taskId: 'task-other' }),
          taskTitle: 'Other task',
          taskDisplayId: null,
        },
      ]);

      await service.start(USER, 'task-1');

      expect(repository.lockOpenForTask).toHaveBeenCalledWith('task-1', USER);
      expect(repository.startTimer).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        taskId: 'task-1',
        userId: USER,
      });
      expect(repository.stop).not.toHaveBeenCalled();
    });

    it('resumes a paused timer on the same task instead of starting over', async () => {
      repository.lockOpenForTask.mockResolvedValue(
        entry({ runningSince: null }),
      );

      await service.start(USER, 'task-1');

      expect(repository.resume).toHaveBeenCalledWith('entry-1', USER);
      expect(repository.startTimer).not.toHaveBeenCalled();
    });

    it('leaves a timer already running on the same task alone', async () => {
      repository.lockOpenForTask.mockResolvedValue(entry());

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
      await expect(service.pause(USER, 'entry-1')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.resume(USER, 'entry-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('pauses a running timer', async () => {
      repository.lockOpenEntry.mockResolvedValue(entry());
      await service.pause(USER, 'entry-1');
      expect(repository.pause).toHaveBeenCalledWith('entry-1', USER);
    });

    it("doesn't pause a paused timer again", async () => {
      repository.lockOpenEntry.mockResolvedValue(entry({ runningSince: null }));
      await service.pause(USER, 'entry-1');
      expect(repository.pause).not.toHaveBeenCalled();
    });

    it('resumes a paused timer', async () => {
      repository.lockOpenEntry.mockResolvedValue(entry({ runningSince: null }));
      await service.resume(USER, 'entry-1');
      expect(repository.resume).toHaveBeenCalledWith('entry-1', USER);
    });
  });

  describe('stop', () => {
    it('rejects a missing or inaccessible open timer', async () => {
      await expect(service.stop(USER, 'entry-1')).rejects.toThrow(
        NotFoundException,
      );

      expect(repository.lockOpenEntry).toHaveBeenCalledWith('entry-1', USER);
      expect(repository.stop).not.toHaveBeenCalled();
    });

    it('returns the finished entry', async () => {
      repository.lockOpenEntry.mockResolvedValue(entry());
      repository.stop.mockResolvedValue(
        entry({
          endedAt: new Date('2026-10-28T01:30:00Z'),
          runningSince: null,
          durationSeconds: 5400,
        }),
      );

      await expect(service.stop(USER, 'entry-1')).resolves.toEqual(
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
  describe('paper time tracking', () => {
    beforeEach(() => {
      papers.findByIdGlobal.mockResolvedValue({
        id: 'paper-1',
        tenantId: 'tenant-1',
        shortTitle: 'Burnout contagion',
        title: 'Burnout contagion in research teams',
        displayId: 'PAP-0001',
      });
    });

    it('starts a paper without stopping an existing task timer', async () => {
      repository.findAllOpen.mockResolvedValue([
        {
          ...entry(),
          taskTitle: 'Existing task',
          taskDisplayId: null,
        },
      ]);

      await service.startPaper(USER, 'paper-1');

      expect(repository.startTimer).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        moduleId: 'paper-1',
        userId: USER,
      });
      expect(repository.stop).not.toHaveBeenCalled();
    });

    it('starts a task without stopping an existing paper timer', async () => {
      repository.findAllOpen.mockResolvedValue([
        {
          ...entry({
            id: 'entry-paper',
            taskId: null,
            moduleId: 'paper-1',
          }),
          taskTitle: null,
          taskDisplayId: null,
          paperTitle: 'Burnout contagion',
          paperDisplayId: 'PAP-0001',
        },
      ]);

      await service.start(USER, 'task-1');

      expect(repository.startTimer).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        taskId: 'task-1',
        userId: USER,
      });
      expect(repository.stop).not.toHaveBeenCalled();
    });

    it('returns two paper timers running simultaneously', async () => {
      papers.findByIdGlobal.mockImplementation((id: string) =>
        Promise.resolve({
          id,
          tenantId: 'tenant-1',
          shortTitle: id,
          title: null,
          displayId: null,
        }),
      );

      repository.findAllOpen.mockResolvedValue([
        {
          ...entry({
            id: 'entry-paper-1',
            taskId: null,
            moduleId: 'paper-1',
          }),
          taskTitle: null,
          taskDisplayId: null,
        },
        {
          ...entry({
            id: 'entry-paper-2',
            taskId: null,
            moduleId: 'paper-2',
          }),
          taskTitle: null,
          taskDisplayId: null,
        },
      ]);

      await expect(service.current(USER)).resolves.toEqual([
        expect.objectContaining({
          moduleId: 'paper-1',
          isRunning: true,
        }),
        expect.objectContaining({
          moduleId: 'paper-2',
          isRunning: true,
        }),
      ]);

      expect(repository.stop).not.toHaveBeenCalled();
    });

    it('resumes the same paused paper timer without creating another entry', async () => {
      repository.lockOpenForPaper.mockResolvedValue(
        entry({
          taskId: null,
          moduleId: 'paper-1',
          runningSince: null,
        }),
      );

      await service.startPaper(USER, 'paper-1');

      expect(repository.resume).toHaveBeenCalledWith('entry-1', USER);
      expect(repository.startTimer).not.toHaveBeenCalled();
      expect(repository.stop).not.toHaveBeenCalled();
    });

    it('rejects an inaccessible paper before stopping the current timer', async () => {
      papers.findByIdGlobal.mockResolvedValue(undefined);
      repository.lockOpenEntry.mockResolvedValue(entry());

      await expect(service.startPaper(USER, 'paper-1')).rejects.toThrow(
        NotFoundException,
      );

      expect(repository.stop).not.toHaveBeenCalled();
      expect(repository.startTimer).not.toHaveBeenCalled();
    });

    it('returns the paper title and elapsed time for the current timer', async () => {
      repository.findAllOpen.mockResolvedValue([
        {
          ...entry({
            taskId: null,
            moduleId: 'paper-1',
            durationSeconds: 600,
            runningSeconds: 120,
          }),
          taskTitle: null,
          taskDisplayId: null,
          paperTitle: 'Burnout contagion',
          paperDisplayId: 'PAP-0001',
        },
      ]);

      await expect(service.current(USER)).resolves.toEqual([
        expect.objectContaining({
          taskId: null,
          moduleId: 'paper-1',
          paperTitle: 'Burnout contagion',
          paperDisplayId: 'PAP-0001',
          elapsedSeconds: 720,
        }),
      ]);
    });

    it('stops a paper timer when the paper is no longer accessible', async () => {
      papers.findByIdGlobal.mockResolvedValue(undefined);
      repository.findAllOpen.mockResolvedValue([
        {
          ...entry({ taskId: null, moduleId: 'paper-1' }),
          taskTitle: null,
          taskDisplayId: null,
          paperTitle: null,
          paperDisplayId: null,
        },
      ]);

      await expect(service.current(USER)).resolves.toEqual([]);

      expect(repository.stop).toHaveBeenCalledWith('entry-1', USER);
    });

    it('does not resume a paper timer after access is lost', async () => {
      papers.findByIdGlobal.mockResolvedValue(undefined);
      repository.lockOpenEntry.mockResolvedValue(
        entry({
          taskId: null,
          moduleId: 'paper-1',
          runningSince: null,
        }),
      );

      await expect(service.resume(USER, 'entry-1')).rejects.toThrow(
        NotFoundException,
      );

      expect(repository.resume).not.toHaveBeenCalled();
    });

    it('returns direct paper time separately from linked task time', async () => {
      repository.findForPaper.mockResolvedValue([
        entry({
          taskId: null,
          moduleId: 'paper-1',
          endedAt: new Date(),
          runningSince: null,
          durationSeconds: 900,
        }),
      ]);
      repository.totalsForPapers.mockResolvedValue(
        new Map([['paper-1', { totalSeconds: 4500, mySeconds: 900 }]]),
      );

      await expect(service.listForPaper('paper-1', USER)).resolves.toEqual({
        moduleId: 'paper-1',
        entries: [
          expect.objectContaining({
            taskId: null,
            moduleId: 'paper-1',
            durationSeconds: 900,
          }),
        ],
        mySeconds: 900,
        totalSeconds: 4500,
      });

      expect(repository.totalsForTasks).not.toHaveBeenCalled();
    });

    it('adds manual time against the paper', async () => {
      repository.addManual.mockResolvedValue(
        entry({
          taskId: null,
          moduleId: 'paper-1',
          source: 'manual',
          endedAt: new Date(),
          runningSince: null,
        }),
      );

      await service.addManualForPaper('paper-1', USER, {
        startedAt: '2026-10-27T09:00:00+11:00',
        minutes: 90,
        note: '  Revising the discussion  ',
      });

      expect(repository.addManual).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        moduleId: 'paper-1',
        userId: USER,
        startedAt: new Date('2026-10-27T09:00:00+11:00'),
        durationSeconds: 5400,
        note: 'Revising the discussion',
      });
    });
  });
});
