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
  ) {
    const limit = listPageSize(pageSize);
    const requestedPage = pageSize === 'all' ? 1 : page;
    const offset = paginationOffset(requestedPage, limit);

    const [{ data: rows, totalItems, summary }, generalRow] = await Promise.all([
      this.repository.findActiveByTenant(tenantId, offset, limit),
      this.repository.findGeneralByTenant(tenantId),
    ]);

    const rowsToShape =
      generalRow && !rows.some((project) => project.id === generalRow.id)
        ? [...rows, generalRow]
        : rows;
    const shaped = await this.withDisplayValues(rowsToShape, callerUserId);
    const generalProject = generalRow
      ? shaped.find((project) => project.id === generalRow.id) ?? null
      : null;
    const pageIds = new Set(rows.map((project) => project.id));

    assertAllFits(pageSize, totalItems);

    return {
      generalProject,
      data: shaped.filter((project) => pageIds.has(project.id)),
      summary,
      meta: buildPaginationMeta(requestedPage, limit, totalItems),
    };
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
    if (project.archivedAt) {
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
    options: { isGeneral?: boolean } = {},
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
      isGeneral: options.isGeneral ?? false,
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

  async archive(
    tenantId: string,
    projectId: string,
    callerUserId: string,
    input: { contentAction: 'archive' | 'move'; destinationProjectId?: string } = {
      contentAction: 'archive',
    },
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
    if (existingProject.isGeneral) {
      throw new BadRequestException(
        'The built-in project cannot be archived because every paper needs a fallback project.',
      );
    }
    if (existingProject.archivedAt) {
      throw new BadRequestException('This project is already archived');
    }

    if (input.contentAction === 'move') {
      if (!input.destinationProjectId) {
        throw new BadRequestException(
          'Choose a destination project before archiving this project.',
        );
      }
      if (input.destinationProjectId === projectId) {
        throw new BadRequestException(
          'The destination project must be different from the project being archived.',
        );
      }

      const destination = await this.repository.findById(
        tenantId,
        input.destinationProjectId,
      );
      if (
        !destination ||
        destination.archivedAt ||
        destination.userId !== callerUserId
      ) {
        throw new BadRequestException(
          'Choose an active project that you own as the destination.',
        );
      }

      await this.repository.moveContentsToProject(
        tenantId,
        projectId,
        destination.id,
      );
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
    return this.archive(project.tenantId, projectId, callerUserId, {
      contentAction: 'archive',
    });
  }

  async archiveImpact(
    tenantId: string,
    projectId: string,
    callerUserId: string,
  ) {
    const project = await this.repository.findById(tenantId, projectId);
    if (!project || project.archivedAt) {
      throw new NotFoundException('Project not found');
    }
    if (project.userId !== callerUserId) {
      throw new ForbiddenException(
        'Only the project owner can archive this project',
      );
    }
    if (project.isGeneral) {
      throw new BadRequestException('The built-in project cannot be archived');
    }
    return this.repository.archiveImpact(tenantId, projectId);
  }

  async listArchived(tenantId: string, callerUserId: string) {
    const projects = await this.repository.findArchivedByTenant(
      tenantId,
      callerUserId,
    );
    return this.withDisplayValues(projects, callerUserId);
  }

  async restore(tenantId: string, projectId: string, callerUserId: string) {
    const project = await this.repository.findById(tenantId, projectId);
    if (!project || !project.archivedAt) {
      throw new NotFoundException('Archived project not found');
    }
    if (project.userId !== callerUserId) {
      throw new ForbiddenException(
        'Only the project owner can restore this project',
      );
    }

    const restored = await this.repository.restore(tenantId, projectId);
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
    const project = await this.repository.findById(tenantId, projectId);
    if (!project || !project.archivedAt) {
      throw new NotFoundException('Archived project not found');
    }
    if (project.userId !== callerUserId) {
      throw new ForbiddenException(
        'Only the project owner can permanently delete this project',
      );
    }
    if (project.isGeneral) {
      throw new BadRequestException('The built-in project cannot be deleted');
    }

    const deleted = await this.repository.permanentlyDelete(
      tenantId,
      projectId,
    );
    if (!deleted) {
      throw new NotFoundException('Archived project not found');
    }
    return { message: 'Project permanently deleted' };
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
