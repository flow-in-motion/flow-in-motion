import { Injectable } from '@nestjs/common';
import {
  conferenceModules,
  conferences,
  dueReminderStates,
  enumTable,
  fundings,
  modules,
  notes,
  projects,
  tasks,
} from '@research-tracker/migrations';
import {
  and,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  notExists,
  notInArray,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { DrizzleService } from '../../db/drizzle.service';
import type {
  ReminderCandidate,
  ReminderItemType,
} from './due-reminders.types';

/** The dates a search covers: from `from` (or any time) to `to`. */
export interface DateWindow {
  /** Earliest due date to include; null for no limit. */
  from: string | null;
  to: string;
}

export interface ReminderState {
  itemType: string;
  itemId: string;
  dueDate: string;
  seenStage: number | null;
  dismissedAt: Date | null;
}

function within(column: Parameters<typeof lte>[0], window: DateWindow) {
  const conditions: SQL[] = [isNotNull(column), lte(column, window.to)];
  if (window.from !== null) conditions.push(gte(column, window.from));
  return and(...conditions);
}

/** Statuses that mean a paper or project is finished. */
const FINISHED_STATUSES = ['Complete', 'Archived'];
/** Submission statuses that mean the deadline has been dealt with. */
const SUBMISSION_DONE_STATUSES = [
  'Submitted',
  'Accepted',
  'Rejected',
  'Withdrawn',
  'Presented',
];

/**
 * Dated items in a workspace that the signed-in person can see. Runs as
 * that person, so row-level security limits it to their own and shared
 * items; finished and archived items are left out here.
 */
@Injectable()
export class DueRemindersRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async findTasks(
    tenantId: string,
    window: DateWindow,
  ): Promise<ReminderCandidate[]> {
    const parentProject = alias(projects, 'parent_project');
    const parentPaper = alias(modules, 'parent_paper');
    const rows = await this.drizzle.db
      .select({
        id: tasks.id,
        title: tasks.title,
        dueDate: tasks.dueDate,
        projectTitle: parentProject.title,
        paperShortTitle: parentPaper.shortTitle,
        paperTitle: parentPaper.title,
      })
      .from(tasks)
      .leftJoin(enumTable, eq(enumTable.id, tasks.statusId))
      .leftJoin(parentProject, eq(parentProject.id, tasks.projectId))
      .leftJoin(parentPaper, eq(parentPaper.id, tasks.moduleId))
      .where(
        and(
          eq(tasks.tenantId, tenantId),
          within(tasks.dueDate, window),
          or(isNull(enumTable.value), sql`${enumTable.value} <> 'Complete'`),
          or(isNull(tasks.projectId), isNull(parentProject.archivedAt)),
          or(isNull(tasks.moduleId), isNull(parentPaper.archivedAt)),
        ),
      );
    return rows.map((row) => ({
      type: 'task' as const,
      itemId: row.id,
      targetId: row.id,
      title: row.title,
      context:
        row.paperShortTitle?.trim() ||
        row.paperTitle?.trim() ||
        row.projectTitle ||
        null,
      dueDate: row.dueDate!,
    }));
  }

  async findPapers(
    tenantId: string,
    window: DateWindow,
  ): Promise<ReminderCandidate[]> {
    const parentProject = alias(projects, 'parent_project');
    const rows = await this.drizzle.db
      .select({
        id: modules.id,
        shortTitle: modules.shortTitle,
        title: modules.title,
        dueDate: modules.dueDate,
        projectTitle: parentProject.title,
      })
      .from(modules)
      .leftJoin(enumTable, eq(enumTable.id, modules.statusId))
      .leftJoin(parentProject, eq(parentProject.id, modules.projectId))
      .where(
        and(
          eq(modules.tenantId, tenantId),
          within(modules.dueDate, window),
          isNull(modules.archivedAt),
          or(
            isNull(enumTable.value),
            notInArray(enumTable.value, FINISHED_STATUSES),
          ),
          or(isNull(modules.projectId), isNull(parentProject.archivedAt)),
        ),
      );
    return rows.map((row) => ({
      type: 'paper' as const,
      itemId: row.id,
      targetId: row.id,
      title: row.shortTitle?.trim() || row.title?.trim() || 'Untitled paper',
      context: row.projectTitle ?? null,
      dueDate: row.dueDate!,
    }));
  }

  async findProjects(
    tenantId: string,
    window: DateWindow,
  ): Promise<ReminderCandidate[]> {
    const rows = await this.drizzle.db
      .select({
        id: projects.id,
        title: projects.title,
        dueDate: projects.dueDate,
      })
      .from(projects)
      .leftJoin(enumTable, eq(enumTable.id, projects.statusId))
      .where(
        and(
          eq(projects.tenantId, tenantId),
          within(projects.dueDate, window),
          isNull(projects.archivedAt),
          or(
            isNull(enumTable.value),
            notInArray(enumTable.value, FINISHED_STATUSES),
          ),
        ),
      );
    return rows.map((row) => ({
      type: 'project' as const,
      itemId: row.id,
      targetId: row.id,
      title: row.title,
      context: null,
      dueDate: row.dueDate!,
    }));
  }

  /** Event deadlines nobody has submitted to yet. */
  async findEventDeadlines(
    tenantId: string,
    window: DateWindow,
  ): Promise<ReminderCandidate[]> {
    const rows = await this.drizzle.db
      .select({
        id: conferences.id,
        name: conferences.name,
        eventType: conferences.eventType,
        dueDate: conferences.submissionDue,
      })
      .from(conferences)
      .where(
        and(
          eq(conferences.tenantId, tenantId),
          within(conferences.submissionDue, window),
          notExists(
            this.drizzle.db
              .select({ id: conferenceModules.id })
              .from(conferenceModules)
              .where(
                and(
                  eq(conferenceModules.conferenceId, conferences.id),
                  inArray(conferenceModules.status, SUBMISSION_DONE_STATUSES),
                ),
              ),
          ),
        ),
      );
    return rows.map((row) => ({
      type: 'conference' as const,
      itemId: row.id,
      targetId: row.id,
      title: row.name,
      context: `${row.eventType ?? 'Event'} submission deadline`,
      dueDate: row.dueDate!,
    }));
  }

  /** Submissions still being planned, with their own deadline. */
  async findSubmissionDeadlines(
    tenantId: string,
    window: DateWindow,
  ): Promise<ReminderCandidate[]> {
    const paper = alias(modules, 'submitted_paper');
    const project = alias(projects, 'submitted_project');
    const rows = await this.drizzle.db
      .select({
        id: conferenceModules.id,
        conferenceId: conferenceModules.conferenceId,
        conferenceName: conferences.name,
        typedTitle: conferenceModules.paperTitle,
        paperShortTitle: paper.shortTitle,
        paperTitle: paper.title,
        projectTitle: project.title,
        dueDate: conferenceModules.submissionDue,
      })
      .from(conferenceModules)
      .innerJoin(
        conferences,
        eq(conferences.id, conferenceModules.conferenceId),
      )
      .leftJoin(paper, eq(paper.id, conferenceModules.moduleId))
      .leftJoin(project, eq(project.id, conferenceModules.projectId))
      .where(
        and(
          eq(conferenceModules.tenantId, tenantId),
          within(conferenceModules.submissionDue, window),
          or(
            isNull(conferenceModules.status),
            eq(conferenceModules.status, 'Planning'),
          ),
        ),
      );
    return rows.map((row) => ({
      type: 'conference_submission' as const,
      itemId: row.id,
      targetId: row.conferenceId,
      title:
        row.paperShortTitle?.trim() ||
        row.paperTitle?.trim() ||
        row.projectTitle ||
        row.typedTitle?.trim() ||
        'Submission',
      context: `Submission to ${row.conferenceName}`,
      dueDate: row.dueDate!,
    }));
  }

  /** Funding applications not yet submitted. */
  async findFundingDeadlines(
    tenantId: string,
    window: DateWindow,
  ): Promise<ReminderCandidate[]> {
    const rows = await this.drizzle.db
      .select({
        id: fundings.id,
        fundingBody: fundings.fundingBody,
        scheme: fundings.scheme,
        dueDate: fundings.applicationDeadline,
      })
      .from(fundings)
      .where(
        and(
          eq(fundings.tenantId, tenantId),
          within(fundings.applicationDeadline, window),
          or(
            isNull(fundings.status),
            inArray(fundings.status, ['Considering', 'Preparing']),
          ),
        ),
      );
    return rows.map((row) => ({
      type: 'funding_deadline' as const,
      itemId: row.id,
      targetId: row.id,
      title: row.scheme
        ? `${row.fundingBody} – ${row.scheme}`
        : row.fundingBody,
      context: 'Application deadline',
      dueDate: row.dueDate!,
    }));
  }

  async findFundingFollowUps(
    tenantId: string,
    window: DateWindow,
  ): Promise<ReminderCandidate[]> {
    const rows = await this.drizzle.db
      .select({
        id: fundings.id,
        fundingBody: fundings.fundingBody,
        scheme: fundings.scheme,
        dueDate: fundings.followUpDate,
      })
      .from(fundings)
      .where(
        and(
          eq(fundings.tenantId, tenantId),
          within(fundings.followUpDate, window),
        ),
      );
    return rows.map((row) => ({
      type: 'funding_follow_up' as const,
      itemId: row.id,
      targetId: row.id,
      title: row.scheme
        ? `${row.fundingBody} – ${row.scheme}`
        : row.fundingBody,
      context: 'Follow up',
      dueDate: row.dueDate!,
    }));
  }

  async findNoteFollowUps(
    tenantId: string,
    window: DateWindow,
  ): Promise<ReminderCandidate[]> {
    const parentProject = alias(projects, 'parent_project');
    const parentPaper = alias(modules, 'parent_paper');
    const rows = await this.drizzle.db
      .select({ id: notes.id, title: notes.title, dueDate: notes.followUpDate })
      .from(notes)
      .leftJoin(parentProject, eq(parentProject.id, notes.projectId))
      .leftJoin(parentPaper, eq(parentPaper.id, notes.moduleId))
      .where(
        and(
          eq(notes.tenantId, tenantId),
          within(notes.followUpDate, window),
          or(isNull(notes.projectId), isNull(parentProject.archivedAt)),
          or(isNull(notes.moduleId), isNull(parentPaper.archivedAt)),
        ),
      );
    return rows.map((row) => ({
      type: 'note' as const,
      itemId: row.id,
      targetId: row.id,
      title: row.title,
      context: 'Follow up',
      dueDate: row.dueDate!,
    }));
  }

  async findStates(
    userId: string,
    tenantId: string,
    since: string | null,
  ): Promise<ReminderState[]> {
    return this.drizzle.db
      .select({
        itemType: dueReminderStates.itemType,
        itemId: dueReminderStates.itemId,
        dueDate: dueReminderStates.dueDate,
        seenStage: dueReminderStates.seenStage,
        dismissedAt: dueReminderStates.dismissedAt,
      })
      .from(dueReminderStates)
      .where(
        and(
          eq(dueReminderStates.userId, userId),
          eq(dueReminderStates.tenantId, tenantId),
          since === null ? undefined : gte(dueReminderStates.dueDate, since),
        ),
      );
  }

  /** Records the latest stage seen, never moving it back to an earlier one. */
  async markSeen(
    userId: string,
    tenantId: string,
    items: Array<{
      type: ReminderItemType;
      itemId: string;
      dueDate: string;
      stage: number;
    }>,
  ) {
    if (items.length === 0) return;
    await this.drizzle.db
      .insert(dueReminderStates)
      .values(
        items.map((item) => ({
          userId,
          tenantId,
          itemType: item.type,
          itemId: item.itemId,
          dueDate: item.dueDate,
          seenStage: item.stage,
        })),
      )
      .onConflictDoUpdate({
        target: [
          dueReminderStates.userId,
          dueReminderStates.itemType,
          dueReminderStates.itemId,
          dueReminderStates.dueDate,
        ],
        set: {
          seenStage: sql`LEAST(COALESCE(${dueReminderStates.seenStage}, excluded.seen_stage), excluded.seen_stage)`,
          updatedAt: sql`now()`,
        },
      });
  }

  /** Hides reminders until their due dates change. */
  async dismiss(
    userId: string,
    tenantId: string,
    items: Array<{ type: ReminderItemType; itemId: string; dueDate: string }>,
  ) {
    if (items.length === 0) return;
    await this.drizzle.db
      .insert(dueReminderStates)
      .values(
        items.map((item) => ({
          userId,
          tenantId,
          itemType: item.type,
          itemId: item.itemId,
          dueDate: item.dueDate,
          dismissedAt: sql`now()`,
        })),
      )
      .onConflictDoUpdate({
        target: [
          dueReminderStates.userId,
          dueReminderStates.itemType,
          dueReminderStates.itemId,
          dueReminderStates.dueDate,
        ],
        set: { dismissedAt: sql`now()`, updatedAt: sql`now()` },
      });
  }
}
