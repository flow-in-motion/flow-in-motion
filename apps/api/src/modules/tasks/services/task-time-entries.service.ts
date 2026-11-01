import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TaskMembersRepository } from '../../task-members/repositories/task-members.repository';
import { CreateTimeEntryDto, UpdateTimeEntryDto } from '../dto/time-entry.dto';
import {
  TaskTimeEntriesRepository,
  type OpenTimerRow,
  type TimeEntryRow,
} from '../repositories/task-time-entries.repository';
import { TasksRepository } from '../repositories/tasks.repository';
import { ProjectModulesRepository } from '../../project-modules/repositories/project-modules.repository';

/** Time added by hand can't be dated more than a day ahead (time zones). */
const MAX_FUTURE_MS = 24 * 60 * 60 * 1000;

function isUniqueViolation(error: unknown) {
  const candidates = [error, (error as { cause?: unknown })?.cause];
  return candidates.some(
    (candidate) =>
      typeof candidate === 'object' &&
      candidate !== null &&
      (candidate as { code?: unknown }).code === '23505',
  );
}

function entryResponse(row: TimeEntryRow) {
  const isOpen = row.endedAt === null;
  const isRunning = isOpen && row.runningSince !== null;
  return {
    id: row.id,
    taskId: row.taskId,
    moduleId: row.moduleId,
    source: row.source as 'timer' | 'manual',
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    note: row.note,
    isOpen,
    isRunning,
    /** Logged so far, not counting the stretch running right now. */
    durationSeconds: row.durationSeconds,
    /** The stretch running right now (0 when paused or stopped). */
    runningSeconds: isRunning ? row.runningSeconds : 0,
  };
}

/**
 * Logging time on tasks: one timer per person (Start, Pause, Resume, Stop),
 * plus time added or corrected by hand. Each person sees and edits only their
 * own entries; a task's total includes everyone's.
 */
@Injectable()
export class TaskTimeEntriesService {
  constructor(
    private readonly repository: TaskTimeEntriesRepository,
    private readonly tasks: TasksRepository,
    private readonly taskMembers: TaskMembersRepository,
    private readonly papers: ProjectModulesRepository,
  ) {}

  /** A task the caller created or was added to, or 404. */
  private async accessibleTask(taskId: string, userId: string) {
    const task = await this.tasks.findByIdGlobal(taskId);
    if (task) {
      if (task.createdBy === userId) return task;
      const membership = await this.taskMembers.findByTaskAndUser(
        task.tenantId,
        task.id,
        userId,
      );
      if (membership) return task;
    }
    throw new NotFoundException('Task not found');
  }

  /**
   * Runs under the caller's request context. The modules table's RLS
   * enforces access; the repository also excludes archived papers/projects.
   */
  private async accessiblePaper(moduleId: string) {
    const paper = await this.papers.findByIdGlobal(moduleId);
    if (!paper) throw new NotFoundException('Paper not found');
    return paper;
  }

  /** Formats an open timer and stops it if access has been lost. */
  private async openTimerResponse(open: OpenTimerRow, userId: string) {
    if (open.moduleId !== null) {
      const paper = await this.papers.findByIdGlobal(open.moduleId);

      if (!paper) {
        await this.repository.stop(open.id, userId);
        return null;
      }

      const entry = entryResponse(open);
      return {
        ...entry,
        tenantId: open.tenantId,
        taskTitle: null,
        taskDisplayId: null,
        paperTitle:
          paper.shortTitle ||
          paper.title ||
          paper.displayId ||
          'Untitled paper',
        paperDisplayId: paper.displayId,
        elapsedSeconds: entry.durationSeconds + entry.runningSeconds,
      };
    }

    if (open.taskTitle === null) {
      await this.repository.stop(open.id, userId);
      return null;
    }

    const entry = entryResponse(open);
    return {
      ...entry,
      tenantId: open.tenantId,
      taskTitle: open.taskTitle,
      taskDisplayId: open.taskDisplayId,
      paperTitle: null,
      paperDisplayId: null,
      elapsedSeconds: entry.durationSeconds + entry.runningSeconds,
    };
  }

  /** All the caller's accessible running or paused timers. */
  async current(userId: string) {
    const rows = await this.repository.findAllOpen(userId);
    const timers = [];

    for (const row of rows) {
      const timer = await this.openTimerResponse(row, userId);
      if (timer) timers.push(timer);
    }

    return timers;
  }

  /** Reads one timer after starting, pausing or resuming it. */
  private async timerById(entryId: string, userId: string) {
    const rows = await this.repository.findAllOpen(userId);
    const row = rows.find((candidate) => candidate.id === entryId);

    return row ? this.openTimerResponse(row, userId) : null;
  }

  /** Starts this task's timer without changing other timers. */
  async start(userId: string, taskId: string) {
    const task = await this.accessibleTask(taskId, userId);
    const open = await this.repository.lockOpenForTask(task.id, userId);

    if (open) {
      if (open.runningSince === null) {
        await this.repository.resume(open.id, userId);
      }
      return this.timerById(open.id, userId);
    }

    try {
      const created = await this.repository.startTimer({
        tenantId: task.tenantId,
        taskId: task.id,
        userId,
      });

      if (!created) throw new NotFoundException('Task not found');
      return await this.timerById(created.id, userId);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'A timer was just started for this task. Refresh and try again.',
        );
      }
      throw error;
    }
  }

  /** Starts this paper's timer without changing other timers. */
  async startPaper(userId: string, moduleId: string) {
    const paper = await this.accessiblePaper(moduleId);
    const open = await this.repository.lockOpenForPaper(paper.id, userId);

    if (open) {
      if (open.runningSince === null) {
        await this.repository.resume(open.id, userId);
      }
      return this.timerById(open.id, userId);
    }

    try {
      const created = await this.repository.startTimer({
        tenantId: paper.tenantId,
        moduleId: paper.id,
        userId,
      });

      if (!created) throw new NotFoundException('Paper not found');
      return await this.timerById(created.id, userId);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'A timer was just started for this paper. Refresh and try again.',
        );
      }
      throw error;
    }
  }

  async pause(userId: string, entryId: string) {
    const open = await this.repository.lockOpenEntry(entryId, userId);
    if (!open) throw new NotFoundException('Open timer not found');

    if (open.runningSince !== null) {
      await this.repository.pause(open.id, userId);
    }

    return this.timerById(open.id, userId);
  }

  async resume(userId: string, entryId: string) {
    const open = await this.repository.lockOpenEntry(entryId, userId);
    if (!open) throw new NotFoundException('Open timer not found');

    if (open.moduleId !== null) {
      await this.accessiblePaper(open.moduleId);
    } else if (open.taskId !== null) {
      await this.accessibleTask(open.taskId, userId);
    } else {
      throw new NotFoundException('Timer target not found');
    }

    if (open.runningSince === null) {
      await this.repository.resume(open.id, userId);
    }

    return this.timerById(open.id, userId);
  }

  /** Stops only the selected timer and retains its logged time. */
  async stop(userId: string, entryId: string) {
    const open = await this.repository.lockOpenEntry(entryId, userId);
    if (!open) throw new NotFoundException('Open timer not found');

    const stopped = await this.repository.stop(open.id, userId);
    return stopped ? entryResponse(stopped) : null;
  }

  /** The caller's entries on a task, with the task's logged totals. */
  async listForTask(taskId: string, userId: string) {
    const task = await this.accessibleTask(taskId, userId);
    const [entries, totals] = await Promise.all([
      this.repository.findForTask(task.id, userId),
      this.repository.totalsForTasks([task.id], userId),
    ]);
    const logged = totals.get(task.id);
    return {
      taskId: task.id,
      estimatedHours: task.estimatedHours,
      entries: entries.map(entryResponse),
      mySeconds: logged?.mySeconds ?? 0,
      totalSeconds: logged?.totalSeconds ?? 0,
    };
  }

  /** The caller's paper entries and time logged directly on that paper. */
  async listForPaper(moduleId: string, userId: string) {
    const paper = await this.accessiblePaper(moduleId);
    const [entries, totals] = await Promise.all([
      this.repository.findForPaper(paper.id, userId),
      this.repository.totalsForPapers([paper.id], userId),
    ]);
    const logged = totals.get(paper.id);

    return {
      moduleId: paper.id,
      entries: entries.map(entryResponse),
      mySeconds: logged?.mySeconds ?? 0,
      totalSeconds: logged?.totalSeconds ?? 0,
    };
  }

  /** Adds time directly to a paper by hand. */
  async addManualForPaper(
    moduleId: string,
    userId: string,
    dto: CreateTimeEntryDto,
  ) {
    const paper = await this.accessiblePaper(moduleId);
    const row = await this.repository.addManual({
      tenantId: paper.tenantId,
      moduleId: paper.id,
      userId,
      startedAt: this.parseStart(dto.startedAt),
      durationSeconds: dto.minutes * 60,
      note: dto.note?.trim() || null,
    });

    if (!row) throw new NotFoundException('Paper not found');
    return entryResponse(row);
  }

  private parseStart(startedAt: string) {
    const date = new Date(startedAt);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('startedAt must be a valid date');
    }
    if (date.getTime() > Date.now() + MAX_FUTURE_MS) {
      throw new BadRequestException("Time can't be logged in the future");
    }
    return date;
  }

  /** Adds time by hand, for work that wasn't timed. */
  async addManual(taskId: string, userId: string, dto: CreateTimeEntryDto) {
    const task = await this.accessibleTask(taskId, userId);
    const row = await this.repository.addManual({
      tenantId: task.tenantId,
      taskId: task.id,
      userId,
      startedAt: this.parseStart(dto.startedAt),
      durationSeconds: dto.minutes * 60,
      note: dto.note?.trim() || null,
    });
    if (!row) throw new NotFoundException('Task not found');
    return entryResponse(row);
  }

  /** Corrects one of the caller's finished entries. */
  async update(entryId: string, userId: string, dto: UpdateTimeEntryDto) {
    const entry = await this.repository.findOwn(entryId, userId);
    if (!entry) throw new NotFoundException('Time entry not found');
    if (entry.endedAt === null) {
      throw new BadRequestException(
        'Stop the timer before changing this entry',
      );
    }

    const row = await this.repository.updateFinished(entryId, userId, {
      startedAt:
        dto.startedAt === undefined
          ? entry.startedAt
          : this.parseStart(dto.startedAt),
      durationSeconds:
        dto.minutes === undefined ? entry.durationSeconds : dto.minutes * 60,
      note: dto.note === undefined ? entry.note : dto.note?.trim() || null,
    });
    if (!row) throw new NotFoundException('Time entry not found');
    return entryResponse(row);
  }

  /** Deletes one of the caller's finished entries. */
  async remove(entryId: string, userId: string) {
    const entry = await this.repository.findOwn(entryId, userId);
    if (!entry) throw new NotFoundException('Time entry not found');
    if (entry.endedAt === null) {
      throw new BadRequestException('Stop the timer before deleting it');
    }
    const deleted = await this.repository.deleteFinished(entryId, userId);
    if (!deleted) throw new NotFoundException('Time entry not found');
    return deleted;
  }
}
