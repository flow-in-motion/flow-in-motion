import { Injectable } from '@nestjs/common';
import { moduleSubmissions, modules } from '@research-tracker/migrations';
import { and, desc, eq, sql } from 'drizzle-orm';
import { DrizzleService } from '../../../db/drizzle.service';

interface CreateSubmissionValues {
  tenantId: string;
  moduleId: string;
  createdBy: string;
  submittedDate: string;
  journalName: string;
  paperTitle?: string | null;
  status: string;
  revisionRounds?: number;
  decisionDate?: string;
  notes?: string;
}

interface UpdateSubmissionValues {
  submittedDate?: string;
  journalName?: string;
  paperTitle?: string | null;
  status?: string;
  revisionRounds?: number;
  decisionDate?: string;
  notes?: string;
}

@Injectable()
export class ModuleSubmissionsRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  /**
   * Lists every submission logged against a module, most recent first.
   *
   * Submission history has no per-record visibility rules beyond tenant
   * membership — the same as module_collaborators/module_invitations.
   */
  async findByModule(tenantId: string, moduleId: string) {
    return this.drizzle.db
      .select()
      .from(moduleSubmissions)
      .where(
        and(
          eq(moduleSubmissions.tenantId, tenantId),
          eq(moduleSubmissions.moduleId, moduleId),
        ),
      )
      .orderBy(
        desc(moduleSubmissions.submittedDate),
        desc(moduleSubmissions.createdAt),
      );
  }

  async findById(tenantId: string, moduleId: string, submissionId: string) {
    const [submission] = await this.drizzle.db
      .select()
      .from(moduleSubmissions)
      .where(
        and(
          eq(moduleSubmissions.tenantId, tenantId),
          eq(moduleSubmissions.moduleId, moduleId),
          eq(moduleSubmissions.id, submissionId),
        ),
      );

    return submission;
  }

  private async setPaperStage(
    tx: Parameters<Parameters<DrizzleService['db']['transaction']>[0]>[0],
    tenantId: string,
    moduleId: string,
    stageId: string,
    withJournal: boolean,
  ) {
    await tx
      .update(modules)
      .set({
        pipelineStageId: stageId,
        pipelineStageChangedAt: sql`case when ${modules.pipelineStageId} is distinct from ${stageId} then now() else ${modules.pipelineStageChangedAt} end`,
        ...(withJournal
          ? {
              currentlyWithType: 'journal',
              assignedToUserId: null,
              assignedToInvitationId: null,
            }
          : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(modules.tenantId, tenantId), eq(modules.id, moduleId)));
  }

  async create(
    values: CreateSubmissionValues,
    stageId?: string,
    withJournal = false,
  ) {
    return this.drizzle.db.transaction(async (tx) => {
      const [submission] = await tx
        .insert(moduleSubmissions)
        .values(values)
        .returning();
      if (submission && stageId) {
        await this.setPaperStage(
          tx,
          values.tenantId,
          values.moduleId,
          stageId,
          withJournal,
        );
      }
      return submission;
    });
  }

  async update(
    tenantId: string,
    moduleId: string,
    submissionId: string,
    values: UpdateSubmissionValues,
    stageId?: string,
    withJournal = false,
  ) {
    return this.drizzle.db.transaction(async (tx) => {
      const [submission] = await tx
        .update(moduleSubmissions)
        .set({ ...values, updatedAt: new Date() })
        .where(
          and(
            eq(moduleSubmissions.tenantId, tenantId),
            eq(moduleSubmissions.moduleId, moduleId),
            eq(moduleSubmissions.id, submissionId),
          ),
        )
        .returning();
      if (submission && stageId) {
        await this.setPaperStage(tx, tenantId, moduleId, stageId, withJournal);
      }
      return submission;
    });
  }

  async remove(tenantId: string, moduleId: string, submissionId: string) {
    const [submission] = await this.drizzle.db
      .delete(moduleSubmissions)
      .where(
        and(
          eq(moduleSubmissions.tenantId, tenantId),
          eq(moduleSubmissions.moduleId, moduleId),
          eq(moduleSubmissions.id, submissionId),
        ),
      )
      .returning();

    return submission;
  }
}
