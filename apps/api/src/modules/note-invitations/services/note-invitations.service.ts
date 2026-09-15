// apps/api/src/modules/note-invitations/services/note-invitations.service.ts
import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { sql } from 'drizzle-orm';
import { NoteInvitationsRepository } from '../repositories/note-invitations.repository';
import { NoteMembersRepository } from '../../note-members/repositories/note-members.repository';
import { NotesRepository } from '../../notes/repositories/notes.repository';
import { DrizzleService } from '../../../db/drizzle.service';

function normaliseEmail(value: string) {
  return value.trim().toLowerCase();
}

function hashInvitationToken(rawToken: string) {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

@Injectable()
export class NoteInvitationsService {
  constructor(
    private readonly repository: NoteInvitationsRepository,
    private readonly configService: ConfigService,
    private readonly noteMembersRepository: NoteMembersRepository,
    private readonly notesRepository: NotesRepository,
    private readonly drizzle: DrizzleService,
  ) {}

  async list(noteId: string) {
    return this.repository.findByNote(noteId);
  }

  async createDraft(
    noteId: string,
    invitedBy: string,
    input: { email: string; name?: string; affiliation?: string },
  ) {
    const note = await this.notesRepository.findByIdGlobal(noteId);
    if (!note) {
      throw new NotFoundException('Note not found');
    }

    const invitation = await this.repository.create({
      noteId,
      email: normaliseEmail(input.email),
      name: input.name,
      affiliation: input.affiliation,
      invitedBy,
      status: 'draft',
    });

    if (!invitation) {
      throw new ConflictException('Failed to create invitation');
    }

    const { token: _storedHash, ...safeInvitation } = invitation;
    return safeInvitation;
  }

  /**
   * Generates the acceptance token and marks the draft pending. No email is
   * sent server-side — the caller composes and sends it themselves (see the
   * frontend's mailto: link), using the returned acceptanceToken.
   */
  async send(noteId: string, id: string) {
    const draft = await this.repository.findById(noteId, id);
    if (!draft) {
      throw new NotFoundException('Invitation not found');
    }
    if (draft.status !== 'draft') {
      throw new ConflictException('This invitation has already been sent');
    }

    const tokenBytes = Number(
      this.configService.getOrThrow<string>('INVITATION_TOKEN_BYTES'),
    );
    const ttlHours = Number(
      this.configService.getOrThrow<string>('INVITATION_TOKEN_TTL_HOURS'),
    );

    const rawToken = randomBytes(tokenBytes).toString('base64url');
    const tokenHash = hashInvitationToken(rawToken);
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    const invitation = await this.repository.markSent(id, {
      token: tokenHash,
      expiresAt,
    });
    if (!invitation) {
      throw new ConflictException('Failed to send invitation');
    }

    const { token: _storedHash, ...safeInvitation } = invitation;
    return {
      invitation: safeInvitation,
      acceptanceToken: rawToken,
    };
  }

  async preview(rawToken: string) {
    const invitation = await this.repository.findByToken(
      hashInvitationToken(rawToken),
    );
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    const titleResult = await this.drizzle.db.execute(
      sql`SELECT find_note_title_for_invitation(${invitation.noteId}) as title`,
    );
    const noteTitle =
      (titleResult.rows[0] as { title: string | null } | undefined)?.title ??
      null;
    const { token: _hash, ...safeInvitation } = invitation;
    return { ...safeInvitation, noteTitle };
  }

  async accept(rawToken: string, userId: string, userEmail: string) {
    const tokenHash = hashInvitationToken(rawToken);
    const invitation = await this.repository.findByToken(tokenHash);

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    if (invitation.status !== 'pending') {
      throw new GoneException(
        'This invitation has already been used or revoked',
      );
    }
    if (!invitation.expiresAt || invitation.expiresAt.getTime() < Date.now()) {
      throw new GoneException('This invitation has expired');
    }
    if (normaliseEmail(invitation.email) !== normaliseEmail(userEmail)) {
      throw new ForbiddenException(
        'Sign in with the email address that received this invitation',
      );
    }

    const note = await this.notesRepository.findByIdGlobal(invitation.noteId);
    if (!note) {
      throw new NotFoundException('Note not found');
    }

    await this.noteMembersRepository.create({
      tenantId: note.tenantId,
      noteId: invitation.noteId,
      userId,
    });

    return this.repository.markAccepted(invitation.id);
  }

  async revoke(noteId: string, id: string) {
    const row = await this.repository.delete(noteId, id);
    if (!row) {
      throw new NotFoundException('Invitation not found');
    }
    return row;
  }
}
