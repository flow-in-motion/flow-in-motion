import { Injectable } from '@nestjs/common';
import { moduleSubmissions } from '@research-tracker/migrations';
import { and, desc, eq } from 'drizzle-orm';
import { DrizzleService } from '../../../db/drizzle.service';

interface CreateSubmissionValues {
  tenantId: string;
  moduleId: string;
  createdBy: string;
  submittedDate: string;
  journalName: string;
  status: string;
  revisionRounds?: number;
  decisionDate?: string;
  notes?: string;
}

interface UpdateSubmissionValues {
  submittedDate?: string;
  journalName?: string;
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

  async create(values: CreateSubmissionValues) {
    const [submission] = await this.drizzle.db
      .insert(moduleSubmissions)
      .values(values)
      .returning();

    return submission;
  }

  async update(
    tenantId: string,
    moduleId: string,
    submissionId: string,
    values: UpdateSubmissionValues,
  ) {
    const [submission] = await this.drizzle.db
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

    return submission;
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
