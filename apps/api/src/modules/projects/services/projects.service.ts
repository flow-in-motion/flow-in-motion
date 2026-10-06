import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EnumRepository } from '../../enum/repositories/enum.repository';
import { ProjectCollaboratorsRepository } from '../../project-collaborators/repositories/project-collaborators.repository';
import { TenantSequencesRepository } from '../../tenant-sequences/repositories/tenant-sequences.repository';
import { ProjectsRepository } from '../repositories/projects.repository';
import {
  assertAllFits,
  buildPaginationMeta,
  listPageSize,
  paginationOffset,
} from '../../../common/pagination';
import type { ProjectArchiveMode } from '../dto/archive-project.dto';

const ARCHIVE_RETENTION_DAYS = 14;

@Injectable()
export class ProjectsService {
  constructor(
    private readonly repository: ProjectsRepository,
    private readonly enumRepository: EnumRepository,
    private readonly collaboratorsRepository: ProjectCollaboratorsRepository,
    private readonly sequences: TenantSequencesRepository,
  ) {}

  async listActive(
    tenantId: string,
    callerUserId: string,
    page: number,
    pageSize: number | 'all',
    search?: string,
  ) {
    const limit = listPageSize(pageSize);
    const requestedPage = pageSize === 'all' ? 1 : page;
    const offset = paginationOffset(requestedPage, limit);

    const [{ data: rows, totalItems }, generalRow] = await Promise.all([
      this.repository.findActiveByTenant(tenantId, offset, limit, search),
      this.repository.findGeneralByTenant(tenantId),
    ]);

    assertAllFits(pageSize, totalItems);

    const rowsToShape = generalRow ? [generalRow, ...rows] : rows;
    const shaped = await this.withDisplayValues(rowsToShape, callerUserId);

    return {
      generalProject: generalRow ? (shaped[0] ?? null) : null,
      data: generalRow ? shaped.slice(1) : shaped,
      meta: buildPaginationMeta(requestedPage, limit, totalItems),
    };
  }

  async listArchived(tenantId: string, callerUserId: string) {
    const rows = await this.repository.findArchivedByTenant(
      tenantId,
      callerUserId,
    );
    return this.withDisplayValues(rows, callerUserId);
  }

  /**
   * Visible only to the project's owner or a project_collaborators row for
   * the caller — a tenant member with neither is treated as if the project
   * doesn't exist, not merely forbidden, so its existence isn't leaked.
   */
  async findOne(tenantId: string, projectId: string, callerUserId: string) {
    const project = await this.repository.findById(tenantId, projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    const [shaped] = await this.withDisplayValues([project], callerUserId);
    if (shaped!.role === null && project.userId !== callerUserId) {
      throw new NotFoundException('Project not found');
    }
    return shaped;
  }

  /**
   * Tenant-agnostic: every project the caller owns or collaborates on,
   * regardless of which workspace it lives in. The owner is always inserted
   * as a project_collaborators row at creation time, so a single query over
   * that table already covers both cases — mirrors TasksService.listForCaller.
   */
  async listForCaller(callerUserId: string, page: number, pageSize: number) {
    const offset = paginationOffset(page, pageSize);

    const { data, totalItems } = await this.repository.findAccessiblePageByUser(
      callerUserId,
      offset,
      pageSize,
    );

    const projectsWithDisplayValues = await this.withDisplayValues(
      data,
      callerUserId,
    );

    return {
      data: projectsWithDisplayValues,
      meta: buildPaginationMeta(page, pageSize, totalItems),
    };
  }

  /** Tenant-agnostic single-project fetch — see listForCaller. */
  async findOneForCaller(projectId: string, callerUserId: string) {
    const project = await this.repository.findByIdGlobal(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return this.findOne(project.tenantId, projectId, callerUserId);
  }

  async create(
    userId: string,
    tenantId: string,
    input: {
      title: string;
      description?: string;
      researchArea?: string;
      status?: string;
      importance?: string;
      scheduledFor?: string;
      dueDate?: string;
      totalBudget?: string;
      targetJournals?: string;
    },
  ) {
    const [statusId, importanceId, ownerRoleId, displayId] = await Promise.all([
      this.resolveEnum('project_status', input.status),
      this.resolveEnum('importance', input.importance),
      this.resolveEnum('project_role', 'Owner'),
      this.sequences.nextDisplayId(tenantId, 'project'),
    ]);

    if (!ownerRoleId) {
      throw new NotFoundException(
        'Owner role is not configured in the enum table',
      );
    }

    const createValues = {
      userId,
      tenantId,
      title: input.title,
      description: input.description,
      researchArea: input.researchArea,
      statusId,
      importanceId,
      scheduledFor: input.scheduledFor,
      dueDate: input.dueDate,
      totalBudget: input.totalBudget,
      targetJournals: input.targetJournals,
      displayId,
    };
    const project = await this.repository.create(createValues, ownerRoleId);

    if (!project) {
      throw new NotFoundException('Failed to create project');
    }

    const [shaped] = await this.withDisplayValues([project], userId);
    return shaped;
  }

  async update(
    tenantId: string,
    projectId: string,
    callerUserId: string,
    input: Partial<{
      title: string;
      description: string;
      researchArea: string;
      status: string;
      importance: string;
      scheduledFor: string;
      dueDate: string;
      totalBudget: string;
      targetJournals: string;
    }>,
  ) {
    await this.findOne(tenantId, projectId, callerUserId);

    const [statusId, importanceId] = await Promise.all([
      input.status
        ? this.resolveEnum('project_status', input.status)
        : undefined,
      input.importance
        ? this.resolveEnum('importance', input.importance)
        : undefined,
    ]);

    const project = await this.repository.update(tenantId, projectId, {
      title: input.title,
      description: input.description,
      researchArea: input.researchArea,
      statusId,
      importanceId,
      scheduledFor: input.scheduledFor,
      dueDate: input.dueDate,
      totalBudget: input.totalBudget,
      targetJournals: input.targetJournals,
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const [shaped] = await this.withDisplayValues([project], callerUserId);
    return shaped;
  }

  /** Tenant-agnostic update — resolves the project's real tenant first, then
   * delegates to the normal (still access-checked) update flow. */
  async updateForCaller(
    projectId: string,
    callerUserId: string,
    input: Parameters<ProjectsService['update']>[3],
  ) {
    const project = await this.repository.findByIdGlobal(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return this.update(project.tenantId, projectId, callerUserId, input);
  }

  async archiveImpact(
    tenantId: string,
    projectId: string,
    callerUserId: string,
  ) {
    const existingProject = await this.repository.findById(tenantId, projectId);
    if (!existingProject) {
      throw new NotFoundException('Project not found');
    }
    if (existingProject.userId !== callerUserId) {
      throw new ForbiddenException(
        'Only the project owner can archive this project',
      );
    }

    return this.repository.archiveImpact(tenantId, projectId);
  }

  async archive(
    tenantId: string,
    projectId: string,
    callerUserId: string,
    input: {
      mode: ProjectArchiveMode;
      destinationProjectId?: string;
    } = { mode: 'archive_contents' },
  ) {
    const existingProject = await this.repository.findById(tenantId, projectId);
    if (!existingProject) {
      throw new NotFoundException('Project not found');
    }
    if (existingProject.userId !== callerUserId) {
      throw new ForbiddenException(
        'Only the project owner can archive this project',
      );
    }

    if (input.mode === 'move_contents') {
      if (!input.destinationProjectId) {
        throw new BadRequestException(
          'Choose a destination project before moving project contents',
        );
      }
      if (input.destinationProjectId === projectId) {
        throw new BadRequestException(
          'The destination project must be different from the archived project',
        );
      }
      const destination = await this.repository.findById(
        tenantId,
        input.destinationProjectId,
      );
      if (!destination || destination.userId !== callerUserId) {
        throw new BadRequestException(
          'Choose another active project that you own',
        );
      }
      await this.repository.moveContents(tenantId, projectId, destination.id);
    }

    const project = await this.repository.archive(tenantId, projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const [shaped] = await this.withDisplayValues([project], callerUserId);

    return {
      project: shaped,
      warning: `This project has been archived and will be permanently deleted in ${ARCHIVE_RETENTION_DAYS} days.`,
    };
  }

  /** Tenant-agnostic archive — see updateForCaller. */
  async archiveForCaller(projectId: string, callerUserId: string) {
    const project = await this.repository.findByIdGlobal(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return this.archive(project.tenantId, projectId, callerUserId);
  }

  async archiveImpactForCaller(projectId: string, callerUserId: string) {
    const project = await this.repository.findByIdGlobal(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return this.archiveImpact(project.tenantId, projectId, callerUserId);
  }

  async archiveForCallerWithOptions(
    projectId: string,
    callerUserId: string,
    input: Parameters<ProjectsService['archive']>[3],
  ) {
    const project = await this.repository.findByIdGlobal(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return this.archive(project.tenantId, projectId, callerUserId, input);
  }

  async restore(tenantId: string, projectId: string, callerUserId: string) {
    const existing = await this.repository.findArchivedById(
      tenantId,
      projectId,
    );
    if (!existing) {
      throw new NotFoundException('Archived project not found');
    }
    if (existing.userId !== callerUserId) {
      throw new ForbiddenException(
        'Only the project owner can restore this project',
      );
    }

    const [archivedStatusId, activeStatusId] = await Promise.all([
      this.resolveEnum('project_status', 'Archived'),
      this.resolveEnum('project_status', 'Active'),
    ]);
    const statusId =
      existing.statusId === archivedStatusId
        ? (activeStatusId ?? null)
        : existing.statusId;
    const restored = await this.repository.restore(
      tenantId,
      projectId,
      statusId,
    );
    if (!restored) {
      throw new NotFoundException('Archived project not found');
    }
    const [shaped] = await this.withDisplayValues([restored], callerUserId);
    return shaped;
  }

  async permanentlyDelete(
    tenantId: string,
    projectId: string,
    callerUserId: string,
  ) {
    const existing = await this.repository.findArchivedById(
      tenantId,
      projectId,
    );
    if (!existing) {
      throw new NotFoundException('Archived project not found');
    }
    if (existing.userId !== callerUserId) {
      throw new ForbiddenException(
        'Only the project owner can permanently delete this project',
      );
    }
    const deleted = await this.repository.permanentlyDelete(
      tenantId,
      projectId,
    );
    if (!deleted) {
      throw new NotFoundException('Archived project not found');
    }
    return { id: deleted.id };
  }

  private async withDisplayValues<
    T extends {
      id: string;
      tenantId: string;
      statusId: string | null;
      importanceId: string | null;
    },
  >(rows: T[], callerUserId: string) {
    const enumIds = rows
      .flatMap((r) => [r.statusId, r.importanceId])
      .filter((id): id is string => id !== null);

    const projectIds = rows.map((r) => r.id);

    const [valuesById, roleByProjectId] = await Promise.all([
      this.enumRepository.findValuesByIds(enumIds),
      this.collaboratorsRepository.findByProjectIdsAndUser(
        projectIds,
        callerUserId,
      ),
    ]);

    const roleIds = Array.from(roleByProjectId.values())
      .map((r) => r.roleId)
      .filter((id): id is string => !!id);
    const roleValuesById = await this.enumRepository.findValuesByIds(roleIds);

    return rows.map(({ id, statusId, importanceId, ...rest }) => {
      const roleId = roleByProjectId.get(id)?.roleId;
      return {
        id,
        ...rest,
        status: statusId ? (valuesById.get(statusId) ?? null) : null,
        importance: importanceId
          ? (valuesById.get(importanceId) ?? null)
          : null,
        role: roleId ? (roleValuesById.get(roleId) ?? null) : null,
      };
    });
  }

  private async resolveEnum(
    category: string,
    value?: string,
  ): Promise<string | undefined> {
    if (!value) return undefined;
    const match = await this.enumRepository.findByCategoryAndValue(
      category,
      value,
    );
    if (!match) {
      throw new NotFoundException(`Unknown ${category} value: "${value}"`);
    }
    return match.id;
  }
}
