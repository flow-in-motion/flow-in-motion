// apps/api/src/modules/project-collaborators/services/project-collaborators.service.ts
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EnumRepository } from '../../enum/repositories/enum.repository';
import { UsersService } from '../../users/users.service';
import { ProjectCollaboratorsRepository } from '../repositories/project-collaborators.repository';

@Injectable()
export class ProjectCollaboratorsService {
  constructor(
    private readonly repository: ProjectCollaboratorsRepository,
    private readonly enumRepository: EnumRepository,
    private readonly usersService: UsersService,
  ) {}

  /**
   * The collaborator list is itself only visible to someone who is already
   * a collaborator on the project (the project owner is always inserted as
   * a collaborator at creation time, so this single check covers both).
   */
  async list(tenantId: string, projectId: string, callerUserId: string) {
    const membership = await this.repository.findByProjectAndUser(
      tenantId,
      projectId,
      callerUserId,
    );
    if (!membership) {
      throw new NotFoundException('Project not found');
    }
    const rows = await this.repository.findByProject(tenantId, projectId);
    return this.withDisplayValues(rows);
  }

  async add(tenantId: string, projectId: string, userId: string, role: string) {
    const existing = await this.repository.findByProjectAndUser(
      tenantId,
      projectId,
      userId,
    );
    if (existing) {
      throw new ConflictException(
        'This user is already a collaborator on this project',
      );
    }

    const roleId = await this.resolveRole(role);

    const row = await this.repository.create({
      tenantId,
      projectId,
      userId,
      roleId,
    });
    if (!row) {
      throw new NotFoundException('Failed to add collaborator ');
    }
    const [shaped] = await this.withDisplayValues([row]);
    return shaped;
  }

  async updateRole(
    tenantId: string,
    projectId: string,
    userId: string,
    role: string,
  ) {
    const roleId = await this.resolveRole(role);

    const row = await this.repository.updateRole(
      tenantId,
      projectId,
      userId,
      roleId,
    );
    if (!row) {
      throw new NotFoundException('Collaborator not found on this project');
    }
    const [shaped] = await this.withDisplayValues([row]);
    return shaped;
  }

  async remove(tenantId: string, projectId: string, userId: string) {
    const row = await this.repository.delete(tenantId, projectId, userId);
    if (!row) {
      throw new NotFoundException('Collaborator not found on this project');
    }
    return row;
  }

  private async withDisplayValues<T extends { roleId: string; userId: string }>(
    rows: T[],
  ) {
    const roleIds = rows.map((r) => r.roleId);
    const [valuesById, users] = await Promise.all([
      this.enumRepository.findValuesByIds(roleIds),
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
}
