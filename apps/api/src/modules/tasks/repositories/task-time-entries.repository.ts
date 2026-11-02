import { Injectable } from '@nestjs/common';
import {
  paperTimeEntries,
  taskTimeEntries,
  tasks,
  modules,
} from '@research-tracker/migrations';
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from 'drizzle-orm';
import { DrizzleService } from '../../../db/drizzle.service';

/** Seconds in the stretch that is running right now (0 when paused). */
const runningSecondsSql = sql<number>`COALESCE(
  GREATEST(0, floor(extract(epoch FROM (now() - ${taskTimeEntries.runningSince}))))::int,
  0
)`;

const entryColumns = {
  id: taskTimeEntries.id,
  taskId: taskTimeEntries.taskId,
  moduleId: taskTimeEntries.moduleId,
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
  taskId: string | null;
  moduleId: string | null;
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
  paperTitle: string | null;
  paperDisplayId: string | null;
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

  /** Dates with at least a minute of completed work on a project or its papers. */
  async activeDatesForProject(
    projectId: string,
    timeZone: string,
  ): Promise<string[]> {
    const taskDay = sql<string>`to_char(${taskTimeEntries.startedAt} AT TIME ZONE ${timeZone}, 'YYYY-MM-DD')`;
    const paperDay = sql<string>`to_char(${paperTimeEntries.startedAt} AT TIME ZONE ${timeZone}, 'YYYY-MM-DD')`;
    const [taskRows, paperRows] = await Promise.all([
      this.drizzle.db
        .selectDistinct({ day: taskDay })
        .from(taskTimeEntries)
        .leftJoin(tasks, eq(tasks.id, taskTimeEntries.taskId))
        .leftJoin(
          modules,
          or(
            eq(modules.id, taskTimeEntries.moduleId),
            eq(modules.id, tasks.moduleId),
          ),
        )
        .where(
          and(
            isNotNull(taskTimeEntries.endedAt),
            gte(taskTimeEntries.durationSeconds, 60),
            or(
              eq(tasks.projectId, projectId),
              eq(modules.projectId, projectId),
            ),
          ),
        ),
      this.drizzle.db
        .selectDistinct({ day: paperDay })
        .from(paperTimeEntries)
        .innerJoin(modules, eq(modules.id, paperTimeEntries.paperId))
        .where(
          and(
            eq(modules.projectId, projectId),
            isNotNull(paperTimeEntries.endedAt),
            gte(paperTimeEntries.durationSeconds, 60),
          ),
        ),
    ]);

    return [...new Set([...taskRows, ...paperRows].map((row) => row.day))].sort(
      (a, b) => b.localeCompare(a),
    );
  }

  /** The caller's open (running or paused) timer, with its task. */
  async findOpen(userId: string): Promise<OpenTimerRow | undefined> {
    const [row] = await this.drizzle.db
      .select({
        ...entryColumns,
        taskTitle: tasks.title,
        taskDisplayId: tasks.displayId,
        paperTitle: sql<string | null>`COALESCE(
          ${modules.shortTitle},
          ${modules.title},
          ${modules.displayId},
          'Untitled paper'
        )`,
        paperDisplayId: modules.displayId,
      })
      .from(taskTimeEntries)
      .leftJoin(tasks, eq(tasks.id, taskTimeEntries.taskId))
      .leftJoin(modules, eq(modules.id, taskTimeEntries.moduleId))
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

  /** All the caller's open timers, including paused ones. */
  async findAllOpen(userId: string): Promise<OpenTimerRow[]> {
    return this.drizzle.db
      .select({
        ...entryColumns,
        taskTitle: tasks.title,
        taskDisplayId: tasks.displayId,
        paperTitle: sql<string | null>`
            CASE
              WHEN ${modules.id} IS NULL THEN NULL
              ELSE COALESCE(
                ${modules.shortTitle},
                ${modules.title},
                ${modules.displayId},
                'Untitled paper'
              )
            END
          `,
        paperDisplayId: modules.displayId,
      })
      .from(taskTimeEntries)
      .leftJoin(tasks, eq(tasks.id, taskTimeEntries.taskId))
      .leftJoin(modules, eq(modules.id, taskTimeEntries.moduleId))
      .where(
        and(
          eq(taskTimeEntries.userId, userId),
          isNull(taskTimeEntries.endedAt),
        ),
      )
      .orderBy(desc(taskTimeEntries.startedAt), desc(taskTimeEntries.id));
  }

  /** Locks one specific open timer belonging to the caller. */
  async lockOpenEntry(
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
          isNull(taskTimeEntries.endedAt),
        ),
      )
      .for('update');

    return row;
  }

  /** Locks the caller's existing open timer on this task, if any. */
  async lockOpenForTask(
    taskId: string,
    userId: string,
  ): Promise<TimeEntryRow | undefined> {
    const [row] = await this.drizzle.db
      .select(entryColumns)
      .from(taskTimeEntries)
      .where(
        and(
          eq(taskTimeEntries.taskId, taskId),
          eq(taskTimeEntries.userId, userId),
          isNull(taskTimeEntries.endedAt),
        ),
      )
      .for('update');

    return row;
  }

  /** Locks the caller's existing open timer on this paper, if any. */
  async lockOpenForPaper(
    moduleId: string,
    userId: string,
  ): Promise<TimeEntryRow | undefined> {
    const [row] = await this.drizzle.db
      .select(entryColumns)
      .from(taskTimeEntries)
      .where(
        and(
          eq(taskTimeEntries.moduleId, moduleId),
          eq(taskTimeEntries.userId, userId),
          isNull(taskTimeEntries.endedAt),
        ),
      )
      .for('update');

    return row;
  }
  async startTimer(values: {
    tenantId: string;
    taskId?: string;
    moduleId?: string;
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
    taskId?: string;
    moduleId?: string;
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
      .returning({
        id: taskTimeEntries.id,
        taskId: taskTimeEntries.taskId,
        moduleId: taskTimeEntries.moduleId,
      });
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
      if (row.taskId === null) continue;
      totals.set(row.taskId, {
        totalSeconds: Number(row.totalSeconds),
        mySeconds: Number(row.mySeconds),
      });
    }
    return totals;
  }

  /** The caller's own entries on a paper, newest first. */
  async findForPaper(
    moduleId: string,
    userId: string,
  ): Promise<TimeEntryRow[]> {
    return this.drizzle.db
      .select(entryColumns)
      .from(taskTimeEntries)
      .where(
        and(
          eq(taskTimeEntries.moduleId, moduleId),
          eq(taskTimeEntries.userId, userId),
        ),
      )
      .orderBy(desc(taskTimeEntries.startedAt), desc(taskTimeEntries.id));
  }

  /** Time logged directly on papers, excluding their linked tasks. */
  async totalsForPapers(
    moduleIds: string[],
    userId: string,
  ): Promise<Map<string, LoggedTime>> {
    const totals = new Map<string, LoggedTime>();
    const ids = [...new Set(moduleIds)];
    if (ids.length === 0) return totals;

    const rows = await this.drizzle.db
      .select({
        moduleId: taskTimeEntries.moduleId,
        totalSeconds: sql<number>`
            COALESCE(sum(${taskTimeEntries.durationSeconds}), 0)::int
          `,
        mySeconds: sql<number>`
            COALESCE(
              sum(${taskTimeEntries.durationSeconds})
                FILTER (WHERE ${taskTimeEntries.userId} = ${userId}),
              0
            )::int
          `,
      })
      .from(taskTimeEntries)
      .where(inArray(taskTimeEntries.moduleId, ids))
      .groupBy(taskTimeEntries.moduleId);

    for (const row of rows) {
      if (row.moduleId === null) continue;

      totals.set(row.moduleId, {
        totalSeconds: Number(row.totalSeconds),
        mySeconds: Number(row.mySeconds),
      });
    }

    return totals;
  }
}
