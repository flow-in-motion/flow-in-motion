import {
  BadRequestException,
  ConflictException,
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
import { SaveConferencePresentationDto } from '../dto/save-conference-presentation.dto';

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
    search?: string,
  ) {
    const offset = paginationOffset(page, pageSize);

    const { data, totalItems } = await this.repository.findVisiblePageByUser(
      tenantId,
      callerUserId,
      offset,
      pageSize,
      search,
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

  /** Lists or searches active projects and papers the caller owns. */
  async searchLinkOptions(
    tenantId: string,
    callerUserId: string,
    search: string,
  ) {
    return this.repository.searchOwnedLinkOptions(
      tenantId,
      callerUserId,
      search.trim(),
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
        notes: trimOptional(input.notes) ?? null,
        submissionDue: input.submissionDue ?? null,
        startDate: input.startDate ?? null,
        endDate: input.endDate ?? null,
        submissionType: trimOptional(input.submissionType),
        intents: input.intents ?? [],
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
        notes: trimOptional(input.notes),
        submissionDue: input.submissionDue,
        startDate: input.startDate,
        endDate: input.endDate,
        submissionType: trimOptional(input.submissionType),
        intents: input.intents,
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

  async listPaperPresentations(
    tenantId: string,
    moduleId: string,
    callerUserId: string,
  ) {
    const papers = await this.repository.findModulesByIds(tenantId, [moduleId]);

    if (papers.length === 0) {
      throw new NotFoundException('Paper not found');
    }

    let canManagePaper = true;

    try {
      await this.validateModuleOwnership(tenantId, [moduleId], callerUserId);
    } catch (error) {
      if (!(error instanceof ForbiddenException)) throw error;
      canManagePaper = false;
    }

    const presentations = await this.repository.findPresentationsByModule(
      tenantId,
      moduleId,
    );

    return {
      canLogPresentation: canManagePaper,
      data: presentations.map(({ ownerUserId, ...presentation }) => ({
        ...presentation,
        canManage: canManagePaper && ownerUserId === callerUserId,
      })),
    };
  }

  async presentationConferenceOptions(
    tenantId: string,
    moduleId: string,
    callerUserId: string,
  ) {
    await this.validateModuleOwnership(tenantId, [moduleId], callerUserId);

    return this.repository.findOwnedConferenceOptions(tenantId, callerUserId);
  }

  async savePaperPresentation(
    tenantId: string,
    moduleId: string,
    conferenceId: string,
    callerUserId: string,
    input: SaveConferencePresentationDto,
    mode: 'create' | 'update',
  ) {
    await this.lockPresentationConference(tenantId, conferenceId, callerUserId);

    await this.validateModuleOwnership(tenantId, [moduleId], callerUserId);

    const existing = await this.repository.findConferencePaperLink(
      tenantId,
      conferenceId,
      moduleId,
    );

    if (mode === 'create' && existing?.presentedDate) {
      throw new ConflictException(
        'This paper already has a presentation recorded for this conference. Edit the existing entry.',
      );
    }

    if (mode === 'update' && !existing?.presentedDate) {
      throw new NotFoundException('Conference presentation not found');
    }

    const presentation = await this.repository.saveConferencePresentation(
      tenantId,
      conferenceId,
      moduleId,
      {
        presentedDate: input.presentedDate,
        presentationType: input.presentationType?.trim() || null,
        paperTitle: input.paperTitle?.trim() || null,
        abstract: input.abstract?.trim() || null,
        notes: input.notes?.trim() || null,
      },
    );

    if (!presentation) {
      throw new NotFoundException('Conference presentation could not be saved');
    }

    return presentation;
  }

  async removePaperPresentation(
    tenantId: string,
    moduleId: string,
    conferenceId: string,
    callerUserId: string,
  ) {
    await this.lockPresentationConference(tenantId, conferenceId, callerUserId);

    await this.validateModuleOwnership(tenantId, [moduleId], callerUserId);

    const existing = await this.repository.findConferencePaperLink(
      tenantId,
      conferenceId,
      moduleId,
    );

    if (!existing?.presentedDate) {
      throw new NotFoundException('Conference presentation not found');
    }

    const presentation = await this.repository.clearConferencePresentation(
      tenantId,
      conferenceId,
      moduleId,
    );

    if (!presentation) {
      throw new NotFoundException('Conference presentation not found');
    }

    return { message: 'Conference presentation removed successfully' };
  }

  private async lockPresentationConference(
    tenantId: string,
    conferenceId: string,
    callerUserId: string,
  ) {
    const conference = await this.repository.findVisibleById(
      tenantId,
      conferenceId,
      callerUserId,
    );

    if (!conference) {
      throw new NotFoundException('Conference not found');
    }

    if (conference.ownerUserId !== callerUserId) {
      throw new ForbiddenException(
        'Only the conference owner can manage its presentation history',
      );
    }

    const locked = await this.repository.lockOwnedConference(
      tenantId,
      conferenceId,
      callerUserId,
    );

    if (!locked) {
      throw new NotFoundException('Conference not found');
    }
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
    await this.validateProjectOwnership(
      tenantId,
      [...new Set(projectIds)],
      callerUserId,
    );

    // Papers without a project: the caller must be an Owner of the paper.
    const independentModuleIds = linkedModules
      .filter((module) => !module.projectId)
      .map((module) => module.id);
    if (independentModuleIds.length > 0) {
      const ownedModuleIds = new Set(
        await this.repository.findOwnedModuleIds(
          tenantId,
          independentModuleIds,
          callerUserId,
        ),
      );
      if (independentModuleIds.some((id) => !ownedModuleIds.has(id))) {
        throw new ForbiddenException(
          'Only the paper owner can link this paper to a conference',
        );
      }
    }
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
