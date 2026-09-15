import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { ProjectInvitationsRepository } from '../repositories/project-invitations.repository';
import { ProjectCollaboratorsRepository } from '../../project-collaborators/repositories/project-collaborators.repository';
import { EnumRepository } from '../../enum/repositories/enum.repository';
import { ProjectsRepository } from '../../projects/repositories/projects.repository';
import { DrizzleService } from '../../../db/drizzle.service';
import { sql } from 'drizzle-orm';

function normaliseEmail(value: string) {
  return value.trim().toLowerCase();
}

function hashInvitationToken(rawToken: string) {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

@Injectable()
export class ProjectInvitationsService {
  constructor(
    private readonly repository: ProjectInvitationsRepository,
    private readonly configService: ConfigService,
    private readonly collaboratorsRepository: ProjectCollaboratorsRepository,
    private readonly enumRepository: EnumRepository,
    private readonly projectsRepository: ProjectsRepository,
    private readonly drizzle: DrizzleService,
  ) {}

  async list(projectId: string) {
    return this.repository.findByProject(projectId);
  }

  async createDraft(
    projectId: string,
    invitedBy: string,
    input: { email: string; name?: string; affiliation?: string },
  ) {
    const project = await this.projectsRepository.findByIdGlobal(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const invitation = await this.repository.create({
      projectId,
      email: normaliseEmail(input.email),
      name: input.name,
      affiliation: input.affiliation,
      role: 'Collaborator',
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
  async send(projectId: string, id: string) {
    const draft = await this.repository.findById(projectId, id);
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

    // The raw token is only ever returned here, once. Only its hash is stored.
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
      sql`SELECT find_project_title_for_invitation(${invitation.projectId}) as title`,
    );
    const projectTitle =
      (titleResult.rows[0] as { title: string | null } | undefined)?.title ??
      null;
    const { token: _hash, ...safeInvitation } = invitation;
    return { ...safeInvitation, projectTitle };
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

    const roleId = await this.enumRepository.findByCategoryAndValue(
      'project_role',
      invitation.role,
    );
    if (!roleId) {
      throw new NotFoundException(`Unknown project role: "${invitation.role}"`);
    }

    const projectResult = await this.drizzle.db.execute(
      sql`SELECT * FROM find_project_by_id_for_invitation(${invitation.projectId})`,
    );
    const projectRow = projectResult.rows[0] as
      { tenant_id: string } | undefined;
    if (!projectRow?.tenant_id) {
      throw new NotFoundException('Project not found');
    }

    await this.collaboratorsRepository.create({
      tenantId: projectRow.tenant_id,
      projectId: invitation.projectId,
      userId,
      roleId: roleId.id,
    });

    return this.repository.markAccepted(invitation.id);
  }

  async revoke(projectId: string, id: string) {
    const row = await this.repository.delete(projectId, id);
    if (!row) {
      throw new NotFoundException('Invitation not found');
    }
    return row;
  }

  async listForEmail(email: string) {
    return this.repository.findByEmail(normaliseEmail(email));
  }

  async listForEmailWithTitles(email: string) {
    const invitations = await this.repository.findByEmail(
      normaliseEmail(email),
    );
    const projectIds = invitations.map((i) => i.projectId);

    const titleResult = await this.drizzle.db.execute(
      sql`SELECT project_id, title FROM find_project_titles_for_invitations(${projectIds}::uuid[])`,
    );

    const titlesByProjectId = new Map(
      (titleResult.rows as { project_id: string; title: string | null }[]).map(
        (row) => [row.project_id, row.title],
      ),
    );

    return invitations.map(({ token: _token, ...rest }) => ({
      type: 'project' as const,
      ...rest,
      projectTitle: titlesByProjectId.get(rest.projectId) ?? null,
    }));
  }
}
