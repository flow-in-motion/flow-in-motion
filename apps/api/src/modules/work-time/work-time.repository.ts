import { Injectable } from '@nestjs/common';
import { notes, projects, workTimeEntries } from '@research-tracker/migrations';
import { and, desc, eq, getTableColumns, isNull, sql } from 'drizzle-orm';
import { DrizzleService } from '../../db/drizzle.service';
import type { WorkTimeKind } from './work-time.dto';

const t = workTimeEntries;
const runningSeconds = sql<number>`CASE WHEN ${t.endedAt} IS NULL AND ${t.runningSince} IS NOT NULL THEN greatest(0, floor(extract(epoch FROM (now() - ${t.runningSince}))))::int ELSE 0 END`;
const fields = { ...getTableColumns(t), runningSeconds };
export type WorkTimeRow = typeof t.$inferSelect & { runningSeconds: number };
export function targetOf(row: typeof t.$inferSelect): {
  kind: WorkTimeKind;
  targetId: string;
} {
  if (row.projectId) return { kind: 'project', targetId: row.projectId };
  if (row.noteId) return { kind: 'note', targetId: row.noteId };
  return { kind: 'hdr', targetId: row.hdrPersonId! };
}

@Injectable()
export class WorkTimeRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  // Parent RLS applies in addition to these active-parent and owner checks.
  async target(kind: WorkTimeKind, id: string, userId: string) {
    if (kind === 'project') {
      const [row] = await this.drizzle.db
        .select({
          id: projects.id,
          tenantId: projects.tenantId,
          title: projects.title,
        })
        .from(projects)
        .where(
          and(
            eq(projects.id, id),
            isNull(projects.archivedAt),
            sql`(${projects.userId} = ${userId}::uuid OR public.is_project_collaborator(${projects.id}, ${userId}::uuid))`,
          ),
        );
      return row;
    }
    if (kind === 'note') {
      const [row] = await this.drizzle.db
        .select({ id: notes.id, tenantId: notes.tenantId, title: notes.title })
        .from(notes)
        .where(
          and(
            eq(notes.id, id),
            sql`(${notes.projectId} IS NULL OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = ${notes.projectId} AND p.archived_at IS NULL))`,
            sql`(${notes.moduleId} IS NULL OR EXISTS (SELECT 1 FROM public.modules m WHERE m.id = ${notes.moduleId} AND m.archived_at IS NULL AND (m.project_id IS NULL OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = m.project_id AND p.archived_at IS NULL))))`,
          ),
        );
      return row;
    }
    // Restricted owner-only lookup: the global timer endpoint has no tenant
    // context, while the existing HDR page deliberately requires one.
    const result = await this.drizzle.db.execute<{
      id: string;
      tenantId: string;
      title: string;
    }>(
      sql`SELECT id, tenant_id AS "tenantId", title FROM public.work_time_hdr_target(${id}::uuid)`,
    );
    return result.rows[0];
  }

  private targetCondition(kind: WorkTimeKind, targetId: string) {
    return eq(
      kind === 'project'
        ? t.projectId
        : kind === 'note'
          ? t.noteId
          : t.hdrPersonId,
      targetId,
    );
  }
  async current(userId: string) {
    return this.drizzle.db
      .select(fields)
      .from(t)
      .where(and(eq(t.userId, userId), isNull(t.endedAt)))
      .orderBy(desc(t.startedAt), desc(t.id));
  }
  async own(id: string, userId: string, lock = false) {
    const query = this.drizzle.db
      .select(fields)
      .from(t)
      .where(and(eq(t.id, id), eq(t.userId, userId)));
    const [row] = await (lock ? query.for('update') : query);
    return row;
  }
  async openFor(kind: WorkTimeKind, targetId: string, userId: string) {
    const [row] = await this.drizzle.db
      .select(fields)
      .from(t)
      .where(
        and(
          this.targetCondition(kind, targetId),
          eq(t.userId, userId),
          isNull(t.endedAt),
        ),
      )
      .for('update');
    return row;
  }
  async list(kind: WorkTimeKind, targetId: string, userId: string) {
    return this.drizzle.db
      .select(fields)
      .from(t)
      .where(and(this.targetCondition(kind, targetId), eq(t.userId, userId)))
      .orderBy(desc(t.startedAt), desc(t.id));
  }
  async create(
    kind: WorkTimeKind,
    targetId: string,
    userId: string,
    tenantId: string,
    manual?: { startedAt: Date; minutes: number; note?: string | null },
  ) {
    const [row] = await this.drizzle.db
      .insert(t)
      .values({
        tenantId,
        userId,
        projectId: kind === 'project' ? targetId : null,
        noteId: kind === 'note' ? targetId : null,
        hdrPersonId: kind === 'hdr' ? targetId : null,
        source: manual ? 'manual' : 'timer',
        startedAt: manual?.startedAt ?? sql`now()`,
        endedAt: manual ? manual.startedAt : null,
        runningSince: manual ? null : sql`now()`,
        durationSeconds: manual ? manual.minutes * 60 : 0,
        note: manual?.note?.trim() || null,
      })
      .returning({ id: t.id });
    return row;
  }
  async transition(
    id: string,
    userId: string,
    action: 'pause' | 'resume' | 'stop',
  ) {
    await this.drizzle.db
      .update(t)
      .set({
        durationSeconds:
          action === 'resume'
            ? t.durationSeconds
            : sql`${t.durationSeconds} + ${runningSeconds}`,
        runningSince: action === 'resume' ? sql`now()` : null,
        endedAt: action === 'stop' ? sql`now()` : null,
        updatedAt: sql`now()`,
      })
      .where(and(eq(t.id, id), eq(t.userId, userId), isNull(t.endedAt)));
    return this.own(id, userId);
  }
  async update(
    id: string,
    userId: string,
    values: { startedAt?: Date; minutes?: number; note?: string | null },
  ) {
    const [row] = await this.drizzle.db
      .update(t)
      .set({
        startedAt: values.startedAt,
        endedAt: values.startedAt,
        durationSeconds:
          values.minutes === undefined ? undefined : values.minutes * 60,
        note:
          values.note === undefined ? undefined : values.note?.trim() || null,
        updatedAt: sql`now()`,
      })
      .where(
        and(eq(t.id, id), eq(t.userId, userId), sql`${t.endedAt} IS NOT NULL`),
      )
      .returning({ id: t.id });
    return row ? this.own(row.id, userId) : undefined;
  }
  async remove(id: string, userId: string) {
    const [row] = await this.drizzle.db
      .delete(t)
      .where(
        and(eq(t.id, id), eq(t.userId, userId), sql`${t.endedAt} IS NOT NULL`),
      )
      .returning({ id: t.id });
    return row;
  }
}
