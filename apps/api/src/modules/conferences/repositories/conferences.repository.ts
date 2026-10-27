import { ConflictException, Injectable } from '@nestjs/common';
import {
  conferenceModules,
  conferenceProjects,
  conferences,
  enumTable,
  moduleCollaborators,
  modules,
  projectCollaborators,
  projects,
} from '@research-tracker/migrations';
import {
  and,
  asc,
  eq,
  exists,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
  desc,
} from 'drizzle-orm';
import { searchPattern } from '../../../common/pagination';
import { DrizzleService } from '../../../db/drizzle.service';
import type { ConferenceIntent } from '../dto/create-conference.dto';

interface CreateConferenceValues {
  tenantId: string;
  ownerUserId: string;
  acronym: string | null;
  name: string;
  location: string | null;
  submissionDue: string | null;
  startDate: string | null;
  endDate: string | null;
  submissionType?: string | null;
  intents: ConferenceIntent[];
}

interface UpdateConferenceValues {
  acronym?: string | null;
  name?: string;
  location?: string | null;
  submissionDue?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  submissionType?: string | null;
  intents?: ConferenceIntent[];
}
export interface ConferencePresentationValues {
  presentedDate: string;
  presentationType: string | null;
  paperTitle: string | null;
  abstract: string | null;
  notes: string | null;
}
@Injectable()
export class ConferencesRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  /**
   * Lists conferences visible to the caller, one page at a time.
   *
   * A conference is visible when the caller owns it directly, or is a
   * collaborator on at least one project linked to the conference (project
   * owners are also stored in project_collaborators, so this covers project
   * owners and collaborators too). Conferences with no linked projects are
   * only visible to their direct owner.
   */
  async findVisiblePageByUser(
    tenantId: string,
    userId: string,
    offset: number,
    limit: number,
    search?: string,
  ) {
    const pattern = search ? searchPattern(search) : undefined;
    const visibility = and(
      eq(conferences.tenantId, tenantId),
      or(
        eq(conferences.ownerUserId, userId),
        isNotNull(projectCollaborators.userId),
        sql<boolean>`public.is_conference_module_collaborator(${conferences.id}, ${userId}::uuid)`,
      ),
      pattern
        ? or(
            ilike(conferences.name, pattern),
            ilike(conferences.acronym, pattern),
            ilike(conferences.location, pattern),
            ilike(conferences.submissionType, pattern),
          )
        : undefined,
    );

    const [rows, countResult] = await Promise.all([
      this.drizzle.db
        .selectDistinct({
          conference: conferences,
        })
        .from(conferences)
        .leftJoin(
          conferenceProjects,
          and(
            eq(conferenceProjects.conferenceId, conferences.id),
            eq(conferenceProjects.tenantId, tenantId),
          ),
        )
        .leftJoin(
          projectCollaborators,
          and(
            eq(projectCollaborators.projectId, conferenceProjects.projectId),
            eq(projectCollaborators.tenantId, tenantId),
            eq(projectCollaborators.userId, userId),
          ),
        )
        .where(visibility)
        .orderBy(asc(conferences.submissionDue), asc(conferences.id))
        .limit(limit)
        .offset(offset),

      this.drizzle.db
        .select({
          count: sql<number>`
            count(distinct ${conferences.id})::int
          `,
        })
        .from(conferences)
        .leftJoin(
          conferenceProjects,
          and(
            eq(conferenceProjects.conferenceId, conferences.id),
            eq(conferenceProjects.tenantId, tenantId),
          ),
        )
        .leftJoin(
          projectCollaborators,
          and(
            eq(projectCollaborators.projectId, conferenceProjects.projectId),
            eq(projectCollaborators.tenantId, tenantId),
            eq(projectCollaborators.userId, userId),
          ),
        )
        .where(visibility),
    ]);

    return {
      data: rows.map((row) => row.conference),
      totalItems: countResult[0]?.count ?? 0,
    };
  }

  /**
   * Finds one conference only when the caller owns it directly, or has
   * access through one of its linked projects.
   */
  async findVisibleById(
    tenantId: string,
    conferenceId: string,
    userId: string,
  ) {
    const [row] = await this.drizzle.db
      .selectDistinct({
        conference: conferences,
      })
      .from(conferences)
      .leftJoin(
        conferenceProjects,
        and(
          eq(conferenceProjects.conferenceId, conferences.id),
          eq(conferenceProjects.tenantId, tenantId),
        ),
      )
      .leftJoin(
        projectCollaborators,
        and(
          eq(projectCollaborators.projectId, conferenceProjects.projectId),
          eq(projectCollaborators.tenantId, tenantId),
          eq(projectCollaborators.userId, userId),
        ),
      )
      .where(
        and(
          eq(conferences.tenantId, tenantId),
          eq(conferences.id, conferenceId),
          or(
            eq(conferences.ownerUserId, userId),
            isNotNull(projectCollaborators.userId),
            sql<boolean>`public.is_conference_module_collaborator(${conferences.id}, ${userId}::uuid)`,
          ),
        ),
      );

    return row?.conference;
  }

  /**
   * Returns projects that exist inside the requested tenant.
   *
   * This is used before linking projects to a conference.
   */
  async findProjectsByIds(tenantId: string, projectIds: string[]) {
    if (projectIds.length === 0) {
      return [];
    }

    return this.drizzle.db
      .select({
        id: projects.id,
        displayId: projects.displayId,
        title: projects.title,
        tenantId: projects.tenantId,
      })
      .from(projects)
      .where(
        and(eq(projects.tenantId, tenantId), inArray(projects.id, projectIds)),
      );
  }

  /**
   * The user owns the project in the outer query: they created it, or they
   * hold its Owner role. The link picker and the save check both use this,
   * so a project offered in the picker can always be saved.
   */
  private ownsProject(tenantId: string, userId: string) {
    return or(
      eq(projects.userId, userId),
      exists(
        this.drizzle.db
          .select({ id: projectCollaborators.id })
          .from(projectCollaborators)
          .innerJoin(enumTable, eq(enumTable.id, projectCollaborators.roleId))
          .where(
            and(
              eq(projectCollaborators.projectId, projects.id),
              eq(projectCollaborators.tenantId, tenantId),
              eq(projectCollaborators.userId, userId),
              eq(enumTable.category, 'project_role'),
              eq(enumTable.value, 'Owner'),
            ),
          ),
      ),
    );
  }

  /** The user holds the Owner role on the paper in the outer query. */
  private ownsPaper(tenantId: string, userId: string) {
    return exists(
      this.drizzle.db
        .select({ id: moduleCollaborators.id })
        .from(moduleCollaborators)
        .innerJoin(enumTable, eq(enumTable.id, moduleCollaborators.roleId))
        .where(
          and(
            eq(moduleCollaborators.moduleId, modules.id),
            eq(moduleCollaborators.tenantId, tenantId),
            eq(moduleCollaborators.userId, userId),
            eq(enumTable.category, 'project_role'),
            eq(enumTable.value, 'Owner'),
          ),
        ),
    );
  }

  /** A paper can be linked by its owner or by the owner of its project. */
  private canLinkPaper(tenantId: string, userId: string) {
    return or(
      and(isNotNull(modules.projectId), this.ownsProject(tenantId, userId)),
      this.ownsPaper(tenantId, userId),
    );
  }

  /** Returns the selected active projects the user may link to a conference. */
  async findLinkableProjectIds(
    tenantId: string,
    projectIds: string[],
    userId: string,
  ) {
    if (projectIds.length === 0) {
      return [];
    }

    const rows = await this.drizzle.db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.tenantId, tenantId),
          inArray(projects.id, projectIds),
          isNull(projects.archivedAt),
          this.ownsProject(tenantId, userId),
        ),
      );

    return rows.map((row) => row.id);
  }

  /** Returns the selected active papers the user may link to a conference. */
  async findLinkableModuleIds(
    tenantId: string,
    moduleIds: string[],
    userId: string,
  ) {
    if (moduleIds.length === 0) {
      return [];
    }

    const rows = await this.drizzle.db
      .select({ id: modules.id })
      .from(modules)
      .leftJoin(projects, eq(projects.id, modules.projectId))
      .where(
        and(
          eq(modules.tenantId, tenantId),
          inArray(modules.id, moduleIds),
          isNull(modules.archivedAt),
          or(isNull(modules.projectId), isNull(projects.archivedAt)),
          this.canLinkPaper(tenantId, userId),
        ),
      );

    return rows.map((row) => row.id);
  }

  /**
   * Returns papers that exist in the tenant together with their parent project
   * (null for papers without a project). Archived papers and papers under
   * archived projects are excluded.
   */
  async findModulesByIds(tenantId: string, moduleIds: string[]) {
    if (moduleIds.length === 0) {
      return [];
    }

    return this.drizzle.db
      .select({
        id: modules.id,
        projectId: modules.projectId,
      })
      .from(modules)
      .leftJoin(projects, eq(projects.id, modules.projectId))
      .where(
        and(
          eq(modules.tenantId, tenantId),
          inArray(modules.id, moduleIds),
          isNull(modules.archivedAt),
          or(isNull(modules.projectId), isNull(projects.archivedAt)),
        ),
      );
  }

  /**
   * Lists active projects and papers the user may link to a conference,
   * optionally filtered by search. Uses the same rules as the save check.
   */
  async searchOwnedLinkOptions(
    tenantId: string,
    userId: string,
    search: string,
  ) {
    const pattern = search.trim() ? searchPattern(search) : undefined;

    const [projectRows, paperRows] = await Promise.all([
      this.drizzle.db
        .select({
          id: projects.id,
          displayId: projects.displayId,
          title: projects.title,
        })
        .from(projects)
        .where(
          and(
            eq(projects.tenantId, tenantId),
            isNull(projects.archivedAt),
            this.ownsProject(tenantId, userId),
            pattern
              ? or(
                  ilike(projects.title, pattern),
                  ilike(projects.displayId, pattern),
                )
              : undefined,
          ),
        )
        .orderBy(asc(projects.title), asc(projects.id)),
      this.drizzle.db
        .select({
          id: modules.id,
          displayId: modules.displayId,
          shortTitle: modules.shortTitle,
          title: modules.title,
          projectId: modules.projectId,
          projectTitle: projects.title,
        })
        .from(modules)
        // Papers without a project are included too.
        .leftJoin(projects, eq(projects.id, modules.projectId))
        .where(
          and(
            eq(modules.tenantId, tenantId),
            isNull(modules.archivedAt),
            or(isNull(modules.projectId), isNull(projects.archivedAt)),
            this.canLinkPaper(tenantId, userId),
            pattern
              ? or(
                  ilike(modules.shortTitle, pattern),
                  ilike(modules.title, pattern),
                  ilike(modules.displayId, pattern),
                  ilike(projects.title, pattern),
                  ilike(projects.displayId, pattern),
                )
              : undefined,
          ),
        )
        .orderBy(asc(modules.shortTitle), asc(modules.title), asc(modules.id)),
    ]);

    return [
      ...projectRows.map((project) => ({
        kind: 'project' as const,
        id: project.id,
        projectId: project.id,
        displayId: project.displayId,
        label: project.title,
        projectTitle: project.title,
      })),
      ...paperRows.map((paper) => ({
        kind: 'paper' as const,
        id: paper.id,
        projectId: paper.projectId,
        displayId: paper.displayId,
        label: paper.shortTitle || paper.title || 'Untitled paper',
        projectTitle: paper.projectTitle,
      })),
    ];
  }

  /**
   * Returns project summaries linked to a conference.
   */
  async findLinkedProjects(tenantId: string, conferenceId: string) {
    return this.drizzle.db
      .select({
        id: projects.id,
        displayId: projects.displayId,
        title: projects.title,
      })
      .from(conferenceProjects)
      .innerJoin(projects, eq(conferenceProjects.projectId, projects.id))
      .where(
        and(
          eq(conferenceProjects.tenantId, tenantId),
          eq(conferenceProjects.conferenceId, conferenceId),
          eq(projects.tenantId, tenantId),
        ),
      );
  }

  /** Returns active papers linked directly to a conference. */
  async findLinkedPapers(tenantId: string, conferenceId: string) {
    return this.drizzle.db
      .select({
        id: modules.id,
        displayId: modules.displayId,
        shortTitle: modules.shortTitle,
        title: modules.title,
        projectId: modules.projectId,
      })
      .from(conferenceModules)
      .innerJoin(modules, eq(conferenceModules.moduleId, modules.id))
      .leftJoin(projects, eq(projects.id, modules.projectId))
      .where(
        and(
          eq(conferenceModules.tenantId, tenantId),
          eq(conferenceModules.conferenceId, conferenceId),
          eq(modules.tenantId, tenantId),
          isNull(modules.archivedAt),
          or(isNull(projects.id), isNull(projects.archivedAt)),
        ),
      );
  }

  /**
   * Batched version of findLinkedProjects — fetches linked projects for
   * many conferences in a single query, instead of one query per
   * conference (avoids the N+1 pattern when listing conferences).
   */
  async findLinkedProjectsForConferences(
    tenantId: string,
    conferenceIds: string[],
  ) {
    if (conferenceIds.length === 0)
      return new Map<
        string,
        { id: string; displayId: string | null; title: string }[]
      >();

    const rows = await this.drizzle.db
      .select({
        conferenceId: conferenceProjects.conferenceId,
        id: projects.id,
        displayId: projects.displayId,
        title: projects.title,
      })
      .from(conferenceProjects)
      .innerJoin(projects, eq(conferenceProjects.projectId, projects.id))
      .where(
        and(
          eq(conferenceProjects.tenantId, tenantId),
          inArray(conferenceProjects.conferenceId, conferenceIds),
          eq(projects.tenantId, tenantId),
        ),
      );

    const byConference = new Map<
      string,
      { id: string; displayId: string | null; title: string }[]
    >();
    for (const row of rows) {
      const existing = byConference.get(row.conferenceId) ?? [];
      existing.push({ id: row.id, displayId: row.displayId, title: row.title });
      byConference.set(row.conferenceId, existing);
    }
    return byConference;
  }

  /** Batched paper-link lookup used by the paginated conference list. */
  async findLinkedPapersForConferences(
    tenantId: string,
    conferenceIds: string[],
  ) {
    type PaperSummary = {
      id: string;
      displayId: string | null;
      shortTitle: string | null;
      title: string | null;
      projectId: string | null;
    };
    const byConference = new Map<string, PaperSummary[]>();
    if (conferenceIds.length === 0) return byConference;

    const rows = await this.drizzle.db
      .select({
        conferenceId: conferenceModules.conferenceId,
        id: modules.id,
        displayId: modules.displayId,
        shortTitle: modules.shortTitle,
        title: modules.title,
        projectId: modules.projectId,
      })
      .from(conferenceModules)
      .innerJoin(modules, eq(conferenceModules.moduleId, modules.id))
      .leftJoin(projects, eq(projects.id, modules.projectId))
      .where(
        and(
          eq(conferenceModules.tenantId, tenantId),
          inArray(conferenceModules.conferenceId, conferenceIds),
          eq(modules.tenantId, tenantId),
          isNull(modules.archivedAt),
          or(isNull(projects.id), isNull(projects.archivedAt)),
        ),
      );

    for (const { conferenceId, ...paper } of rows) {
      byConference.set(conferenceId, [
        ...(byConference.get(conferenceId) ?? []),
        paper,
      ]);
    }
    return byConference;
  }

  /**
   * Creates the conference and all project links in one transaction.
   */
  async create(
    values: CreateConferenceValues,
    projectIds: string[],
    moduleIds: string[],
  ) {
    const [conference] = await this.drizzle.db
      .insert(conferences)
      .values(values)
      .returning();

    if (!conference) {
      return undefined;
    }

    if (projectIds.length > 0) {
      await this.drizzle.db.insert(conferenceProjects).values(
        projectIds.map((projectId) => ({
          tenantId: values.tenantId,
          conferenceId: conference.id,
          projectId,
        })),
      );
    }

    if (moduleIds.length > 0) {
      await this.drizzle.db.insert(conferenceModules).values(
        moduleIds.map((moduleId) => ({
          tenantId: values.tenantId,
          conferenceId: conference.id,
          moduleId,
        })),
      );
    }

    return conference;
  }

  /**
   * Updates conference metadata.
   *
   * When projectIds is supplied, all existing project links are replaced
   * inside the same transaction.
   */
  async update(
    tenantId: string,
    conferenceId: string,
    values: UpdateConferenceValues,
    projectIds?: string[],
    moduleIds?: string[],
  ) {
    const [conference] = await this.drizzle.db
      .update(conferences)
      .set({
        ...values,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(conferences.tenantId, tenantId),
          eq(conferences.id, conferenceId),
        ),
      )
      .returning();

    if (!conference) {
      return undefined;
    }

    if (projectIds !== undefined) {
      await this.drizzle.db
        .delete(conferenceProjects)
        .where(
          and(
            eq(conferenceProjects.tenantId, tenantId),
            eq(conferenceProjects.conferenceId, conferenceId),
          ),
        );

      if (projectIds.length > 0) {
        await this.drizzle.db.insert(conferenceProjects).values(
          projectIds.map((projectId) => ({
            tenantId,
            conferenceId,
            projectId,
          })),
        );
      }
    }

    if (moduleIds !== undefined) {
      const requestedModuleIds = [...new Set(moduleIds)];
      const requestedIds = new Set(requestedModuleIds);

      const existingLinks = await this.drizzle.db
        .select({
          moduleId: conferenceModules.moduleId,
          presentedDate: conferenceModules.presentedDate,
          presentationType: conferenceModules.presentationType,
          paperTitle: conferenceModules.paperTitle,
          abstract: conferenceModules.abstract,
          notes: conferenceModules.notes,
        })
        .from(conferenceModules)
        .where(
          and(
            eq(conferenceModules.tenantId, tenantId),
            eq(conferenceModules.conferenceId, conferenceId),
          ),
        )
        .for('update');

      const removedLinks = existingLinks.filter(
        (link) => !requestedIds.has(link.moduleId),
      );

      const removesPresentationDetails = removedLinks.some((link) =>
        [
          link.presentedDate,
          link.presentationType,
          link.paperTitle,
          link.abstract,
          link.notes,
        ].some((value) => value !== null),
      );

      if (removesPresentationDetails) {
        throw new ConflictException(
          'This paper has conference presentation details. Clear its presentation details before unlinking it.',
        );
      }

      const removedModuleIds = removedLinks.map((link) => link.moduleId);

      if (removedModuleIds.length > 0) {
        await this.drizzle.db
          .delete(conferenceModules)
          .where(
            and(
              eq(conferenceModules.tenantId, tenantId),
              eq(conferenceModules.conferenceId, conferenceId),
              inArray(conferenceModules.moduleId, removedModuleIds),
            ),
          );
      }

      const existingIds = new Set(existingLinks.map((link) => link.moduleId));

      const addedModuleIds = requestedModuleIds.filter(
        (moduleId) => !existingIds.has(moduleId),
      );

      if (addedModuleIds.length > 0) {
        await this.drizzle.db
          .insert(conferenceModules)
          .values(
            addedModuleIds.map((moduleId) => ({
              tenantId,
              conferenceId,
              moduleId,
            })),
          )
          .onConflictDoNothing({
            target: [
              conferenceModules.conferenceId,
              conferenceModules.moduleId,
            ],
          });
      }
    }

    return conference;
  }

  /**
   * Deletes the conference.
   *
   * Conference project and paper links are deleted automatically because
   * their conference foreign keys use ON DELETE CASCADE.
   */
  async remove(tenantId: string, conferenceId: string) {
    const [conference] = await this.drizzle.db
      .delete(conferences)
      .where(
        and(
          eq(conferences.tenantId, tenantId),
          eq(conferences.id, conferenceId),
        ),
      )
      .returning();

    return conference;
  }
  /** Presentation history for an accessible paper, newest first. */
  async findPresentationsByModule(tenantId: string, moduleId: string) {
    return this.drizzle.db
      .select({
        id: conferenceModules.id,
        conferenceId: conferences.id,
        conferenceName: conferences.name,
        acronym: conferences.acronym,
        location: conferences.location,
        ownerUserId: conferences.ownerUserId,
        presentedDate: conferenceModules.presentedDate,
        presentationType: conferenceModules.presentationType,
        paperTitle: conferenceModules.paperTitle,
        abstract: conferenceModules.abstract,
        notes: conferenceModules.notes,
      })
      .from(conferenceModules)
      .innerJoin(
        conferences,
        and(
          eq(conferences.id, conferenceModules.conferenceId),
          eq(conferences.tenantId, conferenceModules.tenantId),
        ),
      )
      .where(
        and(
          eq(conferenceModules.tenantId, tenantId),
          eq(conferenceModules.moduleId, moduleId),
          isNotNull(conferenceModules.presentedDate),
        ),
      )
      .orderBy(
        desc(conferenceModules.presentedDate),
        asc(conferences.name),
        asc(conferenceModules.id),
      );
  }

  /** All conferences owned by the caller, without first-page restrictions. */
  async findOwnedConferenceOptions(tenantId: string, callerUserId: string) {
    return this.drizzle.db
      .select({
        id: conferences.id,
        name: conferences.name,
        acronym: conferences.acronym,
        location: conferences.location,
        startDate: conferences.startDate,
        endDate: conferences.endDate,
      })
      .from(conferences)
      .where(
        and(
          eq(conferences.tenantId, tenantId),
          eq(conferences.ownerUserId, callerUserId),
        ),
      )
      .orderBy(asc(conferences.name), asc(conferences.id));
  }

  /**
   * Serialize presentation edits with normal conference edits.
   * Call this before checking or changing its paper links.
   */
  async lockOwnedConference(
    tenantId: string,
    conferenceId: string,
    callerUserId: string,
  ) {
    const [conference] = await this.drizzle.db
      .select({ id: conferences.id })
      .from(conferences)
      .where(
        and(
          eq(conferences.tenantId, tenantId),
          eq(conferences.id, conferenceId),
          eq(conferences.ownerUserId, callerUserId),
        ),
      )
      .for('update');

    return conference;
  }

  async findConferencePaperLink(
    tenantId: string,
    conferenceId: string,
    moduleId: string,
  ) {
    const [link] = await this.drizzle.db
      .select()
      .from(conferenceModules)
      .where(
        and(
          eq(conferenceModules.tenantId, tenantId),
          eq(conferenceModules.conferenceId, conferenceId),
          eq(conferenceModules.moduleId, moduleId),
        ),
      )
      .for('update');

    return link;
  }

  /**
   * Reuse an existing planned link, or create the paper/conference link.
   * The service must validate ownership and lock the conference first.
   */
  async saveConferencePresentation(
    tenantId: string,
    conferenceId: string,
    moduleId: string,
    values: ConferencePresentationValues,
  ) {
    const [link] = await this.drizzle.db
      .insert(conferenceModules)
      .values({
        tenantId,
        conferenceId,
        moduleId,
        ...values,
      })
      .onConflictDoUpdate({
        target: [conferenceModules.conferenceId, conferenceModules.moduleId],
        set: values,
        setWhere: eq(conferenceModules.tenantId, tenantId),
      })
      .returning();

    return link;
  }

  /** Remove presentation details while preserving the conference/paper link. */
  async clearConferencePresentation(
    tenantId: string,
    conferenceId: string,
    moduleId: string,
  ) {
    const [link] = await this.drizzle.db
      .update(conferenceModules)
      .set({
        presentedDate: null,
        presentationType: null,
        paperTitle: null,
        abstract: null,
        notes: null,
      })
      .where(
        and(
          eq(conferenceModules.tenantId, tenantId),
          eq(conferenceModules.conferenceId, conferenceId),
          eq(conferenceModules.moduleId, moduleId),
        ),
      )
      .returning();

    return link;
  }
}
