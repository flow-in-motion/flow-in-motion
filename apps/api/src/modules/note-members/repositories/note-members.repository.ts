// apps/api/src/modules/note-members/repositories/note-members.repository.ts
import { Injectable } from '@nestjs/common';
import { noteMembers, users } from '@research-tracker/migrations';
import { and, eq, inArray } from 'drizzle-orm';
import { DrizzleService } from '../../../db/drizzle.service';

@Injectable()
export class NoteMembersRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async findByNote(tenantId: string, noteId: string) {
    return this.drizzle.db
      .select({
        id: noteMembers.id,
        tenantId: noteMembers.tenantId,
        noteId: noteMembers.noteId,
        userId: noteMembers.userId,
        displayName: users.displayName,
        email: users.email,
        affiliation: users.institution,
        createdAt: noteMembers.createdAt,
      })
      .from(noteMembers)
      .innerJoin(users, eq(noteMembers.userId, users.id))
      .where(
        and(eq(noteMembers.tenantId, tenantId), eq(noteMembers.noteId, noteId)),
      );
  }

  /** Every note id this user is an explicit member of, across every tenant. */
  async findNoteIdsByUser(userId: string) {
    const rows = await this.drizzle.db
      .select({ noteId: noteMembers.noteId })
      .from(noteMembers)
      .where(eq(noteMembers.userId, userId));
    return rows.map((row) => row.noteId);
  }

  async findByNoteAndUser(tenantId: string, noteId: string, userId: string) {
    const [row] = await this.drizzle.db
      .select()
      .from(noteMembers)
      .where(
        and(
          eq(noteMembers.tenantId, tenantId),
          eq(noteMembers.noteId, noteId),
          eq(noteMembers.userId, userId),
        ),
      );
    return row;
  }

  async create(values: { tenantId: string; noteId: string; userId: string }) {
    const [row] = await this.drizzle.db
      .insert(noteMembers)
      .values(values)
      .returning();
    return row;
  }

  async deleteAllForNote(tenantId: string, noteId: string) {
    await this.drizzle.db
      .delete(noteMembers)
      .where(
        and(eq(noteMembers.tenantId, tenantId), eq(noteMembers.noteId, noteId)),
      );
  }

  async delete(tenantId: string, noteId: string, userId: string) {
    const [row] = await this.drizzle.db
      .delete(noteMembers)
      .where(
        and(
          eq(noteMembers.tenantId, tenantId),
          eq(noteMembers.noteId, noteId),
          eq(noteMembers.userId, userId),
        ),
      )
      .returning();
    return row;
  }
  /**
   * Batched version of findByNoteAndUser — checks membership across many
   * notes in a single query, instead of one query per note (avoids the
   * N+1 pattern when listing notes).
   */
  async findByNoteIdsAndUser(noteIds: string[], userId: string) {
    if (noteIds.length === 0) return new Set<string>();

    const rows = await this.drizzle.db
      .select({ noteId: noteMembers.noteId })
      .from(noteMembers)
      .where(
        and(
          inArray(noteMembers.noteId, noteIds),
          eq(noteMembers.userId, userId),
        ),
      );

    return new Set(rows.map((row) => row.noteId));
  }
}
