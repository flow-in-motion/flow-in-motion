import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateConferenceDto } from '../dto/create-conference.dto';
import { UpdateConferenceDto } from '../dto/update-conference.dto';
import {
  ConferencesRepository,
  type ConferenceSubmissionValues,
} from '../repositories/conferences.repository';
import {
  CreateConferenceSubmissionDto,
  UpdateConferenceSubmissionDto,
} from '../dto/conference-submission.dto';
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

    const [projectsByConference, papersByConference, datedSubmissions] =
      await Promise.all([
        this.repository.findLinkedProjectsForConferences(
          tenantId,
          conferenceIds,
        ),
        this.repository.findLinkedPapersForConferences(tenantId, conferenceIds),
        this.repository.findPendingDatedSubmissionsForConferences(
          tenantId,
          conferenceIds,
        ),
      ]);

    const conferencesWithProjects = data.map((conference) => ({
      ...conference,
      daysRemaining: calculateDaysRemaining(conference.submissionDue),
      projects: projectsByConference.get(conference.id) ?? [],
      papers: papersByConference.get(conference.id) ?? [],
      // Submissions with their own deadline, still to be sent in.
      upcomingSubmissions: datedSubmissions
        .filter((row) => row.conferenceId === conference.id)
        .map((row) => ({
          ...submissionResponse(row),
          daysRemaining: calculateDaysRemaining(row.submissionDue),
        })),
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
   * Any number of projects and papers can be linked. The caller must own each
   * project, and each paper (or the project it sits in).
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
        eventType: input.eventType ?? 'Conference',
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
   * - Own any project or paper being newly linked. Links the conference
   *   already has are kept as they are, even if someone else now owns them.
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
      const linkedProjects = await this.repository.findLinkedProjects(
        tenantId,
        conferenceId,
      );
      await this.validateProjectOwnership(
        tenantId,
        input.projectIds,
        callerUserId,
        new Set(linkedProjects.map((project) => project.id)),
      );
    }
    if (input.moduleIds !== undefined) {
      const linkedPapers = await this.repository.findLinkedPapers(
        tenantId,
        conferenceId,
      );
      await this.validateModuleOwnership(
        tenantId,
        input.moduleIds,
        callerUserId,
        new Set(linkedPapers.map((paper) => paper.id)),
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
        eventType: input.eventType,
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

  /**
   * Adds a submission to a conference: a paper, a project, or just a title
   * (for example a PDW). Only the conference owner can do this, and a paper
   * or project must be one they may link.
   */
  async addSubmission(
    tenantId: string,
    conferenceId: string,
    callerUserId: string,
    input: CreateConferenceSubmissionDto,
  ) {
    const conference = await this.lockPresentationConference(
      tenantId,
      conferenceId,
      callerUserId,
      'submissions',
    );

    const title = trimOptional(input.title) ?? null;
    if (input.moduleId && input.projectId) {
      throw new BadRequestException(
        'A submission is a paper or a project, not both',
      );
    }
    if (!input.moduleId && !input.projectId && !title) {
      throw new BadRequestException(
        'Give the submission a title, or choose a paper or a project',
      );
    }
    if (input.moduleId) {
      await this.validateModuleOwnership(
        tenantId,
        [input.moduleId],
        callerUserId,
      );
    }
    if (input.projectId) {
      await this.validateProjectOwnership(
        tenantId,
        [input.projectId],
        callerUserId,
      );
    }

    const created = await this.repository.insertSubmission(
      tenantId,
      conferenceId,
      { moduleId: input.moduleId, projectId: input.projectId },
      {
        paperTitle: title,
        submissionType: input.submissionType ?? null,
        status: input.status ?? null,
        submissionDue: input.submissionDue ?? null,
        notes: trimOptional(input.notes) ?? null,
      },
    );
    if (!created) {
      throw new ConflictException(
        'This paper is already a submission for this conference. Edit the existing one instead.',
      );
    }

    return this.withResponseValues(tenantId, conference);
  }

  /** Changes a submission's title, type, status, deadline or notes. */
  async updateSubmission(
    tenantId: string,
    conferenceId: string,
    submissionId: string,
    callerUserId: string,
    input: UpdateConferenceSubmissionDto,
  ) {
    const conference = await this.lockPresentationConference(
      tenantId,
      conferenceId,
      callerUserId,
      'submissions',
    );
    const existing = await this.repository.findSubmissionForUpdate(
      tenantId,
      conferenceId,
      submissionId,
    );
    if (!existing) {
      throw new NotFoundException('Submission not found');
    }

    const values: ConferenceSubmissionValues = {};
    if (input.title !== undefined) {
      values.paperTitle = trimOptional(input.title) ?? null;
      if (!values.paperTitle && !existing.moduleId && !existing.projectId) {
        throw new BadRequestException(
          'A submission without a paper or project needs a title',
        );
      }
    }
    if (input.submissionType !== undefined) {
      values.submissionType = input.submissionType;
    }
    if (input.status !== undefined) values.status = input.status;
    if (input.submissionDue !== undefined) {
      values.submissionDue = input.submissionDue;
    }
    if (input.notes !== undefined) {
      values.notes = trimOptional(input.notes) ?? null;
    }

    if (Object.keys(values).length > 0) {
      await this.repository.updateSubmission(
        tenantId,
        conferenceId,
        submissionId,
        values,
      );
    }

    return this.withResponseValues(tenantId, conference);
  }

  /**
   * Removes a submission. A paper with a presentation recorded for this
   * conference keeps it until the presentation is removed from the paper.
   */
  async removeSubmission(
    tenantId: string,
    conferenceId: string,
    submissionId: string,
    callerUserId: string,
  ) {
    const conference = await this.lockPresentationConference(
      tenantId,
      conferenceId,
      callerUserId,
      'submissions',
    );
    const existing = await this.repository.findSubmissionForUpdate(
      tenantId,
      conferenceId,
      submissionId,
    );
    if (!existing) {
      throw new NotFoundException('Submission not found');
    }
    if (existing.moduleId && existing.presentedDate) {
      throw new ConflictException(
        "This paper has a presentation recorded for this conference. Remove the presentation on the paper's page first.",
      );
    }

    await this.repository.deleteSubmission(
      tenantId,
      conferenceId,
      submissionId,
    );

    return this.withResponseValues(tenantId, conference);
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

    const [presentations, submissions] = await Promise.all([
      this.repository.findPresentationsByModule(tenantId, moduleId),
      this.repository.findSubmissionsByModule(tenantId, moduleId),
    ]);

    return {
      canLogPresentation: canManagePaper,
      // The same conference records, seen as submissions (type and status).
      submissions,
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
    managing = 'presentation history',
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
        `Only the conference owner can manage its ${managing}`,
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

    return conference;
  }

  /**
   * Confirms every project being linked exists in the workspace and that the
   * caller owns it (created it or holds its Owner role). Projects in
   * `alreadyLinked` are skipped. A conference may have no projects at all.
   */
  private async validateProjectOwnership(
    tenantId: string,
    projectIds: string[],
    callerUserId: string,
    alreadyLinked: ReadonlySet<string> = new Set(),
  ) {
    const newProjectIds = [...new Set(projectIds)].filter(
      (projectId) => !alreadyLinked.has(projectId),
    );
    if (newProjectIds.length === 0) return;

    const projects = await this.repository.findProjectsByIds(
      tenantId,
      newProjectIds,
    );
    if (projects.length !== newProjectIds.length) {
      throw new NotFoundException(
        'One or more selected projects could not be found',
      );
    }

    const linkable = new Set(
      await this.repository.findLinkableProjectIds(
        tenantId,
        newProjectIds,
        callerUserId,
      ),
    );
    if (newProjectIds.some((projectId) => !linkable.has(projectId))) {
      throw new ForbiddenException(
        'You can only link projects you own to a conference',
      );
    }
  }

  /**
   * Confirms every paper being linked exists and is active, and that the
   * caller owns the paper or the project it sits in. Papers in
   * `alreadyLinked` are skipped.
   */
  private async validateModuleOwnership(
    tenantId: string,
    moduleIds: string[],
    callerUserId: string,
    alreadyLinked: ReadonlySet<string> = new Set(),
  ) {
    const newModuleIds = [...new Set(moduleIds)].filter(
      (moduleId) => !alreadyLinked.has(moduleId),
    );
    if (newModuleIds.length === 0) return;

    const papers = await this.repository.findModulesByIds(
      tenantId,
      newModuleIds,
    );
    if (papers.length !== newModuleIds.length) {
      throw new NotFoundException(
        'One or more selected papers could not be found',
      );
    }

    const linkable = new Set(
      await this.repository.findLinkableModuleIds(
        tenantId,
        newModuleIds,
        callerUserId,
      ),
    );
    if (newModuleIds.some((moduleId) => !linkable.has(moduleId))) {
      throw new ForbiddenException(
        'You can only link papers you own, or papers in projects you own',
      );
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
    const [projects, papers, submissions] = await Promise.all([
      this.repository.findLinkedProjects(tenantId, conference.id),
      this.repository.findLinkedPapers(tenantId, conference.id),
      this.repository.findSubmissions(tenantId, conference.id),
    ]);

    return {
      ...conference,
      daysRemaining: calculateDaysRemaining(conference.submissionDue),
      projects,
      papers,
      submissions: submissions.map(submissionResponse),
    };
  }
}

type SubmissionRow = Awaited<
  ReturnType<ConferencesRepository['findSubmissions']>
>[number];

/** A submission as the app shows it: what it is, its name, and its details. */
function submissionResponse(row: SubmissionRow) {
  const kind = row.moduleId ? 'paper' : row.projectId ? 'project' : 'other';
  const name =
    kind === 'paper'
      ? row.paperShortTitle || row.paperTitle || 'Untitled paper'
      : kind === 'project'
        ? row.projectTitle || 'Untitled project'
        : row.titleAsSubmitted || 'Untitled submission';

  return {
    id: row.id,
    kind,
    moduleId: row.moduleId,
    projectId: row.projectId,
    displayId:
      kind === 'paper'
        ? row.paperDisplayId
        : kind === 'project'
          ? row.projectDisplayId
          : null,
    name,
    titleAsSubmitted: row.titleAsSubmitted,
    submissionType: row.submissionType,
    status: row.status,
    submissionDue: row.submissionDue,
    presentedDate: row.presentedDate,
    notes: row.notes,
  } as const;
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
