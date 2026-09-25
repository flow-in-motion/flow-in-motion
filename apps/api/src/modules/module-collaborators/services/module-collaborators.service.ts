// apps/api/src/modules/module-collaborators/services/module-collaborators.service.ts
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EnumRepository } from '../../enum/repositories/enum.repository';
import { ProjectCollaboratorsRepository } from '../../project-collaborators/repositories/project-collaborators.repository';
import { ProjectModulesRepository } from '../../project-modules/repositories/project-modules.repository';
import { ModuleCollaboratorsRepository } from '../repositories/module-collaborators.repository';
import { UsersService } from '../../users/users.service';
import { MembershipsRepository } from '../../memberships/repositories/memberships.repository';

@Injectable()
export class ModuleCollaboratorsService {
  constructor(
    private readonly repository: ModuleCollaboratorsRepository,
    private readonly modulesRepository: ProjectModulesRepository,
    private readonly projectCollaboratorsRepository: ProjectCollaboratorsRepository,
    private readonly enumRepository: EnumRepository,
    private readonly usersService: UsersService,
    private readonly membershipsRepository: MembershipsRepository,
  ) {}

  async ensureOwnerMembership(
    tenantId: string,
    moduleId: string,
    callerUserId: string,
  ) {
    const existing = await this.repository.findByModuleAndUser(
      tenantId,
      moduleId,
      callerUserId,
    );
    if (existing) return existing;

    const module = await this.modulesRepository.findById(tenantId, moduleId);
    if (!module) return undefined;

    const ownerRole = await this.enumRepository.findByCategoryAndValue(
      'project_role',
      'Owner',
    );
    if (!ownerRole) return undefined;

    const callerOwnsModule = module.projectId
      ? (
          await this.projectCollaboratorsRepository.findByProjectAndUser(
            tenantId,
            module.projectId,
            callerUserId,
          )
        )?.roleId === ownerRole.id
      : false;

    const tenantMembership = module.projectId
      ? undefined
      : await this.membershipsRepository.findMembershipByTenantAndUser(
          tenantId,
          callerUserId,
        );
    const callerOwnsTenant =
      tenantMembership?.status === 'active' &&
      tenantMembership.role === 'owner';

    if (!callerOwnsModule && !callerOwnsTenant) return undefined;

    return this.repository.create({
      tenantId,
      projectId: module.projectId ?? undefined,
      moduleId,
      userId: callerUserId,
      roleId: ownerRole.id,
    });
  }

  /**
   * The collaborator list is itself only visible to someone who can already
   * see the paper: for a project-scoped paper, a collaborator on that
   * project, or an existing direct paper collaborator.
   */
  async list(tenantId: string, moduleId: string, callerUserId: string) {
    const module = await this.modulesRepository.findById(tenantId, moduleId);
    if (!module) {
      throw new NotFoundException('Paper not found');
    }

    await this.ensureOwnerMembership(tenantId, moduleId, callerUserId);

    const hasAccess = module.projectId
      ? Boolean(
          await this.projectCollaboratorsRepository.findByProjectAndUser(
            tenantId,
            module.projectId,
            callerUserId,
          ),
        )
      : Boolean(
          await this.repository.findByModuleAndUser(
            tenantId,
            moduleId,
            callerUserId,
          ),
        );
    if (!hasAccess) {
      throw new NotFoundException('Paper not found');
    }

    const rows = await this.repository.findByModule(tenantId, moduleId);
    return this.withDisplayValues(rows);
  }

  async add(tenantId: string, moduleId: string, userId: string, role: string) {
    const module = await this.modulesRepository.findById(tenantId, moduleId);
    if (!module) {
      throw new NotFoundException('Paper not found');
    }

    const existing = await this.repository.findByModuleAndUser(
      tenantId,
      moduleId,
      userId,
    );
    if (existing) {
      throw new ConflictException(
        'This user is already a collaborator on this paper',
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
  ) {
    const roleId = await this.resolveRole(role);

    const row = await this.repository.updateRole(
      tenantId,
      moduleId,
      userId,
      roleId,
    );
    if (!row) {
      throw new NotFoundException('Collaborator not found on this paper');
    }
    const [shaped] = await this.withDisplayValues([row]);
    return shaped;
  }

  async remove(tenantId: string, moduleId: string, userId: string) {
    const row = await this.repository.delete(tenantId, moduleId, userId);
    if (!row) {
      throw new NotFoundException('Collaborator not found on this paper');
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
