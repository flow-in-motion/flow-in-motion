import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EnumRepository } from '../../enum/repositories/enum.repository';
import { ModuleCollaboratorsRepository } from '../../module-collaborators/repositories/module-collaborators.repository';
import { ProjectCollaboratorsRepository } from '../../project-collaborators/repositories/project-collaborators.repository';
import { TenantSequencesRepository } from '../../tenant-sequences/repositories/tenant-sequences.repository';
import { ProjectModulesRepository } from '../repositories/project-modules.repository';
import { ProjectsRepository } from '../../projects/repositories/projects.repository';
import {
  buildPaginationMeta,
  paginationOffset,
} from '../../../common/pagination';
const ARCHIVE_RETENTION_DAYS = 14;

@Injectable()
export class ProjectModulesService {
  constructor(
    private readonly repository: ProjectModulesRepository,
    private readonly enumRepository: EnumRepository,
    private readonly collaboratorsRepository: ModuleCollaboratorsRepository,
    private readonly projectCollaboratorsRepository: ProjectCollaboratorsRepository,
    private readonly projectsRepository: ProjectsRepository,
    private readonly sequences: TenantSequencesRepository,
  ) {}

  /**
   * A module with a parent project inherits that project's visibility
   * (owner or project_collaborators — the owner is always inserted as a
   * collaborator at project-creation time, so a single collaborator check
   * covers both). An independent module (no project) is only visible to its
   * own module_collaborators.
   */
  private async canAccess(
    tenantId: string,
    module: { id: string; projectId: string | null },
    callerUserId: string,
  ): Promise<boolean> {
    if (module.projectId) {
      const projectMembership =
        await this.projectCollaboratorsRepository.findByProjectAndUser(
          tenantId,
          module.projectId,
          callerUserId,
        );
      return Boolean(projectMembership);
    }
    const moduleMembership =
      await this.collaboratorsRepository.findByModuleAndUser(
        tenantId,
        module.id,
        callerUserId,
      );
    return Boolean(moduleMembership);
  }

  async listActive(
    tenantId: string,
    callerUserId: string,
    page: number,
    pageSize: number,
    projectId?: string,
  ) {
    const offset = paginationOffset(page, pageSize);

    const { data, totalItems } =
      await this.repository.findVisibleActiveByTenant(
        tenantId,
        callerUserId,
        offset,
        pageSize,
        projectId,
      );

    const modulesWithDisplayValues = await this.withDisplayValues(
      data,
      callerUserId,
    );

    return {
      data: modulesWithDisplayValues,
      meta: buildPaginationMeta(page, pageSize, totalItems),
    };
  }

  async findOne(tenantId: string, moduleId: string, callerUserId: string) {
    const module = await this.repository.findById(tenantId, moduleId);
    if (!module || !(await this.canAccess(tenantId, module, callerUserId))) {
      throw new NotFoundException('Module not found');
    }
    const [shaped] = await this.withDisplayValues([module], callerUserId);
    return shaped;
  }

  /**
   * Tenant-agnostic: every module the caller can access, regardless of
   * which workspace it lives in — a module linked to any project the caller
   * can access (owner or project_collaborators row), plus every independent
   * module the caller is a direct module_collaborators row on. Mirrors
   * ProjectsService.listForCaller / TasksService.listForCaller.
   */
  async listForCaller(callerUserId: string, page: number, pageSize: number) {
    const offset = paginationOffset(page, pageSize);

    const { data, totalItems } = await this.repository.findAccessiblePageByUser(
      callerUserId,
      offset,
      pageSize,
    );

    const modulesWithDisplayValues = await this.withDisplayValues(
      data,
      callerUserId,
    );

    return {
      data: modulesWithDisplayValues,
      meta: buildPaginationMeta(page, pageSize, totalItems),
    };
  }

  /** Tenant-agnostic single-module fetch — see listForCaller. */
  async findOneForCaller(moduleId: string, callerUserId: string) {
    const module = await this.repository.findByIdGlobal(moduleId);
    if (!module) {
      throw new NotFoundException('Module not found');
    }
    return this.findOne(module.tenantId, moduleId, callerUserId);
  }

  private async ensureProjectOwnedByCaller(
    tenantId: string,
    projectId: string,
    callerUserId: string,
  ) {
    const project = await this.projectsRepository.findById(tenantId, projectId);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.userId !== callerUserId) {
      throw new ForbiddenException(
        'Papers can only be added to projects owned by the current user',
      );
    }

    return project;
  }

  async create(
    tenantId: string,
    callerUserId: string,
    input: {
      projectId: string;
      shortTitle: string;
      title?: string;
      description?: string;
      abstract?: string;
      targetJournal?: string;
      backupJournal?: string;
      targetConference?: string;
      backupConference?: string;
      tag?: string;
      status?: string;
      pipelineStage?: string;
      assignedToUserId?: string;
      dueDate?: string;
    },
  ) {
    await this.ensureProjectOwnedByCaller(
      tenantId,
      input.projectId,
      callerUserId,
    );
    const tagId = await this.resolveEnum('module_type', input.tag);
    const statusId = await this.resolveEnum('project_status', input.status);
    const pipelineStageId = input.pipelineStage
      ? await this.resolveModulePipelineStage(tenantId, input.pipelineStage)
      : undefined;
    const ownerRoleId = await this.resolveEnum('project_role', 'Owner');
    const displayId = await this.sequences.nextDisplayId(tenantId, 'module');

    const createValues = {
      projectId: input.projectId,
      tenantId,
      shortTitle: input.shortTitle,
      title: input.title,
      description: input.description,
      abstract: input.abstract,
      targetJournal: input.targetJournal,
      backupJournal: input.backupJournal,
      targetConference: input.targetConference,
      backupConference: input.backupConference,
      tagId,
      statusId,
      pipelineStageId,
      pipelineStageChangedAt: new Date(),
      assignedToUserId: input.assignedToUserId,
      dueDate: input.dueDate,
      displayId,
    };
    const module = await this.repository.create(createValues);

    if (!module) {
      throw new NotFoundException('Failed to create module');
    }

    if (!ownerRoleId) {
      throw new NotFoundException(
        'Owner role is not configured in the enum table',
      );
    }
    await this.collaboratorsRepository.create({
      tenantId,
      moduleId: module.id,
      userId: callerUserId,
      roleId: ownerRoleId,
    });

    const [shaped] = await this.withDisplayValues([module], callerUserId);
    return shaped;
  }

  async update(
    tenantId: string,
    moduleId: string,
    callerUserId: string,
    input: Partial<{
      shortTitle: string;
      title: string;
      description: string;
      abstract: string;
      targetJournal: string;
      backupJournal: string;
      targetConference: string;
      backupConference: string;
      projectId: string;
      tag: string;
      status: string;
      pipelineStage: string;
      assignedToUserId: string;
      dueDate: string;
    }>,
  ) {
    const existing = await this.findOne(tenantId, moduleId, callerUserId);
    if (Object.prototype.hasOwnProperty.call(input, 'projectId')) {
      if (!input.projectId) {
        throw new BadRequestException(
          'A paper must belong to a project. Use the General project for independent papers.',
        );
      }

      await this.ensureProjectOwnedByCaller(
        tenantId,
        input.projectId,
        callerUserId,
      );
    }

    const [tagId, statusId, pipelineStageId] = await Promise.all([
      input.tag ? this.resolveEnum('module_type', input.tag) : undefined,
      input.status
        ? this.resolveEnum('project_status', input.status)
        : undefined,
      input.pipelineStage
        ? this.resolveModulePipelineStage(tenantId, input.pipelineStage)
        : undefined,
    ]);

    const stageChanged =
      input.pipelineStage !== undefined &&
      input.pipelineStage !== existing?.pipelineStage;

    const module = await this.repository.update(tenantId, moduleId, {
      shortTitle: input.shortTitle,
      title: input.title,
      description: input.description,
      abstract: input.abstract,
      targetJournal: input.targetJournal,
      backupJournal: input.backupJournal,
      targetConference: input.targetConference,
      backupConference: input.backupConference,
      projectId: input.projectId,
      tagId,
      statusId,
      pipelineStageId,
      pipelineStageChangedAt: stageChanged ? new Date() : undefined,
      assignedToUserId: input.assignedToUserId,
      dueDate: input.dueDate,
    });

    if (!module) {
      throw new NotFoundException('Module not found');
    }

    const [shaped] = await this.withDisplayValues([module], callerUserId);
    return shaped;
  }

  /** Tenant-agnostic update — resolves the module's real tenant first, then
   * delegates to the normal (still access-checked) update flow. */
  async updateForCaller(
    moduleId: string,
    callerUserId: string,
    input: Parameters<ProjectModulesService['update']>[3],
  ) {
    const module = await this.repository.findByIdGlobal(moduleId);
    if (!module) {
      throw new NotFoundException('Module not found');
    }
    return this.update(module.tenantId, moduleId, callerUserId, input);
  }

  async archive(tenantId: string, moduleId: string, callerUserId: string) {
    const existingModule = await this.repository.findById(tenantId, moduleId);
    if (!existingModule) {
      throw new NotFoundException('Module not found');
    }
    const ownerMembership =
      await this.collaboratorsRepository.findByModuleAndUser(
        tenantId,
        moduleId,
        callerUserId,
      );
    const ownerRole = await this.enumRepository.findByCategoryAndValue(
      'project_role',
      'Owner',
    );
    if (
      !ownerMembership ||
      !ownerRole ||
      ownerMembership.roleId !== ownerRole.id
    ) {
      throw new ForbiddenException(
        'Only the module owner can archive this module',
      );
    }

    const archivedStatusId = await this.resolveEnum(
      'project_status',
      'Archived',
    );
    if (!archivedStatusId) {
      throw new NotFoundException(
        'Archived status is not configured in the enum table',
      );
    }

    const module = await this.repository.archive(
      tenantId,
      moduleId,
      archivedStatusId,
    );
    if (!module) {
      throw new NotFoundException('Module not found');
    }

    const [shaped] = await this.withDisplayValues([module], callerUserId);

    return {
      module: shaped,
      warning: `This module has been archived and will be permanently deleted in ${ARCHIVE_RETENTION_DAYS} days.`,
    };
  }

  /** Tenant-agnostic archive — see updateForCaller. */
  async archiveForCaller(moduleId: string, callerUserId: string) {
    const module = await this.repository.findByIdGlobal(moduleId);
    if (!module) {
      throw new NotFoundException('Module not found');
    }
    return this.archive(module.tenantId, moduleId, callerUserId);
  }

  private async withDisplayValues<
    T extends {
      id: string;
      tagId: string | null;
      statusId: string | null;
      pipelineStageId: string | null;
    },
  >(rows: T[], _callerUserId: string) {
    const enumIds = rows
      .flatMap((row) => [row.tagId, row.statusId, row.pipelineStageId])
      .filter((id): id is string => id !== null);
    const valuesById = await this.enumRepository.findValuesByIds(enumIds);

    return rows.map(({ tagId, statusId, pipelineStageId, ...rest }) => ({
      ...rest,
      tag: tagId ? (valuesById.get(tagId) ?? null) : null,
      status: statusId ? (valuesById.get(statusId) ?? null) : null,
      pipelineStage: pipelineStageId
        ? (valuesById.get(pipelineStageId) ?? null)
        : null,
    }));
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

  private async resolveModulePipelineStage(tenantId: string, value: string) {
    const match = await this.enumRepository.findModuleStageByValueForTenant(
      tenantId,
      value,
    );
    if (!match) {
      throw new NotFoundException(
        `Unknown module_pipeline_stage value: "${value}"`,
      );
    }
    return match.id;
  }
}
