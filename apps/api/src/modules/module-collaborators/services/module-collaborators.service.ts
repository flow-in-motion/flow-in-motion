// apps/api/src/modules/module-collaborators/services/module-collaborators.service.ts
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EnumRepository } from '../../enum/repositories/enum.repository';
import { ProjectModulesRepository } from '../../project-modules/repositories/project-modules.repository';
import { ModuleCollaboratorsRepository } from '../repositories/module-collaborators.repository';
import { UsersService } from '../../users/users.service';

@Injectable()
export class ModuleCollaboratorsService {
  constructor(
    private readonly repository: ModuleCollaboratorsRepository,
    private readonly modulesRepository: ProjectModulesRepository,
    private readonly enumRepository: EnumRepository,
    private readonly usersService: UsersService,
  ) {}

  async assertCanManageCollaborators(
    tenantId: string,
    moduleId: string,
    callerUserId: string,
  ): Promise<void> {
    const module = await this.modulesRepository.findById(tenantId, moduleId);
    if (!module) {
      throw new NotFoundException('Module not found');
    }

    if (
      module.projectId &&
      (await this.modulesRepository.isProjectOwner(
        tenantId,
        module.projectId,
        callerUserId,
      ))
    ) {
      return;
    }

    const membership = await this.repository.findByModuleAndUser(
      tenantId,
      moduleId,
      callerUserId,
    );

    if (membership) {
      const ownerRole = await this.enumRepository.findByCategoryAndValue(
        'project_role',
        'Owner',
      );

      if (ownerRole && membership.roleId === ownerRole.id) {
        return;
      }
    }

    throw new ForbiddenException(
      'Only the paper owner or project owner can manage paper collaborators',
    );
  }

  /**
   * Explicit paper collaborators and the parent project owner can view
   * the paper's collaborators. Other project collaborators cannot.
   */
  async list(tenantId: string, moduleId: string, callerUserId: string) {
    const module = await this.modulesRepository.findById(tenantId, moduleId);
    if (!module) {
      throw new NotFoundException('Module not found');
    }

    const membership = await this.repository.findByModuleAndUser(
      tenantId,
      moduleId,
      callerUserId,
    );

    const hasAccess =
      Boolean(membership) ||
      Boolean(
        module.projectId &&
        (await this.modulesRepository.isProjectOwner(
          tenantId,
          module.projectId,
          callerUserId,
        )),
      );

    if (!hasAccess) {
      throw new NotFoundException('Module not found');
    }

    const rows = await this.repository.findByModule(tenantId, moduleId);
    return this.withDisplayValues(rows);
  }

  async listContacts(tenantId: string, moduleId: string, callerUserId: string) {
    const [collaborators, invitations, callerSummaries] = await Promise.all([
      this.list(tenantId, moduleId, callerUserId),
      this.repository.findInvitationContactsByModule(moduleId),
      this.usersService.findSummariesByIds([callerUserId]),
    ]);
    const contactsByEmail = new Map<
      string,
      {
        id: string;
        userId: string | null;
        invitationId: string | null;
        displayName: string | null;
        affiliation: string | null;
      }
    >();
    const callerEmail = callerSummaries[0]?.email.trim().toLowerCase();

    for (const collaborator of collaborators) {
      if (collaborator.userId === callerUserId) continue;
      const key =
        collaborator.email?.trim().toLowerCase() ||
        `user:${collaborator.userId}`;
      contactsByEmail.set(key, {
        id: `user:${collaborator.userId}`,
        userId: collaborator.userId,
        invitationId: null,
        displayName: collaborator.displayName ?? null,
        affiliation: collaborator.affiliation ?? null,
      });
    }

    for (const invitation of invitations) {
      const key = invitation.email.trim().toLowerCase();
      if (key === callerEmail) continue;
      const existing = contactsByEmail.get(key);
      if (existing) {
        existing.invitationId ??= invitation.invitationId;
        existing.displayName ??= invitation.displayName;
        existing.affiliation ??= invitation.affiliation;
        continue;
      }
      contactsByEmail.set(key, {
        id: `invitation:${invitation.invitationId}`,
        userId: null,
        invitationId: invitation.invitationId,
        displayName: invitation.displayName,
        affiliation: invitation.affiliation,
      });
    }

    return [...contactsByEmail.values()].sort((left, right) =>
      (left.displayName ?? left.affiliation ?? '').localeCompare(
        right.displayName ?? right.affiliation ?? '',
      ),
    );
  }

  async add(
    tenantId: string,
    moduleId: string,
    userId: string,
    role: string,
    callerUserId: string,
  ) {
    await this.assertCanManageCollaborators(tenantId, moduleId, callerUserId);

    const module = await this.modulesRepository.findById(tenantId, moduleId);
    if (!module) {
      throw new NotFoundException('Module not found');
    }

    const existing = await this.repository.findByModuleAndUser(
      tenantId,
      moduleId,
      userId,
    );
    if (existing) {
      throw new ConflictException(
        'This user is already a collaborator on this module',
      );
    }

    const roleId = await this.resolveRole(role);

    const row = await this.repository.create({
      tenantId,
      projectId: module.projectId ?? undefined,
      moduleId,
      userId,
      roleId,
    });
    if (!row) {
      throw new NotFoundException('Failed to add collaborator');
    }
    const [shaped] = await this.withDisplayValues([row]);
    return shaped;
  }

  async updateRole(
    tenantId: string,
    moduleId: string,
    userId: string,
    role: string,
    callerUserId: string,
  ) {
    await this.assertCanManageCollaborators(tenantId, moduleId, callerUserId);

    const roleId = await this.resolveRole(role);

    const row = await this.repository.updateRole(
      tenantId,
      moduleId,
      userId,
      roleId,
    );
    if (!row) {
      throw new NotFoundException('Collaborator not found on this module');
    }
    const [shaped] = await this.withDisplayValues([row]);
    return shaped;
  }

  async remove(
    tenantId: string,
    moduleId: string,
    userId: string,
    callerUserId: string,
  ) {
    await this.assertCanManageCollaborators(tenantId, moduleId, callerUserId);

    const row = await this.repository.delete(tenantId, moduleId, userId);
    if (!row) {
      throw new NotFoundException('Collaborator not found on this module');
    }
    return row;
  }

  private async resolveRole(role: string): Promise<string> {
    const match = await this.enumRepository.findByCategoryAndValue(
      'project_role',
      role,
    );
    if (!match) {
      throw new NotFoundException(`Unknown project role: "${role}"`);
    }
    return match.id;
  }

  private async withDisplayValues<T extends { roleId: string; userId: string }>(
    rows: T[],
  ) {
    const [valuesById, users] = await Promise.all([
      this.enumRepository.findValuesByIds(rows.map((row) => row.roleId)),
      this.usersService.findSummariesByIds(rows.map((row) => row.userId)),
    ]);
    const usersById = new Map(users.map((user) => [user.id, user]));

    return rows.map(({ roleId, ...rest }) => ({
      ...rest,
      role: valuesById.get(roleId) ?? null,
      displayName: usersById.get(rest.userId)?.displayName ?? null,
      email: usersById.get(rest.userId)?.email ?? null,
      affiliation: usersById.get(rest.userId)?.affiliation ?? null,
    }));
  }
}
