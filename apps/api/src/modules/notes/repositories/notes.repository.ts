import { searchPattern } from '../../../common/pagination';
import { Injectable } from '@nestjs/common';
import {
  modules,
  notes,
  noteEntries,
  noteMembers,
  projects,
} from '@research-tracker/migrations';
import {
  and,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from 'drizzle-orm';
import { DrizzleService } from '../../../db/drizzle.service';
import { getRequestContext } from '../../../db/request-context';

@Injectable()
export class NotesRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  private async withinTransaction<T>(
    operation: (
      db: Pick<DrizzleService['db'], 'insert' | 'update'>,
    ) => Promise<T>,
  ): Promise<T> {
    const context = getRequestContext();

    if (context) {
      // The interceptor owns commit/rollback and the RLS settings.
      return operation(context.tx);
    }

    // Calls outside an HTTP request need their own transaction.
    return this.drizzle.db.transaction((tx) => operation(tx));
  }

  private activeParentCondition() {
    return and(
      or(
        isNull(notes.projectId),
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
      or(
        isNull(notes.moduleId),
        exists(
          this.drizzle.db
            .select({ id: modules.id })
            .from(modules)
            .where(
              and(
                eq(modules.id, notes.moduleId),
                isNull(modules.archivedAt),
                or(
                  isNull(modules.projectId),
                  exists(
                    this.drizzle.db
                      .select({ id: projects.id })
                      .from(projects)
                      .where(
                        and(
                          eq(projects.id, modules.projectId),
                          isNull(projects.archivedAt),
                        ),
                      ),
                  ),
                ),
              ),
            ),
        ),
      ),
    );
  }

  async findById(tenantId: string, noteId: string) {
    const [note] = await this.drizzle.db
      .select()
      .from(notes)
      .where(
        and(
          eq(notes.tenantId, tenantId),
          eq(notes.id, noteId),
          this.activeParentCondition(),
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
      .where(and(eq(notes.id, noteId), this.activeParentCondition()));
    return note;
  }

  /** All notes the given user created, across every tenant. */
  async findByCreator(userId: string) {
    return this.drizzle.db
      .select()
      .from(notes)
      .where(and(eq(notes.createdBy, userId), this.activeParentCondition()));
  }

  async findByIds(ids: string[]) {
    if (ids.length === 0) return [];
    return this.drizzle.db
      .select()
      .from(notes)
      .where(and(inArray(notes.id, ids), this.activeParentCondition()));
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
      visibilityCondition,
      this.activeParentCondition(),
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
              .where(
                and(
                  eq(projects.id, notes.projectId),
                  ilike(projects.title, pattern),
                ),
              ),
          ),
          exists(
            this.drizzle.db
              .select({ id: modules.id })
              .from(modules)
              .where(
                and(
                  eq(modules.id, notes.moduleId),
                  or(
                    ilike(modules.shortTitle, pattern),
                    ilike(modules.title, pattern),
                  ),
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
    return this.withinTransaction(async (tx) => {
      const [note] = await tx.insert(notes).values(values).returning();

      if (!note) return undefined;

      if (note.content?.trim()) {
        await tx.insert(noteEntries).values({
          noteId: note.id,
          content: note.content,
          createdAt: note.createdAt,
        });
      }

      return note;
    });
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

  async findEntriesByNote(tenantId: string, noteId: string) {
    return this.drizzle.db
      .select({
        id: noteEntries.id,
        noteId: noteEntries.noteId,
        content: noteEntries.content,
        createdAt: noteEntries.createdAt,
      })
      .from(noteEntries)
      .innerJoin(notes, eq(notes.id, noteEntries.noteId))
      .where(
        and(
          eq(notes.tenantId, tenantId),
          eq(notes.id, noteId),
          this.activeParentCondition(),
        ),
      )
      .orderBy(desc(noteEntries.createdAt), desc(noteEntries.id));
  }

  async appendEntry(tenantId: string, noteId: string, content: string) {
    return this.withinTransaction(async (tx) => {
      // Updating the parent locks its row, so concurrent additions
      // preserve each other's content.
      const [note] = await tx
        .update(notes)
        .set({
          content: sql<string>`
            CASE
              WHEN ${notes.content} IS NULL
                OR btrim(${notes.content}) = ''
              THEN ${content}
              ELSE ${content} || E'\n\n' || ${notes.content}
            END
          `,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(notes.tenantId, tenantId),
            eq(notes.id, noteId),
            this.activeParentCondition(),
          ),
        )
        .returning();

      if (!note) return undefined;

      await tx.insert(noteEntries).values({
        noteId: note.id,
        content,
      });

      return note;
    });
  }
}
