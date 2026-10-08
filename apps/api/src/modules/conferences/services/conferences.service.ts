import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateConferenceDto } from '../dto/create-conference.dto';
import { UpdateConferenceDto } from '../dto/update-conference.dto';
import { ConferencesRepository } from '../repositories/conferences.repository';
import {
  buildPaginationMeta,
  paginationOffset,
} from '../../../common/pagination';

@Injectable()
export class ConferencesService {
  constructor(private readonly repository: ConferencesRepository) {}

  /**
   * Lists conferences visible through projects the caller can access.
   */
  async list(
    tenantId: string,
    callerUserId: string,
    page: number,
    pageSize: number,
  ) {
    const offset = paginationOffset(page, pageSize);

    const { data, totalItems } = await this.repository.findVisiblePageByUser(
      tenantId,
      callerUserId,
      offset,
      pageSize,
    );

    const conferenceIds = data.map((conference) => conference.id);

    const [projectsByConference, papersByConference] = await Promise.all([
      this.repository.findLinkedProjectsForConferences(tenantId, conferenceIds),
      this.repository.findLinkedPapersForConferences(tenantId, conferenceIds),
    ]);

    const conferencesWithProjects = data.map((conference) => ({
      ...conference,
      daysRemaining: calculateDaysRemaining(conference.submissionDue),
      projects: projectsByConference.get(conference.id) ?? [],
      papers: papersByConference.get(conference.id) ?? [],
    }));

    return {
      data: conferencesWithProjects,
      meta: buildPaginationMeta(page, pageSize, totalItems),
    };
  }

  /**
   * Returns a conference only when the caller can access at least one linked
   * project.
   */
  async findOne(tenantId: string, conferenceId: string, callerUserId: string) {
    const conference = await this.repository.findVisibleById(
      tenantId,
      conferenceId,
      callerUserId,
    );

    if (!conference) {
      throw new NotFoundException('Conference not found');
    }

    return this.withResponseValues(tenantId, conference);
  }

  /** Searches all active projects and papers the caller owns. */
  async searchLinkOptions(
    tenantId: string,
    callerUserId: string,
    search: string,
  ) {
    const normalizedSearch = search.trim();
    if (!normalizedSearch) return [];
    return this.repository.searchOwnedLinkOptions(
      tenantId,
      callerUserId,
      normalizedSearch,
    );
  }

  /**
   * Creates a conference.
   *
   * The caller must be the Owner of every project being attached.
   */
  async create(
    tenantId: string,
    callerUserId: string,
    input: CreateConferenceDto,
  ) {
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException('Conference name is required');
    }
    this.validateDates(input.startDate, input.endDate);
    const projectIds = input.projectIds ?? [];
    const moduleIds = input.moduleIds ?? [];

    await this.validateProjectOwnership(tenantId, projectIds, callerUserId);
    await this.validateModuleOwnership(tenantId, moduleIds, callerUserId);

    const conference = await this.repository.create(
      {
        tenantId,
        ownerUserId: callerUserId,
        acronym: trimOptional(input.acronym) ?? null,
        name,
        location: trimOptional(input.location) ?? null,
        submissionDue: input.submissionDue ?? null,
        startDate: input.startDate ?? null,
        endDate: input.endDate ?? null,
        submissionType: trimOptional(input.submissionType),
      },
      projectIds,
      moduleIds,
    );

    if (!conference) {
      throw new NotFoundException('Failed to create conference');
    }

    return this.withResponseValues(tenantId, conference);
  }

  /**
   * Updates a conference.
   *
   * The caller must:
   * - Be able to view the conference through a linked project.
   * - Be the conference owner.
   * - Own every project in projectIds when projectIds is being changed.
   */
  async update(
    tenantId: string,
    conferenceId: string,
    callerUserId: string,
    input: UpdateConferenceDto,
  ) {
    const existing = await this.repository.findVisibleById(
      tenantId,
      conferenceId,
      callerUserId,
    );

    if (!existing) {
      throw new NotFoundException('Conference not found');
    }

    if (existing.ownerUserId !== callerUserId) {
      throw new ForbiddenException(
        'Only the conference owner can update this conference',
      );
    }

    if (input.name !== undefined && !input.name.trim()) {
      throw new BadRequestException('Conference name is required');
    }

    const startDate =
      input.startDate === undefined ? existing.startDate : input.startDate;
    const endDate =
      input.endDate === undefined ? existing.endDate : input.endDate;

    this.validateDates(startDate, endDate);

    if (input.projectIds !== undefined) {
      await this.validateProjectOwnership(
        tenantId,
        input.projectIds,
        callerUserId,
      );
    }
    if (input.moduleIds !== undefined) {
      await this.validateModuleOwnership(
        tenantId,
        input.moduleIds,
        callerUserId,
      );
    }

    const conference = await this.repository.update(
      tenantId,
      conferenceId,
      {
        acronym: trimOptional(input.acronym),
        name: input.name?.trim(),
        location: trimOptional(input.location),
        submissionDue: input.submissionDue,
        startDate: input.startDate,
        endDate: input.endDate,
        submissionType: trimOptional(input.submissionType),
      },
      input.projectIds,
      input.moduleIds,
    );

    if (!conference) {
      throw new NotFoundException('Conference not found');
    }

    return this.withResponseValues(tenantId, conference);
  }

  /**
   * Deletes a conference.
   *
   * Only the user recorded as owner_user_id may delete it.
   */
  async remove(tenantId: string, conferenceId: string, callerUserId: string) {
    const existing = await this.repository.findVisibleById(
      tenantId,
      conferenceId,
      callerUserId,
    );

    if (!existing) {
      throw new NotFoundException('Conference not found');
    }

    if (existing.ownerUserId !== callerUserId) {
      throw new ForbiddenException(
        'Only the conference owner can delete this conference',
      );
    }

    const conference = await this.repository.remove(tenantId, conferenceId);

    if (!conference) {
      throw new NotFoundException('Conference not found');
    }

    return {
      message: 'Conference deleted successfully',
      conference,
    };
  }

  /**
   * When projects are supplied, confirms that:
   * - Every project exists inside the tenant.
   * - The caller has the Owner role on every project.
   *
   * A conference may also have no linked projects at all.
   */
  private async validateProjectOwnership(
    tenantId: string,
    projectIds: string[],
    callerUserId: string,
  ) {
    const uniqueProjectIds = [...new Set(projectIds)];

    if (uniqueProjectIds.length === 0) {
      return;
    }

    const projects = await this.repository.findProjectsByIds(
      tenantId,
      uniqueProjectIds,
    );

    if (projects.length !== uniqueProjectIds.length) {
      throw new NotFoundException(
        'One or more selected projects could not be found',
      );
    }

    const ownedProjectIds = await this.repository.findOwnedProjectIds(
      tenantId,
      uniqueProjectIds,
      callerUserId,
    );

    const ownedProjectIdSet = new Set(ownedProjectIds);

    const unauthorizedProjectIds = uniqueProjectIds.filter(
      (projectId) => !ownedProjectIdSet.has(projectId),
    );

    if (unauthorizedProjectIds.length > 0) {
      throw new ForbiddenException(
        'You must be the owner of every project linked to the conference',
      );
    }
  }

  /**
   * Every linked paper must exist, remain active, and belong to a project the
   * caller owns. This preserves the conference linker's existing ownership
   * rules while storing the paper itself instead of only its parent project.
   */
  private async validateModuleOwnership(
    tenantId: string,
    moduleIds: string[],
    callerUserId: string,
  ) {
    const uniqueModuleIds = [...new Set(moduleIds)];
    if (uniqueModuleIds.length === 0) return;

    const linkedModules = await this.repository.findModulesByIds(
      tenantId,
      uniqueModuleIds,
    );
    if (linkedModules.length !== uniqueModuleIds.length) {
      throw new NotFoundException(
        'One or more selected papers could not be found',
      );
    }

    const projectIds = linkedModules
      .map((module) => module.projectId)
      .filter((projectId): projectId is string => Boolean(projectId));
    if (projectIds.length !== linkedModules.length) {
      throw new BadRequestException(
        'Every paper linked to a conference must belong to a project',
      );
    }

    await this.validateProjectOwnership(
      tenantId,
      [...new Set(projectIds)],
      callerUserId,
    );
  }

  /**
   * Conference end date cannot occur before the start date.
   *
   * ISO date strings use YYYY-MM-DD, so direct comparison is safe here.
   */
  private validateDates(
    startDate: string | null | undefined,
    endDate: string | null | undefined,
  ) {
    if (startDate && endDate && endDate < startDate) {
      throw new BadRequestException(
        'Conference end date cannot be before its start date',
      );
    }
  }

  /**
   * Adds values that are derived rather than stored:
   * - daysRemaining
   * - linked project summaries
   */
  private async withResponseValues<
    T extends {
      id: string;
      submissionDue: string | null;
    },
  >(tenantId: string, conference: T) {
    const [projects, papers] = await Promise.all([
      this.repository.findLinkedProjects(tenantId, conference.id),
      this.repository.findLinkedPapers(tenantId, conference.id),
    ]);

    return {
      ...conference,
      daysRemaining: calculateDaysRemaining(conference.submissionDue),
      projects,
      papers,
    };
  }
}

function calculateDaysRemaining(submissionDue: string | null) {
  if (!submissionDue) return null;
  const dueDate = new Date(`${submissionDue}T00:00:00.000Z`);
  const today = new Date();

  today.setUTCHours(0, 0, 0, 0);

  return Math.ceil(
    (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
}

function trimOptional(value: string | null | undefined) {
  if (value === undefined) return undefined;
  return value?.trim() || null;
}
