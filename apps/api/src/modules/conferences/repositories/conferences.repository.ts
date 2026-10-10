import { Injectable } from '@nestjs/common';
import {
  conferenceModules,
  conferenceProjects,
  conferences,
  enumTable,
  modules,
  projectCollaborators,
  projects,
} from '@research-tracker/migrations';
import {
  and,
  asc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
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
  ) {
    const visibility = and(
      eq(conferences.tenantId, tenantId),
      or(
        eq(conferences.ownerUserId, userId),
        isNotNull(projectCollaborators.userId),
        sql<boolean>`public.is_conference_module_collaborator(${conferences.id}, ${userId}::uuid)`,
      ),
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
   * Returns the selected projects for which the caller has the Owner role.
   */
  async findOwnedProjectIds(
    tenantId: string,
    projectIds: string[],
    userId: string,
  ) {
    if (projectIds.length === 0) {
      return [];
    }

    const rows = await this.drizzle.db
      .selectDistinct({
        projectId: projectCollaborators.projectId,
      })
      .from(projectCollaborators)
      .innerJoin(enumTable, eq(projectCollaborators.roleId, enumTable.id))
      .where(
        and(
          eq(projectCollaborators.tenantId, tenantId),
          eq(projectCollaborators.userId, userId),
          inArray(projectCollaborators.projectId, projectIds),
          eq(enumTable.category, 'project_role'),
          eq(enumTable.value, 'Owner'),
        ),
      );

    return rows.map((row) => row.projectId);
  }

  /**
   * Returns papers that exist in the tenant together with their parent project.
   * Archived papers and papers under archived projects are excluded.
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
      .innerJoin(projects, eq(projects.id, modules.projectId))
      .where(
        and(
          eq(modules.tenantId, tenantId),
          inArray(modules.id, moduleIds),
          isNull(modules.archivedAt),
          isNull(projects.archivedAt),
        ),
      );
  }

  /**
   * Searches every active project and paper owned by the caller. The picker
   * calls this only after the user types, so no full paper list is loaded when
   * the conference dialog opens.
   */
  async searchOwnedLinkOptions(
    tenantId: string,
    userId: string,
    search: string,
  ) {
    const pattern = searchPattern(search);
    const ownedByCaller = or(
      eq(projects.userId, userId),
      and(
        eq(projectCollaborators.userId, userId),
        eq(enumTable.category, 'project_role'),
        eq(enumTable.value, 'Owner'),
      ),
    );

    const [projectRows, paperRows] = await Promise.all([
      this.drizzle.db
        .selectDistinct({
          id: projects.id,
          displayId: projects.displayId,
          title: projects.title,
        })
        .from(projects)
        .leftJoin(
          projectCollaborators,
          and(
            eq(projectCollaborators.projectId, projects.id),
            eq(projectCollaborators.tenantId, tenantId),
            eq(projectCollaborators.userId, userId),
          ),
        )
        .leftJoin(enumTable, eq(enumTable.id, projectCollaborators.roleId))
        .where(
          and(
            eq(projects.tenantId, tenantId),
            isNull(projects.archivedAt),
            ownedByCaller,
            or(
              ilike(projects.title, pattern),
              ilike(projects.displayId, pattern),
            ),
          ),
        )
        .orderBy(asc(projects.title), asc(projects.id)),
      this.drizzle.db
        .selectDistinct({
          id: modules.id,
          displayId: modules.displayId,
          shortTitle: modules.shortTitle,
          title: modules.title,
          projectId: projects.id,
          projectTitle: projects.title,
        })
        .from(modules)
        .innerJoin(projects, eq(projects.id, modules.projectId))
        .leftJoin(
          projectCollaborators,
          and(
            eq(projectCollaborators.projectId, projects.id),
            eq(projectCollaborators.tenantId, tenantId),
            eq(projectCollaborators.userId, userId),
          ),
        )
        .leftJoin(enumTable, eq(enumTable.id, projectCollaborators.roleId))
        .where(
          and(
            eq(modules.tenantId, tenantId),
            eq(projects.tenantId, tenantId),
            isNull(modules.archivedAt),
            isNull(projects.archivedAt),
            ownedByCaller,
            or(
              ilike(modules.shortTitle, pattern),
              ilike(modules.title, pattern),
              ilike(modules.displayId, pattern),
              ilike(projects.title, pattern),
              ilike(projects.displayId, pattern),
            ),
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
      await this.drizzle.db
        .delete(conferenceModules)
        .where(
          and(
            eq(conferenceModules.tenantId, tenantId),
            eq(conferenceModules.conferenceId, conferenceId),
          ),
        );

      if (moduleIds.length > 0) {
        await this.drizzle.db.insert(conferenceModules).values(
          moduleIds.map((moduleId) => ({
            tenantId,
            conferenceId,
            moduleId,
          })),
        );
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
}
