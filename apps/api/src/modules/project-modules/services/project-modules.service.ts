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
  assertAllFits,
  listPageSize,
  buildPaginationMeta,
  paginationOffset,
} from '../../../common/pagination';
import type {
  ModuleSortField,
  SortDirection,
} from '../dto/list-modules-query.dto';
import type { CurrentlyWithType } from '../dto/create-module.dto';
import type { ModuleArchiveMode } from '../dto/archive-module.dto';
const ARCHIVE_RETENTION_DAYS = 14;
// Papers no longer use the "Review" status (being under review is a pipeline
// stage, not a status). Older clients may still send it, so treat it as Active.
const RETIRED_PAPER_STATUS = 'Review';
const DEFAULT_PAPER_STATUS = 'Active';
const SUBMITTED_UNDER_REVIEW_STAGE = 'Submitted, Under Review';
const ACTIVE_SUBMISSION_STATUSES = new Set([
  'Submitted',
  'Under review',
  'Revision requested',
  'Resubmitted',
]);

function paperStatus(status: string | undefined) {
  return status === RETIRED_PAPER_STATUS ? DEFAULT_PAPER_STATUS : status;
}

function rememberedNames(values: Array<string | null | undefined>) {
  const byNormalizedName = new Map<string, string>();
  for (const value of values) {
    for (const name of value?.split(',') ?? []) {
      const trimmed = name.trim();
      if (trimmed) {
        const normalizedName = trimmed.toLocaleLowerCase();
        if (!byNormalizedName.has(normalizedName)) {
          byNormalizedName.set(normalizedName, trimmed);
        }
      }
    }
  }
  return [...byNormalizedName.values()].sort((a, b) => a.localeCompare(b));
}

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

  async listVenueSuggestions(tenantId: string, callerUserId: string) {
    const { paperValues, projectValues, conferenceValues } =
      await this.repository.findRememberedVenueValues(tenantId, callerUserId);
    const journals = rememberedNames([
      ...paperValues.flatMap((paper) => [
        paper.targetJournal,
        paper.backupJournal,
      ]),
      ...projectValues.map((project) => project.targetJournals),
    ]);
    const conferences = rememberedNames([
      ...paperValues.flatMap((paper) => [
        paper.targetConference,
        paper.backupConference,
      ]),
      ...conferenceValues.map(
        (conference) => conference.acronym?.trim() || conference.name,
      ),
    ]);

    return { journals, conferences };
  }

  async listCurrentlyWithCollaborators(tenantId: string, callerUserId: string) {
    const { registered, invited, callerEmail } =
      await this.repository.findCurrentlyWithCollaborators(
        tenantId,
        callerUserId,
      );
    const callerKey = callerEmail?.trim().toLowerCase();
    const contactsByEmail = new Map<
      string,
      {
        id: string;
        userIds: string[];
        invitationIds: string[];
        displayName: string | null;
        affiliation: string | null;
      }
    >();

    for (const collaborator of registered) {
      const key = collaborator.email.trim().toLowerCase();
      if (key === callerKey || collaborator.userId === callerUserId) continue;
      contactsByEmail.set(key, {
        id: `user:${collaborator.userId}`,
        userIds: [collaborator.userId],
        invitationIds: [],
        displayName: collaborator.displayName,
        affiliation: collaborator.affiliation,
      });
    }

    for (const invitation of invited) {
      // Name-only collaborators have no email, so group them by name instead.
      const key =
        invitation.email?.trim().toLowerCase() ||
        (invitation.displayName?.trim()
          ? `name:${invitation.displayName.trim().toLowerCase()}`
          : `invitation:${invitation.invitationId}`);
      if (key === callerKey) continue;
      const existing = contactsByEmail.get(key);
      if (existing) {
        if (!existing.invitationIds.includes(invitation.invitationId)) {
          existing.invitationIds.push(invitation.invitationId);
        }
        existing.displayName ??= invitation.displayName;
        existing.affiliation ??= invitation.affiliation;
        continue;
      }
      contactsByEmail.set(key, {
        id: `invitation:${invitation.invitationId}`,
        userIds: [],
        invitationIds: [invitation.invitationId],
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

  /**
   * Papers are visible to their explicit collaborators and the owner
   * of their parent project. Project collaborators do not inherit access.
   */
  private async canAccess(
    tenantId: string,
    module: { id: string; projectId: string | null },
    callerUserId: string,
  ): Promise<boolean> {
    const moduleMembership =
      await this.collaboratorsRepository.findByModuleAndUser(
        tenantId,
        module.id,
        callerUserId,
      );

    if (moduleMembership) return true;
    if (!module.projectId) return false;

    const project = await this.projectsRepository.findById(
      tenantId,
      module.projectId,
    );

    return project?.userId === callerUserId;
  }

  async listActive(
    tenantId: string,
    callerUserId: string,
    page: number,
    pageSize: number | 'all',
    projectId?: string,
    search?: string,
    sortBy?: ModuleSortField,
    sortDirection?: SortDirection,
    statuses?: string[],
    stages?: string[],
    currentlyWithTypes?: CurrentlyWithType[],
    currentlyWithUserIds?: string[],
    currentlyWithInvitationIds?: string[],
  ) {
    const limit = listPageSize(pageSize);
    const requestedPage = pageSize === 'all' ? 1 : page;
    const offset = paginationOffset(requestedPage, limit);

    const { data, totalItems, summary } =
      await this.repository.findVisibleActiveByTenant(
        tenantId,
        callerUserId,
        offset,
        limit,
        projectId,
        search,
        sortBy,
        sortDirection,
        statuses,
        stages,
        currentlyWithTypes,
        currentlyWithUserIds,
        currentlyWithInvitationIds,
      );

    assertAllFits(pageSize, totalItems);

    const modulesWithDisplayValues = await this.withDisplayValues(
      data,
      callerUserId,
    );

    return {
      data: modulesWithDisplayValues,
      summary,
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

  async findOne(tenantId: string, moduleId: string, callerUserId: string) {
    const module = await this.repository.findById(tenantId, moduleId);
    if (!module || !(await this.canAccess(tenantId, module, callerUserId))) {
      throw new NotFoundException('Module not found');
    }
    const [shaped] = await this.withDisplayValues([module], callerUserId);
    return shaped;
  }

  /**
   * Lists papers across workspaces where the caller is an explicit paper
   * collaborator or owns the parent project.
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
      projectId?: string;
      shortTitle: string;
      title?: string;
      description?: string;
      abstract?: string;
      targetJournal?: string;
      backupJournal?: string;
      targetConference?: string;
      backupConference?: string;
      status?: string;
      priority?: string;
      pipelineStage?: string;
      assignedToUserId?: string;
      currentlyWithType?: CurrentlyWithType;
      dueDate?: string;
    },
  ) {
    // Papers don't have to belong to a project ("independent papers").
    if (input.projectId) {
      await this.ensureProjectOwnedByCaller(
        tenantId,
        input.projectId,
        callerUserId,
      );
    }
    const status = paperStatus(input.status);

    const [statusId, priorityId] = await Promise.all([
      this.resolveEnum('project_status', status),
      this.resolveEnum('importance', input.priority),
    ]);
    const pipelineStageId = input.pipelineStage
      ? await this.resolveModulePipelineStage(tenantId, input.pipelineStage)
      : undefined;
    const ownerRoleId = await this.resolveEnum('project_role', 'Owner');
    const displayId = await this.sequences.nextDisplayId(tenantId, 'module');
    const currentlyWith = this.resolveCreateCurrentlyWith(
      callerUserId,
      input.currentlyWithType,
      input.assignedToUserId,
    );

    const createValues = {
      projectId: input.projectId,
      tenantId,
      createdBy: callerUserId,
      shortTitle: input.shortTitle,
      title: input.title,
      description: input.description,
      abstract: input.abstract,
      targetJournal: input.targetJournal,
      backupJournal: input.backupJournal,
      targetConference: input.targetConference,
      backupConference: input.backupConference,
      statusId,
      priorityId,
      pipelineStageId,
      pipelineStageChangedAt: new Date(),
      assignedToUserId: currentlyWith.assignedToUserId,
      currentlyWithType: currentlyWith.currentlyWithType,
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
      projectId: string | null;
      status: string;
      priority: string;
      pipelineStage: string;
      assignedToUserId: string | null;
      assignedToInvitationId: string | null;
      currentlyWithType: CurrentlyWithType;
      dueDate: string | null;
    }>,
  ) {
    const existing = await this.findOne(tenantId, moduleId, callerUserId);
    const existingCurrentlyWith = existing as typeof existing & {
      assignedToUserId?: string | null;
      assignedToInvitationId?: string | null;
    };
    if (Object.prototype.hasOwnProperty.call(input, 'projectId')) {
      if (input.projectId) {
        await this.ensureProjectOwnedByCaller(
          tenantId,
          input.projectId,
          callerUserId,
        );
      } else if (existing?.projectId) {
        // Making a paper independent: only someone on the paper itself can,
        // since project access no longer applies once it leaves the project.
        const membership =
          await this.collaboratorsRepository.findByModuleAndUser(
            tenantId,
            moduleId,
            callerUserId,
          );
        if (!membership) {
          throw new ForbiddenException(
            'Only collaborators on this paper can remove it from its project',
          );
        }
      }
    }
    const status = paperStatus(input.status);
    const [statusId, priorityId, pipelineStageId] = await Promise.all([
      status ? this.resolveEnum('project_status', status) : undefined,
      input.priority
        ? this.resolveEnum('importance', input.priority)
        : undefined,
      input.pipelineStage
        ? this.resolveModulePipelineStage(tenantId, input.pipelineStage)
        : undefined,
    ]);

    const stageChanged =
      input.pipelineStage !== undefined &&
      input.pipelineStage !== existing?.pipelineStage;
    const hasCurrentlyWithUpdate =
      Object.prototype.hasOwnProperty.call(input, 'currentlyWithType') ||
      Object.prototype.hasOwnProperty.call(input, 'assignedToUserId') ||
      Object.prototype.hasOwnProperty.call(input, 'assignedToInvitationId');
    const currentlyWith = hasCurrentlyWithUpdate
      ? await this.resolveUpdatedCurrentlyWith(
          tenantId,
          moduleId,
          callerUserId,
          input.currentlyWithType,
          input.assignedToUserId,
          input.assignedToInvitationId,
          existingCurrentlyWith.assignedToUserId,
          existingCurrentlyWith.assignedToInvitationId,
        )
      : undefined;

    const module = await this.repository.update(tenantId, moduleId, {
      shortTitle: input.shortTitle,
      title: input.title,
      description: input.description,
      abstract: input.abstract,
      targetJournal: input.targetJournal,
      backupJournal: input.backupJournal,
      targetConference: input.targetConference,
      backupConference: input.backupConference,
      projectId:
        input.projectId === undefined ? undefined : (input.projectId ?? null),
      statusId,
      priorityId,
      pipelineStageId,
      pipelineStageChangedAt: stageChanged ? new Date() : undefined,
      assignedToUserId: currentlyWith?.assignedToUserId,
      assignedToInvitationId: currentlyWith?.assignedToInvitationId,
      currentlyWithType: currentlyWith?.currentlyWithType,
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

  private async requireArchiveOwner(
    tenantId: string,
    moduleId: string,
    callerUserId: string,
  ) {
    const module = await this.repository.findById(tenantId, moduleId);
    if (!module) {
      throw new NotFoundException('Module not found');
    }

    const [membership, ownerRole] = await Promise.all([
      this.collaboratorsRepository.findByModuleAndUser(
        tenantId,
        moduleId,
        callerUserId,
      ),
      this.enumRepository.findByCategoryAndValue('project_role', 'Owner'),
    ]);

    if (!membership || !ownerRole || membership.roleId !== ownerRole.id) {
      throw new ForbiddenException(
        'Only the module owner can archive this module',
      );
    }

    return { module, ownerRoleId: ownerRole.id };
  }

  private async runArchiveOperation<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      // Drizzle may wrap the PostgreSQL error in one or more causes.
      let current: unknown = error;

      for (let depth = 0; depth < 5; depth += 1) {
        if (typeof current !== 'object' || current === null) break;

        const detail = current as {
          code?: unknown;
          message?: unknown;
          cause?: unknown;
        };

        if (detail.code === '42501') {
          throw new ForbiddenException(
            'Only the owner of an active paper can perform this action',
          );
        }

        if (detail.code === '22023') {
          throw new BadRequestException(
            typeof detail.message === 'string'
              ? detail.message
              : 'Invalid paper archive options',
          );
        }

        current = detail.cause;
      }

      throw error;
    }
  }

  async archiveDestinations(
    tenantId: string,
    moduleId: string,
    callerUserId: string,
  ) {
    await this.requireArchiveOwner(tenantId, moduleId, callerUserId);

    return this.repository.findArchiveDestinations(
      tenantId,
      moduleId,
      callerUserId,
    );
  }

  async archiveDestinationsForCaller(moduleId: string, callerUserId: string) {
    const module = await this.repository.findByIdGlobal(moduleId);
    if (!module) {
      throw new NotFoundException('Module not found');
    }

    return this.archiveDestinations(module.tenantId, moduleId, callerUserId);
  }

  async archiveImpact(
    tenantId: string,
    moduleId: string,
    callerUserId: string,
  ) {
    await this.requireArchiveOwner(tenantId, moduleId, callerUserId);

    return this.runArchiveOperation(() =>
      this.repository.archiveImpact(tenantId, moduleId),
    );
  }

  async archive(
    tenantId: string,
    moduleId: string,
    callerUserId: string,
    input: {
      mode: ModuleArchiveMode;
      destinationModuleId?: string;
    } = { mode: 'archive_contents' },
  ) {
    const { ownerRoleId } = await this.requireArchiveOwner(
      tenantId,
      moduleId,
      callerUserId,
    );

    if (input.mode !== 'archive_contents' && input.mode !== 'move_contents') {
      throw new BadRequestException('Unknown paper archive mode');
    }

    if (input.mode === 'move_contents') {
      if (!input.destinationModuleId) {
        throw new BadRequestException(
          'Choose a destination paper before moving linked work',
        );
      }

      if (input.destinationModuleId === moduleId) {
        throw new BadRequestException(
          'The destination paper must be different from the deleted paper',
        );
      }

      const destination = await this.repository.findById(
        tenantId,
        input.destinationModuleId,
      );

      const destinationMembership = destination
        ? await this.collaboratorsRepository.findByModuleAndUser(
            tenantId,
            destination.id,
            callerUserId,
          )
        : undefined;

      if (
        !destination ||
        destination.archivedAt ||
        destinationMembership?.roleId !== ownerRoleId
      ) {
        throw new BadRequestException(
          'Choose another active paper that you own',
        );
      }

      if (
        destination.projectId &&
        !(await this.projectsRepository.findById(
          tenantId,
          destination.projectId,
        ))
      ) {
        throw new BadRequestException(
          'The destination paper must belong to an active project',
        );
      }
    }

    const module = await this.runArchiveOperation(() =>
      input.mode === 'move_contents'
        ? this.repository.archive(tenantId, moduleId, input.destinationModuleId)
        : this.repository.archive(tenantId, moduleId),
    );

    if (!module) {
      throw new NotFoundException('Module not found');
    }

    const [shaped] = await this.withDisplayValues([module], callerUserId);

    return {
      module: shaped,
      warning: `This paper has been archived and will be permanently deleted in ${ARCHIVE_RETENTION_DAYS} days.`,
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
  async archiveImpactForCaller(moduleId: string, callerUserId: string) {
    const module = await this.repository.findByIdGlobal(moduleId);
    if (!module) {
      throw new NotFoundException('Module not found');
    }

    return this.archiveImpact(module.tenantId, moduleId, callerUserId);
  }

  async archiveForCallerWithOptions(
    moduleId: string,
    callerUserId: string,
    input: Parameters<ProjectModulesService['archive']>[3],
  ) {
    const module = await this.repository.findByIdGlobal(moduleId);
    if (!module) {
      throw new NotFoundException('Module not found');
    }

    return this.archive(module.tenantId, moduleId, callerUserId, input);
  }

  async restore(tenantId: string, moduleId: string, callerUserId: string) {
    const existing = await this.repository.findArchivedById(tenantId, moduleId);
    if (!existing) {
      throw new NotFoundException('Archived paper not found');
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
        'Only the paper owner can restore this paper',
      );
    }
    if (
      existing.projectId &&
      !(await this.projectsRepository.findById(tenantId, existing.projectId))
    ) {
      throw new BadRequestException(
        'Restore the parent project before restoring this paper',
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
      moduleId,
      statusId,
    );
    if (!restored) {
      throw new NotFoundException('Archived paper not found');
    }
    const [shaped] = await this.withDisplayValues([restored], callerUserId);
    return shaped;
  }

  async permanentlyDelete(
    tenantId: string,
    moduleId: string,
    callerUserId: string,
  ) {
    const existing = await this.repository.findArchivedById(tenantId, moduleId);
    if (!existing) {
      throw new NotFoundException('Archived paper not found');
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
        'Only the paper owner can permanently delete this paper',
      );
    }
    const deleted = await this.repository.permanentlyDelete(tenantId, moduleId);
    if (!deleted) {
      throw new NotFoundException('Archived paper not found');
    }
    return { id: deleted.id };
  }

  private async withDisplayValues<
    T extends {
      id: string;
      statusId: string | null;
      priorityId: string | null;
      pipelineStageId: string | null;
    },
  >(rows: T[], _callerUserId: string) {
    const enumIds = rows
      .flatMap((row) => [row.statusId, row.priorityId, row.pipelineStageId])
      .filter((id): id is string => id !== null);
    const valuesById = await this.enumRepository.findValuesByIds(enumIds);

    const shapedRows = rows.map(
      ({ statusId, priorityId, pipelineStageId, ...rest }) => ({
        ...rest,
        status: statusId ? (valuesById.get(statusId) ?? null) : null,
        priority: priorityId ? (valuesById.get(priorityId) ?? null) : null,
        pipelineStage: pipelineStageId
          ? (valuesById.get(pipelineStageId) ?? null)
          : null,
      }),
    );

    const submittedModuleIds = shapedRows
      .filter((row) => row.pipelineStage === SUBMITTED_UNDER_REVIEW_STAGE)
      .map((row) => row.id);

    const latestSubmissions = submittedModuleIds.length
      ? await this.repository.findLatestSubmissionsForModules(
          submittedModuleIds,
        )
      : [];

    const submissionByModuleId = new Map(
      latestSubmissions.map((submission) => [submission.moduleId, submission]),
    );

    return shapedRows.map((row) => {
      const submission = submissionByModuleId.get(row.id);
      const submittedToJournal =
        row.pipelineStage === SUBMITTED_UNDER_REVIEW_STAGE &&
        submission &&
        ACTIVE_SUBMISSION_STATUSES.has(submission.status)
          ? submission.journalName.trim() || null
          : null;

      return {
        ...row,
        submittedToJournal,
      };
    });
  }

  private resolveCreateCurrentlyWith(
    callerUserId: string,
    requestedType?: CurrentlyWithType,
    requestedUserId?: string,
  ) {
    const currentlyWithType =
      requestedType ??
      (requestedUserId
        ? requestedUserId === callerUserId
          ? 'me'
          : 'collaborator'
        : 'me');

    if (currentlyWithType === 'me') {
      return {
        currentlyWithType,
        assignedToUserId: callerUserId,
      };
    }
    if (currentlyWithType === 'collaborator') {
      if (requestedUserId === callerUserId) {
        throw new BadRequestException(
          'Choose a paper collaborator or coauthor',
        );
      }
      // No specific person means a general "Collaborator/Author".
      return {
        currentlyWithType,
        assignedToUserId: requestedUserId ?? null,
      };
    }
    return {
      currentlyWithType,
      assignedToUserId: null,
    };
  }

  private async resolveUpdatedCurrentlyWith(
    tenantId: string,
    moduleId: string,
    callerUserId: string,
    requestedType?: CurrentlyWithType,
    requestedUserId?: string | null,
    requestedInvitationId?: string | null,
    existingUserId?: string | null,
    existingInvitationId?: string | null,
  ) {
    const selectedUserId =
      requestedUserId === undefined ? existingUserId : requestedUserId;
    const selectedInvitationId =
      requestedInvitationId === undefined
        ? existingInvitationId
        : requestedInvitationId;
    const currentlyWithType =
      requestedType ??
      (selectedUserId || selectedInvitationId
        ? selectedUserId === callerUserId
          ? 'me'
          : 'collaborator'
        : undefined);

    if (!currentlyWithType) {
      return {
        currentlyWithType: null,
        assignedToUserId: null,
        assignedToInvitationId: null,
      };
    }
    if (currentlyWithType === 'me') {
      return {
        currentlyWithType,
        assignedToUserId: callerUserId,
        assignedToInvitationId: null,
      };
    }
    if (currentlyWithType === 'collaborator') {
      // No specific person means a general "Collaborator/Author".
      if (!selectedUserId && !selectedInvitationId) {
        return {
          currentlyWithType,
          assignedToUserId: null,
          assignedToInvitationId: null,
        };
      }
      if (
        selectedUserId === callerUserId ||
        (selectedUserId && selectedInvitationId)
      ) {
        throw new BadRequestException(
          'Choose a paper collaborator or coauthor',
        );
      }
      if (selectedUserId) {
        const collaborator =
          await this.collaboratorsRepository.findByModuleAndUser(
            tenantId,
            moduleId,
            selectedUserId,
          );
        if (!collaborator) {
          throw new BadRequestException(
            'Currently With can only select a collaborator on this paper',
          );
        }
        return {
          currentlyWithType,
          assignedToUserId: selectedUserId,
          assignedToInvitationId: null,
        };
      }

      const invitation = await this.repository.findInvitationById(
        moduleId,
        selectedInvitationId!,
      );
      if (!invitation) {
        throw new BadRequestException(
          'Currently With can only select a collaborator on this paper',
        );
      }
      return {
        currentlyWithType,
        assignedToUserId: null,
        assignedToInvitationId: selectedInvitationId!,
      };
    }
    return {
      currentlyWithType,
      assignedToUserId: null,
      assignedToInvitationId: null,
    };
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
