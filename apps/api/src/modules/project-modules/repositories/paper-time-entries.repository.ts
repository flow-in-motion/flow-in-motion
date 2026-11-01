import { Injectable } from '@nestjs/common';
import { paperTimeEntries, modules } from '@research-tracker/migrations';
import { and, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { DrizzleService } from '../../../db/drizzle.service';

/** Seconds in the stretch that is running right now (0 when paused). */
const runningSecondsSql = sql<number>`COALESCE(
  GREATEST(0, floor(extract(epoch FROM (now() - ${paperTimeEntries.runningSince}))))::int,
  0
)`;

const entryColumns = {
  id: paperTimeEntries.id,
  paperId: paperTimeEntries.paperId,
  tenantId: paperTimeEntries.tenantId,
  userId: paperTimeEntries.userId,
  source: paperTimeEntries.source,
  startedAt: paperTimeEntries.startedAt,
  endedAt: paperTimeEntries.endedAt,
  runningSince: paperTimeEntries.runningSince,
  durationSeconds: paperTimeEntries.durationSeconds,
  note: paperTimeEntries.note,
  runningSeconds: runningSecondsSql,
};

export type TimeEntryRow = {
  id: string;
  paperId: string;
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
  /** Null when the person can no longer see the paper. */
  paperTitle: string | null;
  paperDisplayId: string | null;
};

export interface LoggedTime {
  /** Everyone's time on the paper. */
  totalSeconds: number;
  /** The caller's own time on the paper. */
  mySeconds: number;
}

/**
 * Time logged on modules. Every query runs as the signed-in person, so the
 * database's row-level security keeps people to their own entries for
 * writes, and to modules they can see for reads.
 */
@Injectable()
export class PaperTimeEntriesRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  /** The caller's open (running or paused) timer, with its paper. */
  async findOpen(userId: string): Promise<OpenTimerRow | undefined> {
    const [row] = await this.drizzle.db
      .select({
        ...entryColumns,
        paperTitle: sql<string | null>`CASE WHEN ${modules.id} IS NOT NULL THEN
          COALESCE(NULLIF(${modules.shortTitle}, ''), NULLIF(${modules.title}, ''), 'Untitled paper')
          ELSE NULL END`,
        paperDisplayId: modules.displayId,
      })
      .from(paperTimeEntries)
      .leftJoin(
        modules,
        and(
          eq(modules.id, paperTimeEntries.paperId),
          isNull(modules.archivedAt),
          sql`(${modules.projectId} IS NULL OR EXISTS (
          SELECT 1 FROM projects WHERE projects.id = ${modules.projectId} AND projects.archived_at IS NULL
        ))`,
        ),
      )
      .where(
        and(
          eq(paperTimeEntries.userId, userId),
          isNull(paperTimeEntries.endedAt),
        ),
      );
    return row;
  }

  /** The caller's open timer, locked until the request finishes. */
  async lockOpen(userId: string): Promise<TimeEntryRow | undefined> {
    const [row] = await this.drizzle.db
      .select(entryColumns)
      .from(paperTimeEntries)
      .where(
        and(
          eq(paperTimeEntries.userId, userId),
          isNull(paperTimeEntries.endedAt),
        ),
      )
      .for('update');
    return row;
  }

  async startTimer(values: {
    tenantId: string;
    paperId: string;
    userId: string;
  }) {
    const [row] = await this.drizzle.db
      .insert(paperTimeEntries)
      .values({
        ...values,
        source: 'timer',
        startedAt: sql`now()`,
        runningSince: sql`now()`,
        durationSeconds: 0,
      })
      .returning({ id: paperTimeEntries.id });
    return row;
  }

  /** Folds the running stretch into the logged time and pauses. */
  async pause(entryId: string, userId: string) {
    await this.drizzle.db
      .update(paperTimeEntries)
      .set({
        durationSeconds: sql`${paperTimeEntries.durationSeconds} + ${runningSecondsSql}`,
        runningSince: null,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(paperTimeEntries.id, entryId),
          eq(paperTimeEntries.userId, userId),
          isNull(paperTimeEntries.endedAt),
          isNotNull(paperTimeEntries.runningSince),
        ),
      );
  }

  async resume(entryId: string, userId: string) {
    await this.drizzle.db
      .update(paperTimeEntries)
      .set({ runningSince: sql`now()`, updatedAt: sql`now()` })
      .where(
        and(
          eq(paperTimeEntries.id, entryId),
          eq(paperTimeEntries.userId, userId),
          isNull(paperTimeEntries.endedAt),
          isNull(paperTimeEntries.runningSince),
        ),
      );
  }

  /** Stops an open timer, keeping the time logged so far. */
  async stop(
    entryId: string,
    userId: string,
  ): Promise<TimeEntryRow | undefined> {
    const [row] = await this.drizzle.db
      .update(paperTimeEntries)
      .set({
        durationSeconds: sql`${paperTimeEntries.durationSeconds} + ${runningSecondsSql}`,
        runningSince: null,
        endedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(paperTimeEntries.id, entryId),
          eq(paperTimeEntries.userId, userId),
          isNull(paperTimeEntries.endedAt),
        ),
      )
      .returning(entryColumns);
    return row;
  }

  async addManual(values: {
    tenantId: string;
    paperId: string;
    userId: string;
    startedAt: Date;
    durationSeconds: number;
    note: string | null;
  }): Promise<TimeEntryRow | undefined> {
    const [row] = await this.drizzle.db
      .insert(paperTimeEntries)
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

  /** The caller's own entries on a paper, newest first. */
  async findForPaper(paperId: string, userId: string): Promise<TimeEntryRow[]> {
    return this.drizzle.db
      .select(entryColumns)
      .from(paperTimeEntries)
      .where(
        and(
          eq(paperTimeEntries.paperId, paperId),
          eq(paperTimeEntries.userId, userId),
        ),
      )
      .orderBy(desc(paperTimeEntries.startedAt), desc(paperTimeEntries.id));
  }

  async findOwn(
    entryId: string,
    userId: string,
  ): Promise<TimeEntryRow | undefined> {
    const [row] = await this.drizzle.db
      .select(entryColumns)
      .from(paperTimeEntries)
      .where(
        and(
          eq(paperTimeEntries.id, entryId),
          eq(paperTimeEntries.userId, userId),
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
      .update(paperTimeEntries)
      .set({
        ...values,
        endedAt: new Date(
          values.startedAt.getTime() + values.durationSeconds * 1000,
        ),
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(paperTimeEntries.id, entryId),
          eq(paperTimeEntries.userId, userId),
          isNotNull(paperTimeEntries.endedAt),
        ),
      )
      .returning(entryColumns);
    return row;
  }

  async deleteFinished(entryId: string, userId: string) {
    const [row] = await this.drizzle.db
      .delete(paperTimeEntries)
      .where(
        and(
          eq(paperTimeEntries.id, entryId),
          eq(paperTimeEntries.userId, userId),
          isNotNull(paperTimeEntries.endedAt),
        ),
      )
      .returning({
        id: paperTimeEntries.id,
        paperId: paperTimeEntries.paperId,
      });
    return row;
  }

  /**
   * Time logged on each paper, for everyone and for the caller. A stretch
   * that is running right now isn't included; the app adds it live.
   */
  async totalsForPapers(
    paperIds: string[],
    userId: string,
  ): Promise<Map<string, LoggedTime>> {
    const totals = new Map<string, LoggedTime>();
    const ids = [...new Set(paperIds)];
    if (ids.length === 0) return totals;

    const rows = await this.drizzle.db
      .select({
        paperId: paperTimeEntries.paperId,
        totalSeconds: sql<number>`COALESCE(sum(${paperTimeEntries.durationSeconds}), 0)::int`,
        mySeconds: sql<number>`COALESCE(sum(${paperTimeEntries.durationSeconds}) FILTER (WHERE ${paperTimeEntries.userId} = ${userId}), 0)::int`,
      })
      .from(paperTimeEntries)
      .where(inArray(paperTimeEntries.paperId, ids))
      .groupBy(paperTimeEntries.paperId);

    for (const row of rows) {
      totals.set(row.paperId, {
        totalSeconds: Number(row.totalSeconds),
        mySeconds: Number(row.mySeconds),
      });
    }
    return totals;
  }
}
