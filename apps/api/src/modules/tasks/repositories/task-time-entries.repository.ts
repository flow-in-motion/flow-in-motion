import { Injectable } from '@nestjs/common';
import { taskTimeEntries, tasks } from '@research-tracker/migrations';
import { and, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { DrizzleService } from '../../../db/drizzle.service';

/** Seconds in the stretch that is running right now (0 when paused). */
const runningSecondsSql = sql<number>`COALESCE(
  GREATEST(0, floor(extract(epoch FROM (now() - ${taskTimeEntries.runningSince}))))::int,
  0
)`;

const entryColumns = {
  id: taskTimeEntries.id,
  taskId: taskTimeEntries.taskId,
  tenantId: taskTimeEntries.tenantId,
  userId: taskTimeEntries.userId,
  source: taskTimeEntries.source,
  startedAt: taskTimeEntries.startedAt,
  endedAt: taskTimeEntries.endedAt,
  runningSince: taskTimeEntries.runningSince,
  durationSeconds: taskTimeEntries.durationSeconds,
  note: taskTimeEntries.note,
  runningSeconds: runningSecondsSql,
};

export type TimeEntryRow = {
  id: string;
  taskId: string;
  tenantId: string;
  userId: string;
  source: string;
  startedAt: Date;
  endedAt: Date | null;
  runningSince: Date | null;
  durationSeconds: number;
  note: string | null;
  runningSeconds: number;
};

export type OpenTimerRow = TimeEntryRow & {
  /** Null when the person can no longer see the task. */
  taskTitle: string | null;
  taskDisplayId: string | null;
};

export interface LoggedTime {
  /** Everyone's time on the task. */
  totalSeconds: number;
  /** The caller's own time on the task. */
  mySeconds: number;
}

/**
 * Time logged on tasks. Every query runs as the signed-in person, so the
 * database's row-level security keeps people to their own entries for
 * writes, and to tasks they can see for reads.
 */
@Injectable()
export class TaskTimeEntriesRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  /** The caller's open (running or paused) timer, with its task. */
  async findOpen(userId: string): Promise<OpenTimerRow | undefined> {
    const [row] = await this.drizzle.db
      .select({
        ...entryColumns,
        taskTitle: tasks.title,
        taskDisplayId: tasks.displayId,
      })
      .from(taskTimeEntries)
      .leftJoin(tasks, eq(tasks.id, taskTimeEntries.taskId))
      .where(
        and(
          eq(taskTimeEntries.userId, userId),
          isNull(taskTimeEntries.endedAt),
        ),
      );
    return row;
  }

  /** The caller's open timer, locked until the request finishes. */
  async lockOpen(userId: string): Promise<TimeEntryRow | undefined> {
    const [row] = await this.drizzle.db
      .select(entryColumns)
      .from(taskTimeEntries)
      .where(
        and(
          eq(taskTimeEntries.userId, userId),
          isNull(taskTimeEntries.endedAt),
        ),
      )
      .for('update');
    return row;
  }

  async startTimer(values: {
    tenantId: string;
    taskId: string;
    userId: string;
  }) {
    const [row] = await this.drizzle.db
      .insert(taskTimeEntries)
      .values({
        ...values,
        source: 'timer',
        startedAt: sql`now()`,
        runningSince: sql`now()`,
        durationSeconds: 0,
      })
      .returning({ id: taskTimeEntries.id });
    return row;
  }

  /** Folds the running stretch into the logged time and pauses. */
  async pause(entryId: string, userId: string) {
    await this.drizzle.db
      .update(taskTimeEntries)
      .set({
        durationSeconds: sql`${taskTimeEntries.durationSeconds} + ${runningSecondsSql}`,
        runningSince: null,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(taskTimeEntries.id, entryId),
          eq(taskTimeEntries.userId, userId),
          isNull(taskTimeEntries.endedAt),
          isNotNull(taskTimeEntries.runningSince),
        ),
      );
  }

  async resume(entryId: string, userId: string) {
    await this.drizzle.db
      .update(taskTimeEntries)
      .set({ runningSince: sql`now()`, updatedAt: sql`now()` })
      .where(
        and(
          eq(taskTimeEntries.id, entryId),
          eq(taskTimeEntries.userId, userId),
          isNull(taskTimeEntries.endedAt),
          isNull(taskTimeEntries.runningSince),
        ),
      );
  }

  /** Stops an open timer, keeping the time logged so far. */
  async stop(
    entryId: string,
    userId: string,
  ): Promise<TimeEntryRow | undefined> {
    const [row] = await this.drizzle.db
      .update(taskTimeEntries)
      .set({
        durationSeconds: sql`${taskTimeEntries.durationSeconds} + ${runningSecondsSql}`,
        runningSince: null,
        endedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(taskTimeEntries.id, entryId),
          eq(taskTimeEntries.userId, userId),
          isNull(taskTimeEntries.endedAt),
        ),
      )
      .returning(entryColumns);
    return row;
  }

  async addManual(values: {
    tenantId: string;
    taskId: string;
    userId: string;
    startedAt: Date;
    durationSeconds: number;
    note: string | null;
  }): Promise<TimeEntryRow | undefined> {
    const [row] = await this.drizzle.db
      .insert(taskTimeEntries)
      .values({
        ...values,
        source: 'manual',
        endedAt: new Date(
          values.startedAt.getTime() + values.durationSeconds * 1000,
        ),
      })
      .returning(entryColumns);
    return row;
  }

  /** The caller's own entries on a task, newest first. */
  async findForTask(taskId: string, userId: string): Promise<TimeEntryRow[]> {
    return this.drizzle.db
      .select(entryColumns)
      .from(taskTimeEntries)
      .where(
        and(
          eq(taskTimeEntries.taskId, taskId),
          eq(taskTimeEntries.userId, userId),
        ),
      )
      .orderBy(desc(taskTimeEntries.startedAt), desc(taskTimeEntries.id));
  }

  async findOwn(
    entryId: string,
    userId: string,
  ): Promise<TimeEntryRow | undefined> {
    const [row] = await this.drizzle.db
      .select(entryColumns)
      .from(taskTimeEntries)
      .where(
        and(
          eq(taskTimeEntries.id, entryId),
          eq(taskTimeEntries.userId, userId),
        ),
      );
    return row;
  }

  /** Edits a finished entry. Its end moves to start + duration. */
  async updateFinished(
    entryId: string,
    userId: string,
    values: { startedAt: Date; durationSeconds: number; note: string | null },
  ): Promise<TimeEntryRow | undefined> {
    const [row] = await this.drizzle.db
      .update(taskTimeEntries)
      .set({
        ...values,
        endedAt: new Date(
          values.startedAt.getTime() + values.durationSeconds * 1000,
        ),
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(taskTimeEntries.id, entryId),
          eq(taskTimeEntries.userId, userId),
          isNotNull(taskTimeEntries.endedAt),
        ),
      )
      .returning(entryColumns);
    return row;
  }

  async deleteFinished(entryId: string, userId: string) {
    const [row] = await this.drizzle.db
      .delete(taskTimeEntries)
      .where(
        and(
          eq(taskTimeEntries.id, entryId),
          eq(taskTimeEntries.userId, userId),
          isNotNull(taskTimeEntries.endedAt),
        ),
      )
      .returning({ id: taskTimeEntries.id, taskId: taskTimeEntries.taskId });
    return row;
  }

  /**
   * Time logged on each task, for everyone and for the caller. A stretch
   * that is running right now isn't included; the app adds it live.
   */
  async totalsForTasks(
    taskIds: string[],
    userId: string,
  ): Promise<Map<string, LoggedTime>> {
    const totals = new Map<string, LoggedTime>();
    const ids = [...new Set(taskIds)];
    if (ids.length === 0) return totals;

    const rows = await this.drizzle.db
      .select({
        taskId: taskTimeEntries.taskId,
        totalSeconds: sql<number>`COALESCE(sum(${taskTimeEntries.durationSeconds}), 0)::int`,
        mySeconds: sql<number>`COALESCE(sum(${taskTimeEntries.durationSeconds}) FILTER (WHERE ${taskTimeEntries.userId} = ${userId}), 0)::int`,
      })
      .from(taskTimeEntries)
      .where(inArray(taskTimeEntries.taskId, ids))
      .groupBy(taskTimeEntries.taskId);

    for (const row of rows) {
      totals.set(row.taskId, {
        totalSeconds: Number(row.totalSeconds),
        mySeconds: Number(row.mySeconds),
      });
    }
    return totals;
  }
}
