import { Injectable, NotFoundException } from '@nestjs/common';
import { EnumRepository } from '../../enum/repositories/enum.repository';
import { CreateSubmissionDto } from '../dto/create-submission.dto';
import { UpdateSubmissionDto } from '../dto/update-submission.dto';
import { ModuleSubmissionsRepository } from '../repositories/module-submissions.repository';

@Injectable()
export class ModuleSubmissionsService {
  constructor(
    private readonly repository: ModuleSubmissionsRepository,
    private readonly enums: EnumRepository,
  ) {}

  private async stageIdForStatus(tenantId: string, status?: string) {
    const stage =
      status === 'Submitted' ||
      status === 'Resubmitted' ||
      status === 'Under review'
        ? 'Submitted, Under Review'
        : status === 'Rejected' || status === 'Revision requested'
          ? 'Revisions'
          : null;
    if (!stage) return undefined;
    const match = await this.enums.findModuleStageByValueForTenant(
      tenantId,
      stage,
    );
    if (!match)
      throw new NotFoundException(`Paper pipeline stage "${stage}" not found`);
    return match.id;
  }

  async list(tenantId: string, moduleId: string) {
    return this.repository.findByModule(tenantId, moduleId);
  }

  async create(
    tenantId: string,
    moduleId: string,
    callerUserId: string,
    input: CreateSubmissionDto,
  ) {
    const stageId = await this.stageIdForStatus(tenantId, input.status);
    const submission = await this.repository.create(
      {
        tenantId,
        moduleId,
        createdBy: callerUserId,
        submittedDate: input.submittedDate,
        journalName: input.journalName.trim(),
        paperTitle: input.paperTitle?.trim() || null,
        status: input.status,
        revisionRounds: input.revisionRounds,
        decisionDate: input.decisionDate,
        notes: input.notes?.trim(),
      },
      stageId,
      input.status === 'Submitted' ||
        input.status === 'Resubmitted' ||
        input.status === 'Under review',
    );

    if (!submission) {
      throw new NotFoundException('Failed to create submission');
    }

    return submission;
  }

  async update(
    tenantId: string,
    moduleId: string,
    submissionId: string,
    input: UpdateSubmissionDto,
  ) {
    const existing = await this.repository.findById(
      tenantId,
      moduleId,
      submissionId,
    );
    if (!existing) {
      throw new NotFoundException('Submission not found');
    }

    const stageId =
      input.status !== undefined && input.status !== existing.status
        ? await this.stageIdForStatus(tenantId, input.status)
        : undefined;
    const submission = await this.repository.update(
      tenantId,
      moduleId,
      submissionId,
      {
        submittedDate: input.submittedDate,
        journalName: input.journalName?.trim(),
        // undefined leaves the title unchanged; null or blank clears it.
        paperTitle:
          input.paperTitle === undefined
            ? undefined
            : input.paperTitle?.trim() || null,
        status: input.status,
        revisionRounds: input.revisionRounds,
        decisionDate: input.decisionDate,
        notes: input.notes?.trim(),
      },
      stageId,
      input.status === 'Submitted' ||
        input.status === 'Resubmitted' ||
        input.status === 'Under review',
    );

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    return submission;
  }

  async remove(tenantId: string, moduleId: string, submissionId: string) {
    const existing = await this.repository.findById(
      tenantId,
      moduleId,
      submissionId,
    );
    if (!existing) {
      throw new NotFoundException('Submission not found');
    }

    const submission = await this.repository.remove(
      tenantId,
      moduleId,
      submissionId,
    );

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    return { message: 'Submission deleted successfully', submission };
  }
}
