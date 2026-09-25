import { searchPattern } from '../../../common/pagination';
import { Injectable } from '@nestjs/common';
import { modules, notes, noteMembers, projects } from '@research-tracker/migrations';
import { and, desc, eq, exists, ilike, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { DrizzleService } from '../../../db/drizzle.service';

@Injectable()
export class NotesRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  private hasActiveParent() {
    return or(
      and(isNull(notes.projectId), isNull(notes.moduleId)),
      and(
        isNotNull(notes.projectId),
        exists(
          this.drizzle.db
            .select({ id: projects.id })
            .from(projects)
            .where(
              and(
                eq(projects.id, notes.projectId),
                isNull(projects.archivedAt),
              ),
            ),
        ),
      ),
      and(
        isNotNull(notes.moduleId),
        exists(
          this.drizzle.db
            .select({ id: modules.id })
            .from(modules)
            .innerJoin(projects, eq(projects.id, modules.projectId))
            .where(
              and(
                eq(modules.id, notes.moduleId),
                isNull(modules.archivedAt),
                isNull(projects.archivedAt),
              ),
            ),
        ),
      ),
    )!;
  }

  async findById(tenantId: string, noteId: string) {
    const [note] = await this.drizzle.db
      .select()
      .from(notes)
      .where(
        and(
          eq(notes.tenantId, tenantId),
          eq(notes.id, noteId),
          this.hasActiveParent(),
        ),
      );
    return note;
  }

  /** Tenant-agnostic lookup — used for "notes shared with me" access, where the
   * caller may not be a member of the tenant that owns the note at all. */
  async findByIdGlobal(noteId: string) {
    const [note] = await this.drizzle.db
      .select()
      .from(notes)
      .where(and(eq(notes.id, noteId), this.hasActiveParent()));
    return note;
  }

  /** All notes the given user created, across every tenant. */
  async findByCreator(userId: string) {
    return this.drizzle.db
      .select()
      .from(notes)
      .where(and(eq(notes.createdBy, userId), this.hasActiveParent()));
  }

  async findByIds(ids: string[]) {
    if (ids.length === 0) return [];
    return this.drizzle.db
      .select()
      .from(notes)
      .where(and(inArray(notes.id, ids), this.hasActiveParent()));
  }

  async findVisibleByTenant(
    tenantId: string,
    callerUserId: string,
    offset: number,
    limit: number,
    projectId?: string,
    search?: string,
    projectOnly = false,
  ) {
    const visibilityCondition = or(
      eq(notes.createdBy, callerUserId),
      exists(
        this.drizzle.db
          .select({ id: noteMembers.id })
          .from(noteMembers)
          .where(
            and(
              eq(noteMembers.tenantId, tenantId),
              eq(noteMembers.noteId, notes.id),
              eq(noteMembers.userId, callerUserId),
            ),
          ),
      ),
    );

    const conditions = [
      eq(notes.tenantId, tenantId),
      this.hasActiveParent(),
      visibilityCondition,
    ];

    if (projectId) {
      conditions.push(eq(notes.projectId, projectId));
    }
    if (projectOnly) conditions.push(isNull(notes.moduleId));
    if (search) {
      const pattern = searchPattern(search);
      conditions.push(
        or(
          ilike(notes.title, pattern),
          ilike(notes.content, pattern),
          exists(
            this.drizzle.db
              .select({ id: projects.id })
              .from(projects)
              .where(and(eq(projects.id, notes.projectId), ilike(projects.title, pattern))),
          ),
          exists(
            this.drizzle.db
              .select({ id: modules.id })
              .from(modules)
              .where(
                and(
                  eq(modules.id, notes.moduleId),
                  or(ilike(modules.shortTitle, pattern), ilike(modules.title, pattern)),
                ),
              ),
          ),
        ),
      );
    }

    const whereCondition = and(...conditions);

    const [data, countResult] = await Promise.all([
      this.drizzle.db
        .select()
        .from(notes)
        .where(whereCondition)
        .orderBy(desc(notes.updatedAt), desc(notes.id))
        .limit(limit)
        .offset(offset),

      this.drizzle.db
        .select({
          count: sql<number>`count(*)::int`,
        })
        .from(notes)
        .where(whereCondition),
    ]);

    return {
      data,
      totalItems: countResult[0]?.count ?? 0,
    };
  }

  async create(values: {
    projectId?: string;
    tenantId: string;
    moduleId?: string;
    createdBy: string;
    title: string;
    content?: string;
    displayId?: string;
    visibilityId?: string;
    followUpDate?: string;
  }) {
    const [note] = await this.drizzle.db
      .insert(notes)
      .values(values)
      .returning();
    return note;
  }

  async update(
    tenantId: string,
    noteId: string,
    values: Partial<{
      title: string;
      content: string;
      visibilityId: string;
      projectId: string | null;
      moduleId: string | null;
      followUpDate: string;
    }>,
  ) {
    const [note] = await this.drizzle.db
      .update(notes)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(notes.tenantId, tenantId), eq(notes.id, noteId)))
      .returning();
    return note;
  }

  async delete(tenantId: string, noteId: string) {
    const [note] = await this.drizzle.db
      .delete(notes)
      .where(and(eq(notes.tenantId, tenantId), eq(notes.id, noteId)))
      .returning();
    return note;
  }
}
