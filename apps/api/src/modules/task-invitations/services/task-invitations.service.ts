// apps/api/src/modules/task-invitations/services/task-invitations.service.ts
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
import { TaskInvitationsRepository } from '../repositories/task-invitations.repository';
import { TaskMembersRepository } from '../../task-members/repositories/task-members.repository';
import { TasksRepository } from '../../tasks/repositories/tasks.repository';
import { DrizzleService } from '../../../db/drizzle.service';

function normaliseEmail(value: string) {
  return value.trim().toLowerCase();
}

function hashInvitationToken(rawToken: string) {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

@Injectable()
export class TaskInvitationsService {
  constructor(
    private readonly repository: TaskInvitationsRepository,
    private readonly configService: ConfigService,
    private readonly taskMembersRepository: TaskMembersRepository,
    private readonly tasksRepository: TasksRepository,
    private readonly drizzle: DrizzleService,
  ) {}

  async list(taskId: string) {
    return this.repository.findByTask(taskId);
  }

  async createDraft(
    taskId: string,
    invitedBy: string,
    input: { email: string; name?: string; affiliation?: string },
  ) {
    const task = await this.tasksRepository.findByIdGlobal(taskId);
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const invitation = await this.repository.create({
      taskId,
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
  async send(taskId: string, id: string) {
    const draft = await this.repository.findById(taskId, id);
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
      sql`SELECT find_task_title_for_invitation(${invitation.taskId}) as title`,
    );
    const taskTitle =
      (titleResult.rows[0] as { title: string | null } | undefined)?.title ??
      null;
    const { token: _hash, ...safeInvitation } = invitation;
    return { ...safeInvitation, taskTitle };
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

    const task = await this.tasksRepository.findByIdGlobal(invitation.taskId);
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    await this.taskMembersRepository.create({
      tenantId: task.tenantId,
      taskId: invitation.taskId,
      userId,
    });

    return this.repository.markAccepted(invitation.id);
  }

  async revoke(taskId: string, id: string) {
    const row = await this.repository.delete(taskId, id);
    if (!row) {
      throw new NotFoundException('Invitation not found');
    }
    return row;
  }
}
