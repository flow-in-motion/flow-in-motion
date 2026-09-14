import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateSubmissionDto } from '../dto/create-submission.dto';
import { UpdateSubmissionDto } from '../dto/update-submission.dto';
import { ModuleSubmissionsRepository } from '../repositories/module-submissions.repository';

@Injectable()
export class ModuleSubmissionsService {
  constructor(private readonly repository: ModuleSubmissionsRepository) {}

  async list(tenantId: string, moduleId: string) {
    return this.repository.findByModule(tenantId, moduleId);
  }

  async create(
    tenantId: string,
    moduleId: string,
    callerUserId: string,
    input: CreateSubmissionDto,
  ) {
    const submission = await this.repository.create({
      tenantId,
      moduleId,
      createdBy: callerUserId,
      submittedDate: input.submittedDate,
      journalName: input.journalName.trim(),
      status: input.status,
      revisionRounds: input.revisionRounds,
      decisionDate: input.decisionDate,
      notes: input.notes?.trim(),
    });

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

    const submission = await this.repository.update(
      tenantId,
      moduleId,
      submissionId,
      {
        submittedDate: input.submittedDate,
        journalName: input.journalName?.trim(),
        status: input.status,
        revisionRounds: input.revisionRounds,
        decisionDate: input.decisionDate,
        notes: input.notes?.trim(),
      },
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
