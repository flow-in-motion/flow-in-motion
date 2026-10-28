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
  type TimeEntryRow,
} from '../repositories/task-time-entries.repository';
import { TasksRepository } from '../repositories/tasks.repository';

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

  /** The caller's running or paused timer, or null. */
  async current(userId: string) {
    const open = await this.repository.findOpen(userId);
    if (!open) return null;

    // The person lost access to the task: stop the timer, keeping the time.
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
      elapsedSeconds: entry.durationSeconds + entry.runningSeconds,
    };
  }

  /** Starts timing a task. Any other open timer is stopped first. */
  async start(userId: string, taskId: string) {
    const task = await this.accessibleTask(taskId, userId);
    const open = await this.repository.lockOpen(userId);

    if (open?.taskId === task.id) {
      if (open.runningSince === null) {
        await this.repository.resume(open.id, userId);
      }
      return this.current(userId);
    }

    if (open) await this.repository.stop(open.id, userId);

    try {
      await this.repository.startTimer({
        tenantId: task.tenantId,
        taskId: task.id,
        userId,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'Another timer was just started. Refresh the page and try again.',
        );
      }
      throw error;
    }
    return this.current(userId);
  }

  async pause(userId: string) {
    const open = await this.repository.lockOpen(userId);
    if (!open) throw new NotFoundException('No timer is running');
    if (open.runningSince !== null) {
      await this.repository.pause(open.id, userId);
    }
    return this.current(userId);
  }

  async resume(userId: string) {
    const open = await this.repository.lockOpen(userId);
    if (!open) throw new NotFoundException('No timer is running');
    if (open.runningSince === null) {
      await this.repository.resume(open.id, userId);
    }
    return this.current(userId);
  }

  /** Stops the open timer. Returns the finished entry, or null if none. */
  async stop(userId: string) {
    const open = await this.repository.lockOpen(userId);
    if (!open) return null;
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
