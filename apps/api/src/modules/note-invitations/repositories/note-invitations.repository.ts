// apps/api/src/modules/note-invitations/repositories/note-invitations.repository.ts
import { Injectable } from '@nestjs/common';
import { noteInvitations } from '@research-tracker/migrations';
import { and, eq, sql } from 'drizzle-orm';
import { DrizzleService } from '../../../db/drizzle.service';

@Injectable()
export class NoteInvitationsRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async findByNote(noteId: string) {
    return this.drizzle.db
      .select()
      .from(noteInvitations)
      .where(eq(noteInvitations.noteId, noteId));
  }

  async findByToken(tokenHash: string) {
    const result = await this.drizzle.db.execute(
      sql`SELECT * FROM find_note_invitation_by_token(${tokenHash})`,
    );
    const row = result.rows[0] as
      | {
          id: string;
          note_id: string;
          email: string;
          name: string | null;
          affiliation: string | null;
          invited_by: string;
          token: string | null;
          status: string;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        }
      | undefined;

    if (!row?.id) return undefined;

    return {
      id: row.id,
      noteId: row.note_id,
      email: row.email,
      name: row.name,
      affiliation: row.affiliation,
      invitedBy: row.invited_by,
      token: row.token,
      status: row.status,
      expiresAt: row.expires_at ? new Date(row.expires_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async findById(noteId: string, id: string) {
    const [row] = await this.drizzle.db
      .select()
      .from(noteInvitations)
      .where(
        and(eq(noteInvitations.id, id), eq(noteInvitations.noteId, noteId)),
      );
    return row;
  }

  async create(values: {
    noteId: string;
    email: string;
    name?: string;
    affiliation?: string;
    invitedBy: string;
    token?: string;
    status?: string;
    expiresAt?: Date;
  }) {
    const [row] = await this.drizzle.db
      .insert(noteInvitations)
      .values(values)
      .returning();
    return row;
  }

  async markSent(id: string, values: { token: string; expiresAt: Date }) {
    const [row] = await this.drizzle.db
      .update(noteInvitations)
      .set({ ...values, status: 'pending', updatedAt: new Date() })
      .where(eq(noteInvitations.id, id))
      .returning();
    return row;
  }

  async markAccepted(id: string) {
    const [row] = await this.drizzle.db
      .update(noteInvitations)
      .set({ status: 'accepted', updatedAt: new Date() })
      .where(eq(noteInvitations.id, id))
      .returning();
    return row;
  }

  async delete(noteId: string, id: string) {
    const [row] = await this.drizzle.db
      .delete(noteInvitations)
      .where(
        and(eq(noteInvitations.id, id), eq(noteInvitations.noteId, noteId)),
      )
      .returning();
    return row;
  }
}
